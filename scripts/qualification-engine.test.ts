import assert from "node:assert/strict";
import type { LeadKnowledgeRecord } from "../apps/web/src/lib/lead-knowledge-store";
import {
  buildQualificationHistory,
  buildQualificationSummary,
  getMissingQualificationFields,
  qualificationFieldLabels
} from "../apps/web/src/lib/qualification-engine";

const baseLead: LeadKnowledgeRecord = {
  id: "lead_phase4_test",
  tenantId: "tenant_test",
  ownerId: "owner_test",
  identityKeys: [],
  contact: { displayName: "Priya Decision Maker", phone: "+91 90000 00000" },
  leadStatus: "lead",
  crmStatus: "needs_reply",
  leadSource: "WhatsApp",
  qualificationFields: {
    name: "Priya Decision Maker",
    company: "Acme Clinics",
    need: "WhatsApp lead qualification for patient enquiries",
    budget: "₹50,000",
    timeline: "30 Days",
    authority: "Decision maker",
    location: "Mumbai",
    serviceInterest: "AI qualification workspace"
  },
  qualificationStage: "qualified",
  summary: "Priya wants WhatsApp qualification for clinic enquiries.",
  nextAction: "Schedule demo",
  facts: ["Budget changed from Unknown to ₹50,000", "Timeline changed from Unknown to 30 Days"],
  channels: ["whatsapp"],
  conversations: [],
  messages: [
    {
      id: "msg_1",
      tenantId: "tenant_test",
      ownerId: "owner_test",
      leadId: "lead_phase4_test",
      conversationId: "conv_1",
      source: "manual",
      channel: "whatsapp",
      externalId: "msg_1",
      direction: "inbound",
      body: "Need WhatsApp automation. Budget is ₹50,000. Timeline: 30 Days. I am the decision maker in Mumbai.",
      messageType: "text",
      sentAt: "2026-06-02T08:00:00.000Z",
      receivedAt: "2026-06-02T08:00:00.000Z"
    }
  ],
  messageCount: 1,
  inboundCount: 1,
  outboundCount: 0,
  lastMessageAt: "2026-06-02T08:00:00.000Z",
  lastMessagePreview: "Need WhatsApp automation. Budget is ₹50,000.",
  createdAt: "2026-06-02T07:50:00.000Z",
  updatedAt: "2026-06-02T08:01:00.000Z"
};

async function main() {
  assert.deepEqual(qualificationFieldLabels.map((field) => field.label), [
    "Need",
    "Budget",
    "Timeline",
    "Authority",
    "Location",
    "Company",
    "Service Interest",
    "Intent",
    "Risk",
    "Recommended Action"
  ]);

  const partialLead = {
    ...baseLead,
    qualificationFields: { need: "CRM automation" },
    nextAction: undefined,
    messages: [],
    messageCount: 0,
    inboundCount: 0,
    outboundCount: 0,
    qualificationStage: "collecting"
  } satisfies LeadKnowledgeRecord;
  const missing = getMissingQualificationFields(partialLead).map((field) => field.label);
  assert(missing.includes("Budget"), "Budget should be reported as still needed");
  assert(missing.includes("Timeline"), "Timeline should be reported as still needed");
  assert(missing.includes("Authority"), "Decision maker / authority should be reported as still needed");

  const partialSummary = buildQualificationSummary(partialLead);
  assert.equal(partialSummary.fields.budget.state, "missing");
  assert.equal(partialSummary.fields.budget.displayValue, "Not Yet Collected");
  assert.equal(partialSummary.score.value >= 0 && partialSummary.score.value <= 100, true);
  assert(partialSummary.score.explanation.reasons.length > 0, "Every score should include reasons");
  assert(partialSummary.score.explanation.missing.includes("Budget not confirmed"));
  assert.equal(partialSummary.recommendedAction.action, "Request budget clarification");
  assert(partialSummary.recommendedAction.why.includes("budget"));

  const qualifiedSummary = buildQualificationSummary(baseLead);
  assert.equal(qualifiedSummary.fields.budget.state, "collected");
  assert.equal(qualifiedSummary.fields.intent.displayValue, "Very High Intent");
  assert.equal(qualifiedSummary.score.label, "Very High Intent");
  assert.equal(qualifiedSummary.score.value, 100);
  assert(qualifiedSummary.score.explanation.reasons.includes("Budget identified"));
  assert(qualifiedSummary.score.explanation.reasons.includes("Timeline identified"));
  assert(qualifiedSummary.score.explanation.reasons.includes("Active conversation"));
  assert(qualifiedSummary.score.explanation.reasons.includes("Decision maker present"));
  assert.equal(qualifiedSummary.recommendedAction.action, "Schedule demo");
  assert(qualifiedSummary.recommendedAction.why.includes("high-intent"));

  const history = buildQualificationHistory(baseLead, partialLead);
  assert(history.some((event) => event.whatChanged === "Budget: Not Yet Collected → ₹50,000"));
  assert(history.some((event) => event.whatChanged === "Timeline: Not Yet Collected → 30 Days"));
  assert(history.some((event) => event.whatChanged.startsWith("Qualification Score:")));
  assert(history.every((event) => event.when && event.whyScoreChanged), "History events should explain when and why score changed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
