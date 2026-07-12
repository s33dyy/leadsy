import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { listLeadKnowledgeRecords, editLeadKnowledgeRecord } from "@/lib/lead-knowledge-store";
import { postTeamThreadMessage } from "@/lib/teamspace-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-control`, 100);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const payload = await request.json();
  const { leadId, action } = payload;

  if (!leadId || (action !== "takeover" && action !== "release_to_ai")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const leads = await listLeadKnowledgeRecords({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id
  });
  const lead = leads.find((record) => record.id === leadId);

  if (!lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let newStatus = lead.crmStatus;
  let nextAction = lead.nextAction;

  if (action === "takeover") {
    newStatus = "human_takeover";
    nextAction = "Manual human takeover. Auto-replies are paused.";
    await postTeamThreadMessage({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      leadId: lead.id,
      authorMemberId: auth.session.id,
      authorType: "human",
      body: "A human has taken over the conversation. AI auto-replies are paused.",
      eventType: "agent_guard",
      triggerId: `takeover:${Date.now()}`
    });
  } else if (action === "release_to_ai") {
    newStatus = "needs_reply";
    nextAction = "Released to AI. Waiting for lead to reply or AI to engage.";
    await postTeamThreadMessage({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      leadId: lead.id,
      authorMemberId: auth.session.id,
      authorType: "human",
      body: "Conversation released back to AI.",
      eventType: "agent_guard",
      triggerId: `release:${Date.now()}`
    });
  }

  const updatedLead = await editLeadKnowledgeRecord({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId: lead.id,
    contact: lead.contact,
    summary: lead.summary,
    nextAction,
    facts: lead.facts,
    crmStatus: newStatus,
    productPipelineStatus: lead.productPipelineStatus,
    leadSource: lead.leadSource,
    campaignId: lead.campaignId,
    assigneeId: lead.assigneeId,
    assigneeName: lead.assigneeName,
    qualificationFields: lead.qualificationFields,
    qualificationStage: lead.qualificationStage
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: `crm.lead.${action}`,
    resource: lead.id
  });

  return NextResponse.json({ lead: updatedLead });
}
