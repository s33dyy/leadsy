import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createExtensionTask } from "@/lib/extension-store";
import { draftExtensionTaskMessage } from "@/lib/extension-task-drafts";
import { listLeadKnowledgeRecords, type LeadKnowledgeRecord } from "@/lib/lead-knowledge-store";

export const runtime = "nodejs";

const schema = z.object({
  leadIds: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  type: z.enum(["initiate_conversation", "follow_up"]).default("initiate_conversation")
});

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
    .filter((lead) => lead.conversations.some((conversation) => conversation.knowledgeStatus === "included"))
    .slice(0, 25);

  const tasks = [];
  for (const lead of leads) {
    tasks.push(
      await createExtensionTask({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        type: input.type,
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
        draftMessage: draftExtensionTaskMessage(lead, input.type),
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
    metadata: { count: tasks.length, type: input.type }
  });

  return NextResponse.json({ tasks });
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
