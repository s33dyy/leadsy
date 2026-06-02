import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import type { LeadDossier } from "@leadsy/domain";
import { requireApiSession } from "@/lib/api-auth";
import { createExtensionTask } from "@/lib/extension-store";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";

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
  const workspace = await getLeadMagnetWorkspace(auth.session.tenantId, auth.session.id);
  const selectedLeadIds = new Set(input.leadIds ?? []);
  const leads = workspace.leads
    .filter((lead) => !selectedLeadIds.size || selectedLeadIds.has(lead.id))
    .filter((lead) => lead.qualityDecision?.status !== "rejected")
    .slice(0, 25);

  const tasks = [];
  for (const lead of leads) {
    tasks.push(
      await createExtensionTask({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        type: input.type,
        status: "queued",
        priority: lead.score.overall >= 80 ? "high" : "normal",
        leadId: lead.id,
        platform: platformForLead(lead),
        targetUrl: targetUrlForLead(lead),
        contact: {
          displayName: lead.businessName,
          phone: lead.whatsapp || lead.phone,
          email: lead.email,
          handle: lead.instagram || lead.facebook || lead.linkedin,
          profileUrl: lead.instagram || lead.facebook || lead.linkedin
        },
        draftMessage: draftForLead(lead, input.type),
        contextSummary: `${lead.category} in ${lead.city}. ${lead.outreachAngle || lead.nextAction}`,
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

function platformForLead(lead: LeadDossier) {
  if (lead.whatsapp || lead.phone) return "whatsapp-web" as const;
  if (lead.instagram) return "instagram-web" as const;
  if (lead.facebook) return "facebook-web" as const;
  return "generic-web-chat" as const;
}

function targetUrlForLead(lead: LeadDossier) {
  const phone = lead.whatsapp || lead.phone;
  if (phone) {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits) return `https://web.whatsapp.com/send?phone=${digits}`;
  }
  return lead.instagram || lead.facebook || lead.linkedin || lead.website;
}

function draftForLead(lead: LeadDossier, type: "initiate_conversation" | "follow_up") {
  if (type === "follow_up") {
    return `Hi ${lead.businessName}, following up on this. ${lead.nextAction}`;
  }
  return `Hi ${lead.businessName}, ${lead.outreachAngle} Would it make sense to discuss this this week?`;
}
