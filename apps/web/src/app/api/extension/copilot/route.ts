import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { revenueCopilot } from "@leadsy/ai";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";

const schema = z.object({
  prompt: z.string().trim().min(2).max(2000),
  page: z
    .object({
      url: z.string().trim().max(1000).optional(),
      title: z.string().trim().max(300).optional(),
      text: z.string().trim().max(5000).optional()
    })
    .optional(),
  messages: z
    .array(
      z.object({
        direction: z.string().trim().max(40),
        text: z.string().trim().max(1000)
      })
    )
    .default([])
});

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-copilot`, 80);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const response = await revenueCopilot.complete({
    tenantId: auth.tenantId,
    userId: auth.ownerId,
    prompt: [
      input.prompt,
      input.page ? `Current page: ${input.page.title ?? "Untitled"} ${input.page.url ?? ""}` : "",
      input.page?.text ? `Visible context: ${input.page.text.slice(0, 1400)}` : "",
      input.messages.length
        ? `Recent chat: ${input.messages.map((message) => `${message.direction}: ${message.text}`).join("\n").slice(0, 1800)}`
        : ""
    ]
      .filter(Boolean)
      .join("\n\n")
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.copilot.invoke",
    resource: "extension-copilot",
    metadata: { intent: response.intent }
  });

  return NextResponse.json(response);
}
