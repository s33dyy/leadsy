import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { sendInitialAiOutboundForLead } from "@/lib/agent-runtime";
import { assignLeadOwner } from "@/lib/crm-store";
import {
  appendManualLeadMessage,
  editLeadKnowledgeRecord,
  setLeadKnowledgeStatus,
  type LeadKnowledgeChannel,
  type LeadKnowledgeDirection,
  type LeadKnowledgeStatus
} from "@/lib/lead-knowledge-store";
import { urlForRequestHost } from "@/lib/request-url";
import { ensureDefaultQualificationAgent, getTeamMember } from "@/lib/teamspace-store";

export const runtime = "nodejs";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function channelFromValue(value: FormDataEntryValue | null): LeadKnowledgeChannel {
  const channel = clean(value);
  if (
    channel === "whatsapp" ||
    channel === "email" ||
    channel === "call" ||
    channel === "manual"
  ) {
    return channel;
  }
  return "manual";
}

function directionFromValue(value: FormDataEntryValue | null): Extract<LeadKnowledgeDirection, "inbound" | "outbound" | "note"> {
  const direction = clean(value);
  return direction === "inbound" || direction === "outbound" || direction === "note" ? direction : "note";
}

function leadStatusFromValue(value: FormDataEntryValue | null): LeadKnowledgeStatus {
  return clean(value) === "excluded" ? "excluded" : "lead";
}

function booleanFromValue(value: FormDataEntryValue | null) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function splitLines(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fact(label: string, value: string) {
  return value ? `${label}: ${value}` : undefined;
}

function redirectUrl(request: NextRequest, leadId: string) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("notice", "manual-lead-added");
  return url;
}

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json");
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:manual-lead`, 80);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const form = await request.formData();
  const displayName = clean(form.get("displayName"));
  const phone = clean(form.get("phone"));
  const email = clean(form.get("email"));
  const handle = clean(form.get("handle"));
  const profileUrl = clean(form.get("profileUrl"));
  const company = clean(form.get("company"));
  const body = clean(form.get("body"));

  if (![displayName, phone, email, handle, body].some(Boolean)) {
    return NextResponse.json(
      { error: "invalid_manual_lead", message: "Add a name, phone, email, handle, or note before saving this lead." },
      { status: 400 }
    );
  }

  const channel = channelFromValue(form.get("channel"));
  const leadStatus = leadStatusFromValue(form.get("leadStatus"));
  const priority = clean(form.get("priority"));
  const urgency = clean(form.get("urgency"));
  const estimatedBudget = clean(form.get("estimatedBudget"));
  const relatedLead = clean(form.get("relatedLead"));
  const sourceDetail = clean(form.get("sourceDetail"));
  const extraEmails = splitLines(clean(form.get("additionalEmails")));
  const nextAction = clean(form.get("nextAction"));
  const assigneeId = clean(form.get("assigneeId"));
  const selectedMember = assigneeId
    ? await getTeamMember({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        memberId: assigneeId
      })
    : await ensureDefaultQualificationAgent({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id
      });
  if (!selectedMember) {
    return NextResponse.json({ error: "team_member_not_found", message: "Choose a valid owner before saving this lead." }, { status: 404 });
  }

  const facts = [
    fact("Company", company),
    fact("Source detail", sourceDetail),
    fact("Priority", priority),
    fact("Urgency", urgency),
    fact("Estimated budget", estimatedBudget),
    fact("Related lead", relatedLead),
    ...extraEmails.map((item) => fact("Additional email", item))
  ].filter(Boolean) as string[];
  const manualBody = [body || "Manual lead created from CRM intake.", ...facts].join("\n");

  const lead = await appendManualLeadMessage({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    direction: directionFromValue(form.get("direction")),
    channel,
    contact: {
      displayName,
      phone,
      email,
      handle,
      profileUrl
    },
    body: manualBody,
    occurredAt: new Date().toISOString()
  });

  const editedLead = await editLeadKnowledgeRecord({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId: lead.id,
    contact: {
      displayName,
      phone,
      email,
      handle,
      profileUrl
    },
    summary: company ? `Manual lead for ${company}.` : "Manual lead created from CRM intake.",
    nextAction: nextAction || "Review the manual intake answers and qualify this lead.",
    facts: [body || "Manual lead created from CRM intake.", ...facts].filter(Boolean)
  });

  let finalLead =
    leadStatus === "excluded"
      ? await setLeadKnowledgeStatus({
          tenantId: auth.session.tenantId,
          ownerId: auth.session.id,
          leadId: editedLead.id,
          leadStatus
        })
      : editedLead;

  finalLead = await assignLeadOwner({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId: finalLead.id,
    assigneeId: selectedMember.id,
    assigneeName: selectedMember.name,
    assignedById: auth.session.id,
    assignedByName: auth.session.name,
    reason: "Owner selected during manual lead intake"
  });

  const aiAction =
    leadStatus === "excluded" || !booleanFromValue(form.get("sendInitialAiMessage"))
      ? undefined
      : await sendInitialAiOutboundForLead({
          tenantId: auth.session.tenantId,
          ownerId: auth.session.id,
          leadId: finalLead.id,
          memberId: selectedMember.id,
          trigger: "manual-create"
        });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "leads.manual.create",
    resource: finalLead.id,
    metadata: { channel, leadStatus }
  });

  const url = redirectUrl(request, finalLead.id);
  if (wantsJson(request)) {
    return NextResponse.json({ leadId: finalLead.id, href: `${url.pathname}${url.search}`, lead: finalLead, aiAction });
  }
  return NextResponse.redirect(url, 303);
}
