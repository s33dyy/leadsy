import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revenueCopilot } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

const schema = z.object({
  prompt: z.string().min(2).max(2000),
  accountId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:copilot`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const response = await withSpan("copilot.complete", () =>
    revenueCopilot.complete({
      tenantId: session.tenantId,
      userId: session.id,
      prompt: input.prompt,
      accountId: input.accountId
    })
  );

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "copilot.invoked",
    payload: { userId: session.id, intent: response.intent }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "copilot.invoke",
    resource: "copilot",
    metadata: { intent: response.intent, citations: response.citations }
  });

  return NextResponse.json(response);
}
