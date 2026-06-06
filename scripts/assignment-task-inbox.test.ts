import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-assignment-task-inbox-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const { appendManualLeadMessage, editLeadKnowledgeRecord, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { buildLeadBackedInboxItems } = await import("../apps/web/src/lib/inbox-stabilization");
    const {
      addCrmTaskNote,
      assignLeadByRoundRobin,
      assignLeadBySource,
      assignLeadOwner,
      createCrmFollowUpTask,
      listCrmAssignmentHistory,
      listCrmFollowUpTasks,
      updateCrmFollowUpTask,
      upsertCrmAssignmentRule
    } = await import("../apps/web/src/lib/crm-store");

    const scope = { tenantId: "tenant_assignment", ownerId: "owner_assignment" };

    const manualLead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Manual Owner Lead", phone: "+91 90000 00001" },
      channel: "manual",
      direction: "inbound",
      body: "Need a review call tomorrow",
      occurredAt: "2026-06-06T08:00:00.000Z"
    });
    const assignedManual = await assignLeadOwner({
      ...scope,
      leadId: manualLead.id,
      assigneeId: scope.ownerId,
      assigneeName: "Current Agent",
      assignedById: "manager_1",
      assignedByName: "Sales Manager"
    });
    assert.equal(assignedManual.assigneeName, "Current Agent");

    const roundRobinOne = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Round Robin One", phone: "+91 90000 00002" },
      channel: "manual",
      direction: "inbound",
      body: "Need WhatsApp follow up",
      occurredAt: "2026-06-06T08:01:00.000Z"
    });
    const roundRobinTwo = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Round Robin Two", phone: "+91 90000 00003" },
      channel: "manual",
      direction: "inbound",
      body: "Need a site visit",
      occurredAt: "2026-06-06T08:02:00.000Z"
    });
    const candidates = [
      { assigneeId: "agent_a", assigneeName: "Agent A" },
      { assigneeId: "agent_b", assigneeName: "Agent B" }
    ];
    const firstRoundRobin = await assignLeadByRoundRobin({ ...scope, leadId: roundRobinOne.id, candidates });
    const secondRoundRobin = await assignLeadByRoundRobin({ ...scope, leadId: roundRobinTwo.id, candidates });
    assert.equal(firstRoundRobin.assigneeName, "Agent A");
    assert.equal(secondRoundRobin.assigneeName, "Agent B", "round robin should choose the currently lighter owner");

    await upsertCrmAssignmentRule({
      ...scope,
      title: "Meta Leads to Sales Team",
      sourceIncludes: "Meta Leads",
      assigneeId: "sales_team",
      assigneeName: "Sales Team"
    });
    await upsertCrmAssignmentRule({
      ...scope,
      title: "Website Leads to SDR Team",
      sourceIncludes: "Website Leads",
      assigneeId: "sdr_team",
      assigneeName: "SDR Team"
    });

    const sourceLead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Website Buyer", phone: "+91 90000 00004" },
      channel: "whatsapp",
      direction: "inbound",
      body: "Company: Buyer Labs\nNeed: CRM automation\nTimeline: this week",
      occurredAt: "2026-06-06T08:03:00.000Z"
    });
    await editLeadKnowledgeRecord({
      ...scope,
      leadId: sourceLead.id,
      leadSource: "Website Leads",
      qualificationStage: "qualified",
      crmStatus: "interested"
    });
    const routedSourceLead = await assignLeadBySource({ ...scope, leadId: sourceLead.id });
    assert.equal(routedSourceLead.assigneeName, "SDR Team");

    const history = await listCrmAssignmentHistory(scope);
    assert.equal(history.some((entry) => entry.leadId === manualLead.id && entry.method === "manual"), true);
    assert.equal(history.some((entry) => entry.leadId === roundRobinOne.id && entry.method === "round_robin"), true);
    assert.equal(history.some((entry) => entry.leadId === sourceLead.id && entry.method === "source_based"), true);

    const delegatedTask = await createCrmFollowUpTask({
      ...scope,
      leadId: sourceLead.id,
      type: "call",
      topic: "Qualify decision maker",
      description: "Manager assigned call before demo slot confirmation.",
      priority: "high",
      assigneeId: "agent_b",
      assigneeName: "Agent B",
      dueAt: "2026-06-07T04:30:00.000Z",
      createdByRole: "manager"
    });
    await addCrmTaskNote({
      ...scope,
      taskId: delegatedTask.id,
      authorId: "agent_b",
      authorName: "Agent B",
      note: "Lead asked for WhatsApp follow-up after the call."
    });
    const completedTask = await updateCrmFollowUpTask({
      ...scope,
      taskId: delegatedTask.id,
      status: "done"
    });
    assert.equal(completedTask.type, "call");
    assert.equal(completedTask.status, "done");

    const allTasks = await listCrmFollowUpTasks(scope, { leadId: sourceLead.id, includeClosed: true });
    assert.equal(allTasks[0].notes?.[0]?.note, "Lead asked for WhatsApp follow-up after the call.");
    assert.equal(allTasks[0].createdByRole, "manager");

    const leads = await listLeadKnowledgeRecords(scope);
    const trackedManualLead = leads.find((lead) => lead.id === manualLead.id);
    assert.equal(trackedManualLead?.conversations.length, 1, "manual lead creation should create a tracked conversation");
    assert.equal(trackedManualLead?.messages.length, 1, "manual lead creation should create an initial tracked message");
    const inboxItems = buildLeadBackedInboxItems(leads);
    const sourceInboxItem = inboxItems.find((item) => item.leadId === sourceLead.id);
    const manualInboxItem = inboxItems.find((item) => item.leadId === manualLead.id);
    assert.ok(sourceInboxItem);
    assert.equal(sourceInboxItem.owner, "SDR Team");
    assert.match(sourceInboxItem.qualification, /qualified/i);
    assert.equal(sourceInboxItem.lastMessage, sourceInboxItem.preview);
    assert.equal(sourceInboxItem.lastActivity, sourceInboxItem.time);
    assert.equal(sourceInboxItem.needsReply, true);
    assert.equal(manualInboxItem?.assignedToMe, true);

    const communicationsSource = await readFile(join(process.cwd(), "apps/web/src/app/app/communications/page.tsx"), "utf8");
    for (const requiredLabel of ["Unread", "Needs Reply", "Assigned To Me", "All Conversations", "Last Message", "Owner", "Qualification", "Last Activity"]) {
      assert.match(communicationsSource, new RegExp(requiredLabel), `Inbox surface should include ${requiredLabel}`);
    }
    assert.match(communicationsSource, /InboxReplyComposer/, "Inbox should render the real WhatsApp reply composer");
    assert.match(communicationsSource, /deliveryStatus/, "Inbox should expose delivery status on outbound messages");
    const composerSource = await readFile(join(process.cwd(), "apps/web/src/components/inbox-reply-composer.tsx"), "utf8");
    assert.match(composerSource, /\/api\/twilio\/messages/, "Inbox replies should send through the Twilio messages API");
    assert.match(composerSource, /senderStatus !== "approved"/, "Inbox replies should be disabled until the workspace sender is approved");

    const tasksSource = await readFile(join(process.cwd(), "apps/web/src/app/app/tasks/page.tsx"), "utf8");
    for (const taskType of ["Call", "WhatsApp Follow-Up", "Meeting", "Site Visit", "Review Lead", "Custom"]) {
      assert.match(tasksSource, new RegExp(taskType), `Task surface should include ${taskType}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
