import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-team-chat-routing-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const { appendManualLeadMessage } = await import("../apps/web/src/lib/lead-knowledge-store");
    const {
      createTeamMember,
      ensureDefaultQualificationAgent,
      listTeamThreadMessages,
      parseAiMentions,
      postTeamThreadMessage,
      postWorkspaceTeamEvent,
      runMentionedAgentOnce
    } = await import("../apps/web/src/lib/teamspace-store");
    const { assignLeadOwner, listCrmFollowUpTasks, routeCrmEventToTasks } = await import("../apps/web/src/lib/crm-store");
    const { buildLeadBackedInboxItems } = await import("../apps/web/src/lib/inbox-stabilization");
    const { listNotificationRecords } = await import("../apps/web/src/lib/user-settings-store");
    const { handleTeamChatAssignmentCommand } = await import("../apps/web/src/lib/team-chat-commands");

    const scope = { tenantId: "tenant_team_chat", ownerId: "owner_team_chat" };
    const qualificationAi = await ensureDefaultQualificationAgent(scope);
    const human = await createTeamMember({
      ...scope,
      type: "human",
      name: "Vedant Human",
      emailOrPhone: "vedant@example.com",
      role: "agent",
      pipelineStages: ["qualified"],
      autoReplyEnabled: false
    });
    const assistedAi = await createTeamMember({
      ...scope,
      type: "ai_agent_assisted",
      name: "Proposal AI",
      role: "agent",
      pipelineStages: ["proposal"],
      autoReplyEnabled: false
    });

    const lead = await appendManualLeadMessage({
      ...scope,
      contact: { displayName: "Asha Buyer", phone: "+91 90000 00001" },
      channel: "whatsapp",
      direction: "inbound",
      body: "Company: LensMart\nNeed: WhatsApp CRM\nTimeline: this week",
      occurredAt: "2026-06-08T05:00:00.000Z"
    });
    await appendManualLeadMessage({
      ...scope,
      contact: lead.contact,
      channel: "email",
      direction: "inbound",
      body: "Please send the pricing sheet.",
      occurredAt: "2026-06-08T05:05:00.000Z"
    });
    await appendManualLeadMessage({
      ...scope,
      contact: lead.contact,
      channel: "call",
      direction: "inbound",
      body: "Logged discovery call.",
      occurredAt: "2026-06-08T05:10:00.000Z"
    });

    const inboxItem = buildLeadBackedInboxItems((await import("../apps/web/src/lib/lead-knowledge-store")).listLeadKnowledgeRecords ? await (await import("../apps/web/src/lib/lead-knowledge-store")).listLeadKnowledgeRecords(scope) : []);
    assert.equal(inboxItem.length, 1, "Inbox should remain lead-first even when a lead has multiple channels");
    assert.deepEqual(
      inboxItem[0].channelTabs.map((tab) => tab.channel),
      ["whatsapp", "email", "call"],
      "Inbox item should expose per-lead channel tabs"
    );

    const workspaceEvent = await postWorkspaceTeamEvent({
      ...scope,
      body: "Lead Asha Buyer assigned from Qualification AI to Vedant Human.",
      eventType: "assignment_changed",
      leadId: lead.id,
      triggerId: "assignment:event:1"
    });
    assert.equal(workspaceEvent.threadScope, "workspace");
    assert.equal(workspaceEvent.visibility, "internal");

    await assignLeadOwner({
      ...scope,
      leadId: lead.id,
      assigneeId: human.id,
      assigneeName: human.name,
      assignedByName: "Qualification AI",
      reason: "Qualified threshold met"
    });
    const workspaceMessages = await listTeamThreadMessages({ ...scope, threadScope: "workspace" });
    assert(
      workspaceMessages.some((message) => message.eventType === "assignment_changed" && /Asha Buyer.*Qualification AI.*Vedant Human/.test(message.body)),
      "Assignment changes should appear in the workspace team chat"
    );
    const assignmentNotifications = await listNotificationRecords(scope);
    assert(
      assignmentNotifications.some((notification) => notification.targetRole === "owner" && /Asha Buyer.*Vedant Human/i.test(notification.detail)),
      "Assignment should notify the workspace owner"
    );
    assert(
      assignmentNotifications.some((notification) => notification.targetRole === "assignee" && notification.targetMemberId === human.id),
      "Assignment should create a targeted notification for the assignee"
    );

    const ordinaryHumanMessage = await postTeamThreadMessage({
      ...scope,
      threadScope: "workspace",
      authorType: "human",
      authorMemberId: human.id,
      body: "Can someone check this lead?",
      eventType: "internal_note"
    });
    const noMention = await runMentionedAgentOnce({ ...scope, messageId: ordinaryHumanMessage.id });
    assert.equal(noMention.action, "no_mention", "AI agents should not reply to ordinary workspace chat");

    const chatAssigned = await handleTeamChatAssignmentCommand({
      ...scope,
      body: "assign Asha Buyer to @Proposal AI",
      assignedById: human.id,
      assignedByName: human.name
    });
    assert.equal(chatAssigned.action, "assigned", "Team chat assignment commands should assign the lead");
    assert.equal(chatAssigned.lead?.assigneeId, assistedAi.id, "Team chat assignment should use the matched member id");
    const messagesAfterChatAssignment = await listTeamThreadMessages({ ...scope, threadScope: "workspace" });
    assert(
      messagesAfterChatAssignment.some((message) => message.eventType === "assignment_changed" && /Asha Buyer.*Proposal AI/.test(message.body)),
      "Team chat assignment commands should surface assignment events in the workspace chat"
    );

    const mentionedHumanMessage = await postTeamThreadMessage({
      ...scope,
      threadScope: "workspace",
      authorType: "human",
      authorMemberId: human.id,
      body: "@Proposal AI summarize this lead and draft the next task.",
      eventType: "ai_mention",
      leadId: lead.id,
      triggerId: "mention:event:1"
    });
    assert.deepEqual(parseAiMentions(mentionedHumanMessage.body, [qualificationAi, assistedAi]).map((member) => member.name), ["Proposal AI"]);
    const mentionRun = await runMentionedAgentOnce({ ...scope, messageId: mentionedHumanMessage.id });
    assert.equal(mentionRun.action, "responded");
    const duplicateMentionRun = await runMentionedAgentOnce({ ...scope, messageId: mentionedHumanMessage.id });
    assert.equal(duplicateMentionRun.action, "skipped_duplicate", "Mentioned AI turns should dedupe by trigger");

    const humanTask = await routeCrmEventToTasks({
      ...scope,
      eventType: "assignment_changed",
      leadId: lead.id,
      assigneeId: human.id,
      source: "assignment",
      reason: "Human owner needs follow-up"
    });
    assert.equal(humanTask.destination, "human_tasks");
    const aiTask = await routeCrmEventToTasks({
      ...scope,
      eventType: "meeting_created",
      leadId: lead.id,
      assigneeId: assistedAi.id,
      source: "calendar",
      reason: "AI should prepare a meeting brief"
    });
    assert.equal(aiTask.destination, "ai_approvals");
    const duplicateAiTask = await routeCrmEventToTasks({
      ...scope,
      eventType: "meeting_created",
      leadId: lead.id,
      assigneeId: assistedAi.id,
      source: "calendar",
      reason: "AI should prepare a meeting brief"
    });
    assert.equal(duplicateAiTask.task.id, aiTask.task.id, "CRM event routing should reuse existing open tasks");

    const tasks = await listCrmFollowUpTasks(scope, { includeClosed: true });
    assert(tasks.filter((task) => task.destination === "human_tasks").length >= 1);
    assert(tasks.filter((task) => task.destination === "ai_approvals").length >= 1);

    const shellSource = await readFile(join(process.cwd(), "apps/web/src/components/app-shell.tsx"), "utf8");
    assert.match(shellSource, /\/app\/team-chat/, "primary sidebar should link to workspace Team Chat");
    assert.doesNotMatch(shellSource, /Automations/, "retired Automations label should remain absent");

    const leadsSource = await readFile(join(process.cwd(), "apps/web/src/app/app/leads/page.tsx"), "utf8");
    for (const label of ["WhatsApp", "Email", "Calls"]) {
      assert.match(leadsSource, new RegExp(label), `Lead Comms tab should render ${label} subtab`);
    }

    const communicationsSource = await readFile(join(process.cwd(), "apps/web/src/components/communications-console.tsx"), "utf8");
    for (const label of ["WhatsApp", "Email", "Calls"]) {
      assert.match(communicationsSource, new RegExp(label), `Inbox active panel should render ${label} subtab`);
    }
    assert.match(communicationsSource, /tab=comms/, "Open lead links should use the canonical Comms tab");

    const approvalsSource = await readFile(join(process.cwd(), "apps/web/src/app/app/approvals/page.tsx"), "utf8");
    assert.match(approvalsSource, /ai_approvals/, "Approval queue should include AI-routed tasks");
    assert.match(approvalsSource, /ApprovalsConsole/, "Approval queue should use a client console for live search and filters");
    const approvalsConsoleSource = await readFile(join(process.cwd(), "apps/web/src/components/approvals-console.tsx"), "utf8");
    assert.match(approvalsConsoleSource, /approvalSearchRef/, "Approval queue should expose a focusable search ref");
    assert.match(approvalsConsoleSource, /handleApprovalsShortcut/, "Approval queue should focus search with the / shortcut");
    assert.match(approvalsConsoleSource, /selectedKind/, "Approval queue tabs should filter by approval kind");
    assert.match(approvalsConsoleSource, /groupBy/, "Approval queue grouping should be wired");

    const tasksSource = await readFile(join(process.cwd(), "apps/web/src/app/app/tasks/page.tsx"), "utf8");
    assert.match(tasksSource, /human_tasks/, "Tasks page should filter to human-routed tasks");
    assert.match(tasksSource, /TasksConsole/, "Tasks page should use a client console for live search and grouping");
    const tasksConsoleSource = await readFile(join(process.cwd(), "apps/web/src/components/tasks-console.tsx"), "utf8");
    assert.match(tasksConsoleSource, /taskSearchRef/, "Tasks page should expose a focusable search ref");
    assert.match(tasksConsoleSource, /handleTasksShortcut/, "Tasks page should focus search with the / shortcut");
    assert.match(tasksConsoleSource, /groupBy/, "Tasks grouping by status, priority, and owner should be wired");

    const teamChatSource = await readFile(join(process.cwd(), "apps/web/src/components/team-chat-console.tsx"), "utf8");
    assert.match(teamChatSource, /mentionQuery/, "Team chat should open an inline @ mention picker");
    assert.match(teamChatSource, /suggestedMembers/, "Team chat should suggest members while typing @");
    assert.match(teamChatSource, /insertMention/, "Team chat should insert exact @Member mentions");
    assert.match(teamChatSource, /messagesEndRef/, "Team chat should keep a bottom sentinel for default scrolling");
    assert.match(teamChatSource, /scrollIntoView/, "Team chat should scroll to the latest message by default");
    assert.match(teamChatSource, /assignment_changed/, "Team chat should render assignment events distinctly");
    assert.match(teamChatSource, /whatsapp-chat-bubble/, "Team chat should render WhatsApp-style chat bubbles");
    const teamChatRouteSource = await readFile(join(process.cwd(), "apps/web/src/app/api/team-chat/messages/route.ts"), "utf8");
    assert.match(teamChatRouteSource, /handleTeamChatAssignmentCommand/, "Team chat messages should route layman assignment commands");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
