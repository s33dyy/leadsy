import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createExtensionTask, type ExtensionTaskType } from "@/lib/extension-store";
import { draftExtensionTaskMessage } from "@/lib/extension-task-drafts";
import { listLeadKnowledgeRecords, type LeadKnowledgeRecord } from "@/lib/lead-knowledge-store";

export const runtime = "nodejs";

const schema = z.object({
  leadIds: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  type: z.enum(["initiate_conversation", "follow_up", "reply_to_inbound", "auto_detect"]).default("initiate_conversation")
});

type GeneratedTaskType = Extract<ExtensionTaskType, "initiate_conversation" | "follow_up" | "reply_to_inbound">;

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:extension-task-generate`, 60);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const records = await listLeadKnowledgeRecords({ tenantId: auth.session.tenantId, ownerId: auth.session.id });
  const selectedLeadIds = new Set(input.leadIds ?? []);
  const leads = records
    .filter((lead) => !selectedLeadIds.size || selectedLeadIds.has(lead.id))
    .filter((lead) => lead.leadStatus !== "excluded")
    .filter(leadHasTaskTarget)
    .slice(0, 25);

  const tasks = [];
  const detectedTypes: GeneratedTaskType[] = [];
  for (const lead of leads) {
    const taskType = input.type === "auto_detect" ? detectExtensionTaskType(lead) : input.type;
    if (!shouldGenerateExtensionTask(lead, taskType)) continue;
    detectedTypes.push(taskType);
    tasks.push(
      await createExtensionTask({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        type: taskType,
        status: "queued",
        priority: lead.inboundCount > lead.outboundCount ? "high" : "normal",
        leadId: lead.id,
        platform: platformForLead(lead),
        targetUrl: targetUrlForLead(lead),
        contact: {
          displayName: lead.contact.displayName,
          phone: lead.contact.phone || lead.contact.waId,
          email: lead.contact.email,
          handle: lead.contact.handle,
          profileUrl: lead.contact.profileUrl
        },
        draftMessage: draftExtensionTaskMessage(lead, taskType),
        contextSummary: lead.summary || lead.lastMessagePreview || "Leadsy knowledge record ready for follow-up.",
        dueAt: new Date(Date.now() + 1000 * 60 * 15).toISOString()
      })
    );
  }

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "extension.tasks.generate",
    resource: "extension-tasks",
    metadata: { count: tasks.length, type: input.type, detectedTypes }
  });

  return NextResponse.json({ tasks });
}

function detectExtensionTaskType(lead: LeadKnowledgeRecord): GeneratedTaskType {
  const latestDirection = lead.messages.at(-1)?.direction;
  const text = [
    lead.summary,
    lead.nextAction,
    lead.lastMessagePreview,
    ...lead.facts,
    ...lead.messages.slice(-3).map((message) => message.body)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const scores: Record<GeneratedTaskType, number> = {
    initiate_conversation: 0,
    follow_up: 0,
    reply_to_inbound: 0
  };

  if (latestDirection === "inbound") scores.reply_to_inbound += 6;
  if (lead.inboundCount > lead.outboundCount) scores.reply_to_inbound += 4;
  if (/\b(reply|respond|replied|inbound|asked|asking|reached out|enquiry|inquiry)\b/.test(text)) scores.reply_to_inbound += 3;
  if (/\b(follow[- ]?up|nudge|check in|remind|again|next step)\b/.test(text)) scores.follow_up += 4;
  if (lead.outboundCount > 0) scores.follow_up += 3;
  if (lead.messages.length > 1 && latestDirection !== "inbound") scores.follow_up += 2;
  if (!lead.outboundCount && lead.inboundCount === 0) scores.initiate_conversation += 4;
  if (/\b(new lead|intro|introduce|first outreach|start qualification)\b/.test(text)) scores.initiate_conversation += 3;
  if (lead.contact.phone || lead.contact.email || lead.contact.handle || lead.contact.profileUrl) scores.initiate_conversation += 1;

  return (Object.entries(scores) as Array<[GeneratedTaskType, number]>).sort((left, right) => right[1] - left[1])[0][0];
}

function shouldGenerateExtensionTask(lead: LeadKnowledgeRecord, taskType: GeneratedTaskType) {
  const latestMessage = lead.messages.at(-1);
  if (taskType === "initiate_conversation" && lead.outboundCount > 0) return false;
  if (latestMessage?.direction === "outbound" && isRecentMessage(latestMessage.sentAt)) return false;
  return true;
}

function isRecentMessage(sentAt: string) {
  const sentTime = Date.parse(sentAt);
  if (!Number.isFinite(sentTime)) return false;
  return Date.now() - sentTime < 1000 * 60 * 60 * 12;
}

function platformForLead(lead: LeadKnowledgeRecord) {
  if (lead.contact.phone || lead.contact.waId || lead.channels.includes("whatsapp")) return "whatsapp-web" as const;
  if (lead.channels.includes("instagram") || lead.contact.profileUrl?.includes("instagram.com")) return "instagram-web" as const;
  if (lead.channels.includes("facebook") || lead.contact.profileUrl?.includes("facebook.com")) return "facebook-web" as const;
  return "generic-web-chat" as const;
}

function targetUrlForLead(lead: LeadKnowledgeRecord) {
  const phone = lead.contact.phone || lead.contact.waId;
  if (phone) {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits) return `https://web.whatsapp.com/send?phone=${digits}`;
  }
  return lead.contact.profileUrl || lead.conversations.find((conversation) => conversation.sourceUrl)?.sourceUrl;
}

function leadHasTaskTarget(lead: LeadKnowledgeRecord) {
  return Boolean(
    targetUrlForLead(lead) ||
      lead.contact.displayName ||
      lead.contact.email ||
      lead.contact.handle ||
      lead.summary ||
      lead.nextAction ||
      lead.lastMessagePreview ||
      lead.facts.length ||
      hasIncludedConversation(lead)
  );
}

function hasIncludedConversation(lead: LeadKnowledgeRecord) {
  return lead.conversations.some(({ knowledgeStatus }) => knowledgeStatus === "included");
}
