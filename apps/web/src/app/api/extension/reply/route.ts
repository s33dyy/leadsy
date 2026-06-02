import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { decideExtensionReply } from "@leadsy/ai";
import { audit, rateLimit } from "@leadsy/security";
import { requireExtensionToken } from "@/lib/extension-auth";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";
import { syncExtensionConversation } from "@/lib/extension-store";

const platformSchema = z.enum(["whatsapp-web", "instagram-web", "facebook-web", "generic-web-chat"]);
const directionSchema = z.enum(["incoming", "outgoing", "system", "inbound", "outbound"]);

const messageSchema = z.object({
  id: z.string().trim().max(300).optional(),
  externalId: z.string().trim().max(300).optional(),
  direction: directionSchema,
  text: z.string().trim().max(5000).optional(),
  body: z.string().trim().max(5000).optional(),
  timestamp: z.number().optional(),
  sentAt: z.string().trim().max(80).optional(),
  sourceUrl: z.string().trim().max(1000).optional()
});

const schema = z.object({
  platform: platformSchema.default("generic-web-chat"),
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
  messages: z.array(messageSchema).min(1).max(80),
  existingSummary: z.string().trim().max(1000).optional()
});

function asSyncDirection(direction: z.infer<typeof directionSchema>) {
  if (direction === "incoming") return "inbound" as const;
  if (direction === "outgoing") return "outbound" as const;
  return direction;
}

function messageBody(message: z.infer<typeof messageSchema>) {
  return (message.text ?? message.body ?? "").trim();
}

export async function POST(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-reply`, 180);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const workspace = await getLeadMagnetWorkspace(auth.tenantId, auth.ownerId);
  const decision = await decideExtensionReply({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    chatFingerprint: input.chatFingerprint,
    contact: input.contact,
    messages: input.messages,
    brief: workspace.brief,
    leads: workspace.leads,
    existingSummary: input.existingSummary
  });

  const now = new Date().toISOString();
  const synced = await syncExtensionConversation({
    tenantId: auth.tenantId,
    ownerId: auth.ownerId,
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    chatFingerprint: input.chatFingerprint,
    contact: input.contact,
    messages: input.messages
      .map((message, index) => ({
        externalId: message.externalId || message.id || `msg_${message.timestamp ?? index}`,
        direction: asSyncDirection(message.direction),
        body: messageBody(message),
        sentAt: message.sentAt || (message.timestamp ? new Date(message.timestamp).toISOString() : now)
      }))
      .filter((message) => message.body),
    events: [
      {
        type: decision.action === "send" ? "reply-generated" : "reply-paused",
        summary: decision.reason,
        occurredAt: now
      }
    ],
    insight: {
      summary: decision.reason,
      qualification: decision.tags.join(", "),
      nextAction: decision.leadFields?.nextAction,
      sentiment: decision.action === "send" ? "positive" : "hesitant"
    }
  });

  audit({
    tenantId: auth.tenantId,
    actorId: auth.ownerId,
    action: "extension.reply.decide",
    resource: synced.conversation.id,
    metadata: { action: decision.action, confidence: decision.confidence, tags: decision.tags }
  });

  return NextResponse.json({ decision, conversation: synced.conversation });
}
