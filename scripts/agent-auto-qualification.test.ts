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
    const { assignLeadOwner, listCrmFollowUpTasks } = await import("../apps/web/src/lib/crm-store");

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

    const retainerAi = await createTeamMember({
      ...scope,
      type: "ai_agent_full",
      name: "Retainer AI",
      role: "agent",
      pipelineStages: ["collecting"],
      behaviorInstructions: "Represent the owner's company and answer content retainer questions.",
      autoReplyEnabled: true,
      escalationKeywords: ["human"]
    });
    await assignLeadOwner({
      ...scope,
      leadId: inbound.lead.id,
      assigneeId: retainerAi.id,
      assigneeName: retainerAi.name,
      assignedByName: "Account Owner",
      reason: "Retainer stage owner"
    });
    const followUpInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_1_FOLLOWUP",
      from: "whatsapp:+919000000001",
      to: "whatsapp:leadsy-simulator",
      profileName: "Asha Buyer",
      body: "what are your services?",
      receivedAt: "2026-06-08T04:03:00.000Z"
    });
    const assignedAiRun = await runAgentForInboundLead({
      ...scope,
      leadId: followUpInbound.lead.id,
      conversationId: followUpInbound.conversation.id,
      triggerMessageId: followUpInbound.saved[0].id,
      now: "2026-06-08T04:04:00.000Z"
    });
    assert.equal(assignedAiRun.action, "auto_replied");
    assert.equal(assignedAiRun.memberId, retainerAi.id, "current full AI assignee should handle new inbound messages");
    assert.doesNotMatch(assignedAiRun.replyBody ?? "", /Leadsy|Qualification AI/i);

    const servicesInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_SERVICES_1",
      from: "whatsapp:+919000000007",
      to: "whatsapp:leadsy-simulator",
      profileName: "Pratik",
      body: "I want to know more about your services",
      receivedAt: "2026-06-08T04:30:00.000Z"
    });
    const servicesRun = await runAgentForInboundLead({
      ...scope,
      leadId: servicesInbound.lead.id,
      conversationId: servicesInbound.conversation.id,
      triggerMessageId: servicesInbound.saved[0].id,
      now: "2026-06-08T04:31:00.000Z"
    });
    assert.equal(servicesRun.action, "auto_replied");
    assert.match(servicesRun.replyBody ?? "", /help|service|offer|support|work with/i, "service questions should get an educational answer");
    assert.doesNotMatch(servicesRun.replyBody ?? "", /^We can help with your requirement\. Which company or brand is this for\?$/i);

    const personalInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_SERVICES_2",
      from: "whatsapp:+919000000007",
      to: "whatsapp:leadsy-simulator",
      profileName: "Pratik",
      body: "this is for me, pratik",
      receivedAt: "2026-06-08T04:32:00.000Z"
    });
    const personalRun = await runAgentForInboundLead({
      ...scope,
      leadId: personalInbound.lead.id,
      conversationId: personalInbound.conversation.id,
      triggerMessageId: personalInbound.saved[0].id,
      now: "2026-06-08T04:33:00.000Z"
    });
    assert.equal(personalRun.action, "auto_replied");
    assert.doesNotMatch(personalRun.replyBody ?? "", /Which company or brand is this for\?/i, "personal enquiries should not loop on company");

    const repeatedServicesInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_SERVICES_3",
      from: "whatsapp:+919000000007",
      to: "whatsapp:leadsy-simulator",
      profileName: "Pratik",
      body: "i want to know more about your services",
      receivedAt: "2026-06-08T04:34:00.000Z"
    });
    const repeatedServicesRun = await runAgentForInboundLead({
      ...scope,
      leadId: repeatedServicesInbound.lead.id,
      conversationId: repeatedServicesInbound.conversation.id,
      triggerMessageId: repeatedServicesInbound.saved[0].id,
      now: "2026-06-08T04:35:00.000Z"
    });
    assert.equal(repeatedServicesRun.action, "auto_replied");
    assert.notEqual(repeatedServicesRun.replyBody, servicesRun.replyBody, "repeated service questions should not receive the identical looped reply");

    const companyInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_SERVICES_4",
      from: "whatsapp:+919000000007",
      to: "whatsapp:leadsy-simulator",
      profileName: "Pratik",
      body: "this is for AlaskaTourism",
      receivedAt: "2026-06-08T04:36:00.000Z"
    });
    const companyRun = await runAgentForInboundLead({
      ...scope,
      leadId: companyInbound.lead.id,
      conversationId: companyInbound.conversation.id,
      triggerMessageId: companyInbound.saved[0].id,
      now: "2026-06-08T04:37:00.000Z"
    });
    assert(["auto_replied", "assigned_to_pipeline_owner", "no_action"].includes(companyRun.action));
    assert.notEqual(companyRun.action, "skipped_loop_guard", "new inbound company details should not be swallowed by the loop guard");
    const companyTasks = await listCrmFollowUpTasks(scope, { leadId: companyInbound.lead.id });
    assert(
      companyRun.action !== "no_action" || companyTasks.length > 0,
      "if the agent does not reply after company details, the lead should still get a visible task"
    );

    const duplicate = await runAgentForInboundLead({
      ...scope,
      leadId: inbound.lead.id,
      conversationId: inbound.conversation.id,
      triggerMessageId: inbound.saved[0].id,
      now: "2026-06-08T04:02:00.000Z"
    });
    assert.equal(duplicate.action, "skipped_loop_guard");

    const humanLeadInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_HUMAN_ASSIGNEE",
      from: "whatsapp:+919000000004",
      to: "whatsapp:leadsy-simulator",
      profileName: "Human Lead",
      body: "I want to speak with sales about services.",
      receivedAt: "2026-06-08T04:05:00.000Z"
    });
    await assignLeadOwner({
      ...scope,
      leadId: humanLeadInbound.lead.id,
      assigneeId: closer.id,
      assigneeName: closer.name,
      assignedByName: "Account Owner",
      reason: "Human owns this enquiry"
    });
    const humanRun = await runAgentForInboundLead({
      ...scope,
      leadId: humanLeadInbound.lead.id,
      conversationId: humanLeadInbound.conversation.id,
      triggerMessageId: humanLeadInbound.saved[0].id,
      now: "2026-06-08T04:06:00.000Z"
    });
    assert.equal(humanRun.action, "no_action");
    assert.equal(humanRun.responderMemberId, closer.id);
    assert.match(humanRun.reason ?? "", /human/i);
    const humanTasks = await listCrmFollowUpTasks(scope, { leadId: humanLeadInbound.lead.id });
    assert(humanTasks.some((task) => task.destination === "human_tasks" && task.assigneeId === closer.id), "human assignee should receive a task instead of an AI auto-reply");

    const assistedAi = await createTeamMember({
      ...scope,
      type: "ai_agent_assisted",
      name: "Assisted AI",
      role: "agent",
      pipelineStages: ["collecting"],
      autoReplyEnabled: true
    });
    const assistedLeadInbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_ASSISTED_ASSIGNEE",
      from: "whatsapp:+919000000005",
      to: "whatsapp:leadsy-simulator",
      profileName: "Assisted Lead",
      body: "Can you prepare a proposal?",
      receivedAt: "2026-06-08T04:07:00.000Z"
    });
    await assignLeadOwner({
      ...scope,
      leadId: assistedLeadInbound.lead.id,
      assigneeId: assistedAi.id,
      assigneeName: assistedAi.name,
      assignedByName: "Account Owner",
      reason: "Needs AI-assisted review"
    });
    const assistedRun = await runAgentForInboundLead({
      ...scope,
      leadId: assistedLeadInbound.lead.id,
      conversationId: assistedLeadInbound.conversation.id,
      triggerMessageId: assistedLeadInbound.saved[0].id,
      now: "2026-06-08T04:08:00.000Z"
    });
    assert.equal(assistedRun.action, "no_action");
    assert.equal(assistedRun.responderMemberId, assistedAi.id);
    assert.match(assistedRun.reason ?? "", /approval|assisted/i);
    const assistedTasks = await listCrmFollowUpTasks(scope, { leadId: assistedLeadInbound.lead.id });
    assert(assistedTasks.some((task) => task.destination === "ai_approvals" && task.assigneeId === assistedAi.id), "assisted AI assignee should route to approval queue");

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
    assert.match(qualifiedRun.replyBody ?? "", /10:00|10:30|11:00|available|slot/i, "qualified replies should use native calendar free slots");

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

    const calendarConsole = await readFile(join(process.cwd(), "apps/web/src/components/calendar-console.tsx"), "utf8");
    for (const label of ["Month", "Week", "Day", "Year", "Availability", "Meeting"]) {
      assert.match(calendarConsole, new RegExp(label), `Calendar view should render ${label}`);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
