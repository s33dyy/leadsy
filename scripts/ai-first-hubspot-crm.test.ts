import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-ai-first-crm-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const { ensureWorkspaceTwilioSimulator } = await import("../apps/web/src/lib/twilio-simulator");
    const { createTeamMember, ensureDefaultQualificationAgent, listTeamThreadMessages } = await import("../apps/web/src/lib/teamspace-store");
    const { appendManualLeadMessage, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { assignLeadOwner } = await import("../apps/web/src/lib/crm-store");
    const { sendInitialAiOutboundForLead } = await import("../apps/web/src/lib/agent-runtime");

    const scope = { tenantId: "tenant_ai_first_crm", ownerId: "owner_ai_first_crm" };
    await ensureWorkspaceTwilioSimulator({ ...scope, businessName: "Helio" });
    const qualificationAgent = await ensureDefaultQualificationAgent(scope);
    const assistedAgent = await createTeamMember({
      ...scope,
      type: "ai_agent_assisted",
      name: "Assisted Demo AI",
      role: "agent",
      pipelineStages: ["qualified"],
      autoReplyEnabled: false
    });
    const human = await createTeamMember({
      ...scope,
      type: "human",
      name: "Human Owner",
      emailOrPhone: "owner@example.com",
      role: "manager",
      pipelineStages: ["qualified"],
      autoReplyEnabled: false
    });

    const manualLead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Manual Buyer", phone: "+91 90000 00010" },
      channel: "manual",
      direction: "note",
      body: "Company: LensMart\nNeed: WhatsApp CRM follow-up",
      occurredAt: "2026-06-08T04:00:00.000Z"
    });
    await assignLeadOwner({
      ...scope,
      leadId: manualLead.id,
      assigneeId: qualificationAgent.id,
      assigneeName: qualificationAgent.name,
      assignedById: scope.ownerId,
      assignedByName: "Workspace Owner",
      reason: "Manual intake owner"
    });

    const firstAiSend = await sendInitialAiOutboundForLead({
      ...scope,
      leadId: manualLead.id,
      memberId: qualificationAgent.id,
      trigger: "manual-create"
    });
    assert.equal(firstAiSend.action, "sent");
    assert.match(firstAiSend.body ?? "", /hi|hello|thanks|leadsy/i);

    const duplicateAiSend = await sendInitialAiOutboundForLead({
      ...scope,
      leadId: manualLead.id,
      memberId: qualificationAgent.id,
      trigger: "manual-create"
    });
    assert.equal(duplicateAiSend.action, "skipped_duplicate");

    const afterAiSend = (await listLeadKnowledgeRecords(scope)).find((lead) => lead.id === manualLead.id);
    assert.equal(afterAiSend?.messages.filter((message) => message.direction === "outbound").length, 1);
    assert.equal(afterAiSend?.messages.filter((message) => message.direction === "inbound").length, 0);
    const aiThread = await listTeamThreadMessages({ ...scope, leadId: manualLead.id });
    assert(aiThread.some((message) => /initial outbound/i.test(message.body)), "AI initial send should be captured as an internal CRM note");

    const assistedLead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Assisted Buyer", phone: "+91 90000 00011" },
      channel: "manual",
      direction: "note",
      body: "Company: Demo Labs\nNeed: Proposal review",
      occurredAt: "2026-06-08T04:10:00.000Z"
    });
    await assignLeadOwner({
      ...scope,
      leadId: assistedLead.id,
      assigneeId: assistedAgent.id,
      assigneeName: assistedAgent.name,
      assignedById: scope.ownerId,
      assignedByName: "Workspace Owner",
      reason: "Manual intake owner"
    });
    const assistedSend = await sendInitialAiOutboundForLead({
      ...scope,
      leadId: assistedLead.id,
      memberId: assistedAgent.id,
      trigger: "manual-create"
    });
    assert.equal(assistedSend.action, "drafted_for_review");
    const assistedAfter = (await listLeadKnowledgeRecords(scope)).find((lead) => lead.id === assistedLead.id);
    assert.equal(assistedAfter?.messages.filter((message) => message.direction === "outbound").length, 0);

    const humanLead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Human Buyer", phone: "+91 90000 00012" },
      channel: "manual",
      direction: "note",
      body: "Company: Human Labs\nNeed: Human sales follow-up",
      occurredAt: "2026-06-08T04:20:00.000Z"
    });
    await assignLeadOwner({
      ...scope,
      leadId: humanLead.id,
      assigneeId: human.id,
      assigneeName: human.name,
      assignedById: scope.ownerId,
      assignedByName: "Workspace Owner",
      reason: "Manual intake owner"
    });
    const humanSend = await sendInitialAiOutboundForLead({
      ...scope,
      leadId: humanLead.id,
      memberId: human.id,
      trigger: "manual-create"
    });
    assert.equal(humanSend.action, "not_ai_member");
    const humanAfter = (await listLeadKnowledgeRecords(scope)).find((lead) => lead.id === humanLead.id);
    assert.equal(humanAfter?.messages.filter((message) => message.direction === "outbound").length, 0);

    const shell = await readFile(join(process.cwd(), "apps/web/src/components/app-shell.tsx"), "utf8");
    assert.doesNotMatch(shell, /Lead context/, "sidebar should not expose duplicate Lead context navigation");
    assert.doesNotMatch(shell, /panel=knowledge/, "legacy lead knowledge panel should not be linked from the shell");
    assert.match(shell, /ManualLeadIntake/, "global shell should mount the manual lead modal");
    assert.doesNotMatch(shell, /href="\/app\/leads\?new=lead"/, "New lead should open the modal instead of navigating");

    const manualIntake = await readFile(join(process.cwd(), "apps/web/src/components/manual-lead-intake.tsx"), "utf8");
    assert.match(manualIntake, /name="assigneeId"/, "manual intake should include owner selection");
    assert.match(manualIntake, /sendInitialAiMessage/, "manual intake should request the initial AI outbound behavior");

    const leadsPage = await readFile(join(process.cwd(), "apps/web/src/app/app/leads/page.tsx"), "utf8");
    for (const tab of ["Details", "Comms", "Tasks"]) {
      assert.match(leadsPage, new RegExp(tab), `Lead record workspace should render ${tab} tab`);
    }
    assert.doesNotMatch(leadsPage, /panel=knowledge/, "Leads page should not preserve duplicate knowledge panel state");
    assert.match(leadsPage, /sendInitialAiMessage/, "assignment form should request initial AI outbound when assigning an AI owner");

    console.log("AI-first HubSpot CRM regression passed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
