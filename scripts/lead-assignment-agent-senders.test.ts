import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-agent-assignment-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const {
      createTeamMember,
      ensureDefaultQualificationAgent,
      listTeamMembers,
      provisionTeamMemberSender
    } = await import("../apps/web/src/lib/teamspace-store");
    const {
      appendManualLeadMessage,
      listLeadKnowledgeRecords,
      saveTwilioInboundMessage
    } = await import("../apps/web/src/lib/lead-knowledge-store");
    const {
      assignLeadOwner,
      assignLeadToDefaultQualificationAgent,
      listCrmAssignmentHistory
    } = await import("../apps/web/src/lib/crm-store");

    const scope = { tenantId: "tenant_agent_assignment", ownerId: "owner_agent_assignment" };

    const defaultAgent = await ensureDefaultQualificationAgent(scope);
    assert.equal(defaultAgent.name, "Qualification AI");
    assert.equal(defaultAgent.type, "ai_agent_full");
    assert.equal(defaultAgent.autoReplyEnabled, true);
    assert.equal(defaultAgent.senderMode, "workspace");
    assert.deepEqual(defaultAgent.pipelineStages, ["new", "collecting"]);

    const repeatedDefault = await ensureDefaultQualificationAgent(scope);
    assert.equal(repeatedDefault.id, defaultAgent.id, "bootstrap should be idempotent");
    assert.equal((await listTeamMembers(scope)).filter((member) => member.name === "Qualification AI").length, 1);

    const duplicateDefault = await createTeamMember({
      ...scope,
      type: "ai_agent_full",
      name: "Qualification AI",
      pipelineStages: ["qualified"],
      autoReplyEnabled: false
    });
    assert.equal(duplicateDefault.id, defaultAgent.id, "creating the default agent again should repair instead of duplicate");
    assert.equal(duplicateDefault.senderMode, "workspace");
    assert.equal((await listTeamMembers(scope)).filter((member) => member.name === "Qualification AI").length, 1);

    const human = await createTeamMember({
      ...scope,
      type: "human",
      name: "Sales Owner",
      emailOrPhone: "sales@example.com",
      role: "manager",
      pipelineStages: ["qualified", "meeting"],
      autoReplyEnabled: false
    });
    assert.equal(human.senderMode, "simulator");
    assert.match(human.simulatorSenderHandle ?? "", /Sales Owner Simulator/);
    assert.match(human.simulatorPhoneNumber ?? "", /^\+1555\d{7}$/);

    const assisted = await createTeamMember({
      ...scope,
      type: "ai_agent_assisted",
      name: "Demo Prep AI",
      role: "agent",
      pipelineStages: ["qualified"],
      autoReplyEnabled: false
    });
    assert.equal(assisted.senderMode, "simulator");
    assert.notEqual(assisted.simulatorPhoneNumber, human.simulatorPhoneNumber, "each member should get a distinct simulated number");

    const repairedDefault = await provisionTeamMemberSender({ ...scope, memberId: defaultAgent.id });
    assert.equal(repairedDefault.member.senderMode, "workspace", "manual repair should preserve default agent workspace sender ownership");

    const inbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_ASSIGNMENT_1",
      from: "whatsapp:+919000000001",
      to: "whatsapp:leadsy-simulator",
      profileName: "Asha Buyer",
      body: "Hello, may i know more about your company?",
      receivedAt: "2026-06-08T04:00:00.000Z"
    });
    assert.equal(inbound.lead.assigneeId, defaultAgent.id);
    assert.equal(inbound.lead.assigneeName, "Qualification AI");
    assert.notEqual(inbound.lead.assigneeName, "WhatsApp sales owner");

    const manualLead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Manual Lead", phone: "+91 90000 00004" },
      channel: "manual",
      direction: "inbound",
      body: "Need qualification",
      occurredAt: "2026-06-08T04:05:00.000Z"
    });
    assert.equal(manualLead.assigneeId, defaultAgent.id);
    assert.equal(manualLead.assigneeName, "Qualification AI");

    const restoredDefault = await assignLeadToDefaultQualificationAgent({
      ...scope,
      leadId: inbound.lead.id,
      assignedById: scope.ownerId,
      assignedByName: "Workspace Owner"
    });
    assert.equal(restoredDefault.assigneeId, defaultAgent.id);

    const reassigned = await assignLeadOwner({
      ...scope,
      leadId: inbound.lead.id,
      assigneeId: human.id,
      assigneeName: human.name,
      assignedById: scope.ownerId,
      assignedByName: "Workspace Owner",
      reason: "Manual owner selected from Leads page"
    });
    assert.equal(reassigned.assigneeId, human.id);
    assert.equal(reassigned.assigneeName, "Sales Owner");
    const history = await listCrmAssignmentHistory(scope, { leadId: inbound.lead.id });
    assert.equal(history.some((entry) => entry.toAssigneeId === human.id && entry.method === "manual"), true);

    const leads = await listLeadKnowledgeRecords(scope);
    assert.equal(leads.some((lead) => lead.assigneeName === "Unassigned"), false);
    assert.equal(leads.some((lead) => /sales owner/i.test(lead.assigneeName ?? "") && lead.assigneeName !== "Sales Owner"), false);

    const legacyScope = { tenantId: "tenant_legacy_assignment", ownerId: "owner_legacy_assignment" };
    await writeFile(join(tempDir, "lead-knowledge.json"), `${JSON.stringify({
      leads: [
        {
          id: "lead_legacy_unassigned",
          ...legacyScope,
          identityKeys: ["phone:15550000000"],
          contact: { displayName: "Legacy Lead", phone: "+15550000000" },
          leadStatus: "lead",
          crmStatus: "new_lead",
          productPipelineStatus: "contacted",
          leadSource: "Twilio Simulator",
          qualificationFields: {},
          qualificationStage: "collecting",
          facts: [],
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      ],
      conversations: [],
      messages: []
    }, null, 2)}\n`);
    const [legacyLead] = await listLeadKnowledgeRecords(legacyScope);
    assert.equal(legacyLead.assigneeName, "Qualification AI", "legacy unassigned leads should be backfilled to the default agent");
    const legacyAgents = await listTeamMembers(legacyScope);
    assert.equal(legacyAgents.filter((member) => member.name === "Qualification AI").length, 1);

    const assignRoute = await readFile(join(process.cwd(), "apps/web/src/app/api/leads/assign/route.ts"), "utf8");
    assert.match(assignRoute, /assignLeadOwner/);
    assert.match(assignRoute, /team_member_not_found/);
    assert.match(assignRoute, /lead_required/);
    assert.match(assignRoute, /assignee_required/);

    const leadsPage = await readFile(join(process.cwd(), "apps/web/src/app/app/leads/page.tsx"), "utf8");
    assert.match(leadsPage, /name="assigneeId"/, "Leads page should render an owner selector");
    assert.match(leadsPage, /\/api\/leads\/assign/, "Leads page assignment should use the dedicated route");
    assert.match(leadsPage, /Assignment history/, "Leads page should show assignment history context");
    assert.match(leadsPage, /senderMode/, "Leads page should show member sender mode");

    const teamspaceConsole = await readFile(join(process.cwd(), "apps/web/src/components/teamspace-console.tsx"), "utf8");
    assert.match(teamspaceConsole, /simulatorPhoneNumber/, "Teamspace should display automatically provisioned simulated numbers");
    assert.doesNotMatch(teamspaceConsole, /Provision simulator sender<\/button>/, "normal member creation should not require a provisioning button");

    console.log("lead assignment agent sender regression passed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
