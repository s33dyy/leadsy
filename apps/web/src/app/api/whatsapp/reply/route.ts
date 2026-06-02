import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateWhatsAppReply } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

const schema = z.object({
  conversationId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:whatsapp-reply`, 160);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const result = await withSpan("whatsapp.reply", () => generateWhatsAppReply(input.conversationId), {
    conversationId: input.conversationId
  });

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "whatsapp.reply.generated",
    payload: { conversationId: result.conversationId, shouldEscalate: result.shouldEscalate }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "whatsapp.reply.generate",
    resource: result.conversationId,
    metadata: { tone: result.tone, shouldEscalate: result.shouldEscalate }
  });

  return NextResponse.json(result);
}
