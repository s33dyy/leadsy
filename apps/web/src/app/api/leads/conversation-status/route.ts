import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import {
  setLeadConversationKnowledgeStatus,
  type LeadConversationKnowledgeStatus
} from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function knowledgeStatusFromValue(value: FormDataEntryValue | null): LeadConversationKnowledgeStatus | null {
  return value === "included" || value === "excluded" ? value : null;
}

function redirectToLead(request: NextRequest, leadId: string, notice: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("tab", "comms");
  url.searchParams.set("notice", notice);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-conversation-status`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const leadId = String(form.get("leadId") ?? "").trim();
  const conversationId = String(form.get("conversationId") ?? "").trim();
  const knowledgeStatus = knowledgeStatusFromValue(form.get("knowledgeStatus"));
  if (!leadId || !conversationId || !knowledgeStatus) {
    return NextResponse.json({ error: "invalid_conversation_status" }, { status: 400 });
  }

  const conversation = await setLeadConversationKnowledgeStatus({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    conversationId,
    knowledgeStatus
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "leads.conversation_status.update",
    resource: conversation.id,
    metadata: { knowledgeStatus: conversation.knowledgeStatus }
  });

  return redirectToLead(
    request,
    leadId,
    knowledgeStatus === "excluded" ? "conversation-excluded" : "conversation-restored"
  );
}
