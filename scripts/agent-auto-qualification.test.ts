import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-agent-runtime-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const { runAgentForInboundLead } = await import("../apps/web/src/lib/agent-runtime");
    const { createTeamMember } = await import("../apps/web/src/lib/teamspace-store");
    const { createCalendarEvent } = await import("../apps/web/src/lib/calendar-store");
    const { saveTwilioInboundMessage, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");

    const scope = { tenantId: "tenant_agents", ownerId: "owner_agents" };
    const qualificationAgent = await createTeamMember({
      ...scope,
      type: "ai_agent_full",
      name: "Qualification AI",
      role: "agent",
      pipelineStages: ["new", "collecting"],
      behaviorInstructions: "Qualify inbound WhatsApp leads.",
      autoReplyEnabled: true,
      escalationKeywords: ["human", "manager"]
    });
    const closer = await createTeamMember({
      ...scope,
      type: "human",
      name: "Account Owner",
      emailOrPhone: "owner@example.com",
      password: "strong-password-2",
      role: "manager",
      pipelineStages: ["qualified", "meeting"],
      autoReplyEnabled: false
    });
    await createCalendarEvent({
      ...scope,
      memberId: closer.id,
      title: "Busy slot",
      startAt: "2026-06-08T05:00:00.000Z",
      endAt: "2026-06-08T05:30:00.000Z",
      status: "confirmed",
      eventType: "meeting"
    });

    const inbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_1",
      from: "whatsapp:+919000000001",
      to: "whatsapp:leadsy-simulator",
      profileName: "Asha Buyer",
      body: "Company: LensMart\nNeed: WhatsApp CRM follow-up\nTimeline: today",
      receivedAt: "2026-06-08T04:00:00.000Z"
    });
    const run = await runAgentForInboundLead({
      ...scope,
      leadId: inbound.lead.id,
      conversationId: inbound.conversation.id,
      triggerMessageId: inbound.saved[0].id,
      now: "2026-06-08T04:01:00.000Z"
    });
    assert.equal(run.action, "auto_replied");
    assert.equal(run.memberId, qualificationAgent.id);
    assert.match(run.replyBody ?? "", /budget|scope|goal|decision|volume/i);

    const afterReply = (await listLeadKnowledgeRecords(scope)).find((lead) => lead.id === inbound.lead.id);
    assert.equal(afterReply?.messages.filter((message) => message.direction === "outbound").length, 1);

    const duplicate = await runAgentForInboundLead({
      ...scope,
      leadId: inbound.lead.id,
      conversationId: inbound.conversation.id,
      triggerMessageId: inbound.saved[0].id,
      now: "2026-06-08T04:02:00.000Z"
    });
    assert.equal(duplicate.action, "skipped_loop_guard");

    const qualifiedInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_2",
      from: "whatsapp:+919000000002",
      to: "whatsapp:leadsy-simulator",
      profileName: "Rohan Founder",
      body: "Name: Rohan\nPhone: +919000000002\nCompany: Buyer Labs\nNeed: CRM automation\nBudget: ₹50000\nTimeline: tomorrow\nI am the decision maker",
      receivedAt: "2026-06-08T04:10:00.000Z"
    });
    const qualifiedRun = await runAgentForInboundLead({
      ...scope,
      leadId: qualifiedInbound.lead.id,
      conversationId: qualifiedInbound.conversation.id,
      triggerMessageId: qualifiedInbound.saved[0].id,
      now: "2026-06-08T04:11:00.000Z"
    });
    assert.equal(qualifiedRun.action, "assigned_to_pipeline_owner");
    assert.equal(qualifiedRun.assignedMemberId, closer.id);
    assert.match(qualifiedRun.replyBody ?? "", /04:30|05:30|06:00|available/i, "qualified replies should use native calendar free slots");

    const escalationInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_3",
      from: "whatsapp:+919000000003",
      to: "whatsapp:leadsy-simulator",
      profileName: "Escalate Buyer",
      body: "Please connect me to a human manager.",
      receivedAt: "2026-06-08T04:20:00.000Z"
    });
    const escalation = await runAgentForInboundLead({
      ...scope,
      leadId: escalationInbound.lead.id,
      conversationId: escalationInbound.conversation.id,
      triggerMessageId: escalationInbound.saved[0].id,
      now: "2026-06-08T04:21:00.000Z"
    });
    assert.equal(escalation.action, "escalated_to_human");

    const communicationsConsole = await readFile(join(process.cwd(), "apps/web/src/components/communications-console.tsx"), "utf8");
    assert.match(communicationsConsole, /conversation=/, "Inbox rows should route by conversation query param");
    assert.match(communicationsConsole, /Internal team thread/, "Inbox should expose the internal team thread");
    assert.match(communicationsConsole, /Auto-reply/, "Inbox should show auto-reply state");

    const appShell = await readFile(join(process.cwd(), "apps/web/src/components/app-shell.tsx"), "utf8");
    assert.match(appShell, /\/app\/calendar/, "Primary navigation should include Calendar");

    const calendarPage = await readFile(join(process.cwd(), "apps/web/src/app/app/calendar/page.tsx"), "utf8");
    for (const label of ["Month", "Week", "Day", "List", "Availability", "Meetings"]) {
      assert.match(calendarPage, new RegExp(label), `Calendar view should render ${label}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
