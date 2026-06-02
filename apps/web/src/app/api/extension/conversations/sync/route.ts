import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { syncExtensionConversation } from "@/lib/extension-store";

const platformSchema = z.enum(["whatsapp-web", "instagram-web", "facebook-web", "generic-web-chat"]);
const directionSchema = z.enum(["inbound", "outbound", "system"]);

const schema = z.object({
  platform: platformSchema,
  sourceUrl: z.string().trim().min(1).max(1000),
  chatFingerprint: z.string().trim().min(1).max(1000),
  contact: z
    .object({
      displayName: z.string().trim().max(160).optional(),
      phone: z.string().trim().max(80).optional(),
      email: z.string().trim().max(160).optional(),
      handle: z.string().trim().max(160).optional(),
      profileUrl: z.string().trim().max(1000).optional()
    })
    .optional(),
  messages: z
    .array(
      z.object({
        externalId: z.string().trim().min(1).max(300),
        direction: directionSchema,
        body: z.string().trim().min(1).max(5000),
        sentAt: z.string().trim().min(1).max(80),
        generatedBy: z.enum(["leadsy", "fallback", "human"]).optional()
      })
    )
    .default([]),
  events: z
    .array(
      z.object({
        type: z.enum(["detected", "inbound-synced", "reply-generated", "reply-sent", "reply-paused", "fallback-used", "error"]),
        summary: z.string().trim().min(1).max(1000),
        occurredAt: z.string().trim().min(1).max(80)
      })
    )
    .default([]),
  insight: z
    .object({
      summary: z.string().trim().max(1000),
      qualification: z.string().trim().max(240).optional(),
      nextAction: z.string().trim().max(500).optional(),
      sentiment: z.enum(["positive", "neutral", "hesitant", "negative"]).optional()
    })
    .optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-sync`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const bundle = await syncExtensionConversation({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    ...input
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.conversation.sync",
    resource: bundle.conversation.id,
    metadata: { platform: bundle.conversation.platform, messages: bundle.messages.length }
  });

  return NextResponse.json(bundle);
}
