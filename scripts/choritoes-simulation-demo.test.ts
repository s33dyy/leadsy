import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

type Json = Record<string, any>;

async function readJson(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as Json;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function mockOpenRouter() {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    const requestBody = JSON.parse(String(init?.body ?? "{}"));
    const userMessage = requestBody.messages?.find((message: Json) => message.role === "user")?.content ?? "{}";
    const context = JSON.parse(userMessage);
    const leadName = String(context.lead?.name ?? "there").split(/\s+/)[0] || "there";
    const businessName = context.ownerBusiness?.businessName ?? "Choritoes";
    const services = Array.isArray(context.ownerBusiness?.services) && context.ownerBusiness.services.length
      ? context.ownerBusiness.services.slice(0, 3).join(", ")
      : "corn chips retail and distribution supply";
    const latestInbound = [...(context.recentMessages ?? [])].reverse().find((message: Json) => message.direction === "inbound")?.body ?? "";
    const lower = latestInbound.toLowerCase();
    const extractedFields: Record<string, string> = {};
    const companyMatch = latestInbound.match(/\bfrom\s+([A-Z][A-Za-z0-9& .'/-]{2,45})/);
    if (companyMatch) extractedFields.company = companyMatch[1].replace(/[.?!].*$/, "").trim();
    if (/distributor|retail|school|canteen|cafe|supermarket|wedding|event|kirana|modern trade/i.test(latestInbound)) {
      extractedFields.need = latestInbound.slice(0, 110);
    }
    if (/budget|₹|rs\.?|rupees|case|carton|monthly|week|urgent|sample|approval|owner|purchase/i.test(lower)) {
      if (/₹|rs\.?|rupees|budget/i.test(lower)) extractedFields.budget = "Captured from lead message";
      if (/today|tomorrow|week|month|urgent|launch/i.test(lower)) extractedFields.timeline = "Captured from lead message";
      if (/owner|founder|purchase|manager|approval/i.test(lower)) extractedFields.authority = "Captured from lead message";
    }
    const reply = `${businessName} can help with ${services}. ${leadName}, what monthly carton volume should we plan for first?`;
    return new Response(JSON.stringify({
      id: `mock-openrouter-${calls}`,
      model: requestBody.model,
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
        reply,
        extractedFields,
        crmNote: `Choritoes AI handled ${leadName} with context from ${businessName}.`,
        nextMissingField: "volume",
        shouldEscalate: false,
        confidence: 0.86
      }) } }],
      usage: {
        prompt_tokens: 900,
        completion_tokens: 120,
        total_tokens: 1020,
        cost: 0.0015
      }
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return {
    calls: () => calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    }
  };
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), "leadsy-choritoes-seed-"));
  const dataDir = join(root, "data");
  await mkdir(dataDir, { recursive: true });
  process.env.LEADSY_DATA_DIR = dataDir;
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.AI_DEFAULT_MODEL = "mock/choritoes-mini";
  process.env.USD_INR_RATE = "83";

  const targetOwner = {
    id: "usr_pratik",
    tenantId: "tenant_pratik",
    name: "Pratik Choudhuri",
    emailOrPhone: "pratikisawesom3@gmail.com",
    normalizedLogin: "pratikisawesom3@gmail.com",
    passwordHash: "owner_hash",
    role: "owner",
    createdAt: "2026-06-01T00:00:00.000Z"
  };
  const otherOwner = {
    id: "usr_other",
    tenantId: "tenant_other",
    name: "Other Owner",
    emailOrPhone: "other@example.com",
    normalizedLogin: "other@example.com",
    passwordHash: "other_hash",
    role: "owner",
    createdAt: "2026-06-01T00:00:00.000Z"
  };

  await writeJson(join(dataDir, "auth.json"), {
    users: [
      targetOwner,
      otherOwner,
      {
        id: "usr_old_pratik_team",
        tenantId: targetOwner.tenantId,
        teamMemberId: "tm_old_pratik_team",
        name: "Old Team",
        emailOrPhone: "old-team@example.com",
        normalizedLogin: "old-team@example.com",
        passwordHash: "old_hash",
        role: "sdr"
      }
    ],
    sessions: [
      { id: "sess_pratik", tenantId: targetOwner.tenantId, userId: targetOwner.id },
      { id: "sess_old_team", tenantId: targetOwner.tenantId, userId: "usr_old_pratik_team" },
      { id: "sess_other", tenantId: otherOwner.tenantId, userId: otherOwner.id }
    ]
  });
  await writeJson(join(dataDir, "lead-knowledge.json"), {
    leads: [{ id: "old_pratik_lead", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }, { id: "other_lead", tenantId: otherOwner.tenantId, ownerId: otherOwner.id }],
    conversations: [{ id: "old_pratik_conv", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    messages: [{ id: "old_pratik_msg", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "lead-crm.json"), {
    assignmentRules: [{ id: "old_rule", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    assignmentHistory: [{ id: "old_history", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    followUpTasks: [{ id: "old_task", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    qualificationProfiles: [{ id: "old_profile", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "teamspace.json"), {
    members: [{ id: "tm_old_pratik_team", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }],
    threadMessages: [{ id: "old_thread", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "calendar.json"), {
    events: [{ id: "old_event", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });
  await writeJson(join(dataDir, "workspace-whatsapp-senders.json"), {
    senders: [{ tenantId: targetOwner.tenantId, ownerId: targetOwner.id, status: "approved", transportMode: "simulator" }]
  });
  await writeJson(join(dataDir, "twilio-integration.json"), {
    [targetOwner.tenantId]: { lastWebhookAt: "old" },
    [otherOwner.tenantId]: { keep: true }
  });
  await writeJson(join(dataDir, "user-settings.json"), {
    workspaces: [{ tenantId: targetOwner.tenantId, ownerId: targetOwner.id, notificationRecords: [{ id: "old_notification" }] }]
  });
  await writeJson(join(dataDir, "ai-usage.json"), {
    runs: [],
    agentRuns: [{ id: "old_ai", tenantId: targetOwner.tenantId, ownerId: targetOwner.id }]
  });

  const seed = await import("../apps/web/src/lib/choritoes-simulation-demo-seed");
  await assert.rejects(
    () => seed.seedChoritoesSimulationDemo({ email: "missing@example.com", confirm: "missing@example.com", dataDir }),
    /target_account_not_found/
  );
  await assert.rejects(
    () => seed.seedChoritoesSimulationDemo({ email: targetOwner.emailOrPhone, confirm: "wrong", dataDir }),
    /confirmation_required/
  );
  delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(
    () => seed.seedChoritoesSimulationDemo({ email: targetOwner.emailOrPhone, confirm: targetOwner.emailOrPhone, dataDir }),
    /openrouter_required/
  );
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";

  const openRouter = mockOpenRouter();
  try {
    const result = await seed.seedChoritoesSimulationDemo({
      email: targetOwner.emailOrPhone,
      confirm: targetOwner.emailOrPhone,
      dataDir,
      mode: "stress"
    });
    assert.equal(result.ok, true);
    assert.equal(result.owner.id, targetOwner.id);
    assert.equal(result.counts.leads, 75);
    assert.equal(result.counts.whatsappConversations, 70);
    assert.equal(result.counts.whatsappFirstDeepLeads, 60);
    assert.equal(result.counts.mixedChannelLeads, 10);
    assert.equal(result.counts.emailCallHeavyLeads, 5);
    assert(result.counts.whatsappInboundMessages >= 660);
    assert(result.counts.whatsappOutboundMessages > 0);
    assert(result.counts.documentedSkippedInboundTurns > 0);
    assert(result.counts.emailActivities > 0);
    assert(result.counts.callActivities > 0);
    assert(result.counts.calendarEvents > 0);
    assert(result.counts.humanTasks > 0);
    assert(result.counts.aiApprovalTasks > 0);
    assert(result.counts.openRouterRequests >= 120);
    assert(result.counts.projectedSimulatorMessages > 0);
    assert(openRouter.calls() >= 120, "stress seed must call OpenRouter across multi-turn AI replies");
    assert(result.stressReportPath.endsWith("CHORITOES_STRESS_TEST_REPORT.md"));
    await stat(result.backupDir);
    await stat(result.stressReportPath);
  } finally {
    openRouter.restore();
  }

  const auth = await readJson(join(dataDir, "auth.json"));
  assert(auth.users.some((user: Json) => user.id === targetOwner.id), "Pratik owner login should be preserved");
  assert(auth.sessions.some((session: Json) => session.id === "sess_pratik"), "Pratik owner session should be preserved");
  assert(auth.users.some((user: Json) => user.id === otherOwner.id), "other tenants should be untouched");
  assert(!auth.users.some((user: Json) => user.id === "usr_old_pratik_team"), "old Pratik team auth users should be deleted");
  assert(!auth.sessions.some((session: Json) => session.id === "sess_old_team"), "old Pratik team sessions should be deleted");

  const knowledge = await readJson(join(dataDir, "lead-knowledge.json"));
  const targetLeads = knowledge.leads.filter((lead: Json) => lead.tenantId === targetOwner.tenantId && lead.ownerId === targetOwner.id);
  const targetMessages = knowledge.messages.filter((message: Json) => message.tenantId === targetOwner.tenantId && message.ownerId === targetOwner.id);
  assert.equal(targetLeads.length, 75);
  assert(!targetLeads.some((lead: Json) => lead.id === "old_pratik_lead"));
  assert(knowledge.leads.some((lead: Json) => lead.id === "other_lead"));
  assert(targetMessages.some((message: Json) => message.channel === "whatsapp" && message.source === "twilio_simulator" && message.direction === "inbound"));
  assert(targetMessages.some((message: Json) => message.channel === "whatsapp" && message.source === "twilio_simulator" && message.direction === "outbound"));
  assert(targetMessages.some((message: Json) => message.channel === "email"));
  assert(targetMessages.some((message: Json) => message.channel === "call"));
  const whatsappInboundByLead = new Map<string, number>();
  for (const message of targetMessages) {
    if (message.channel === "whatsapp" && message.source === "twilio_simulator" && message.direction === "inbound") {
      whatsappInboundByLead.set(message.leadId, (whatsappInboundByLead.get(message.leadId) ?? 0) + 1);
    }
  }
  const deepWhatsappLeads = [...whatsappInboundByLead.values()].filter((count) => count >= 10).length;
  const mixedWhatsappLeads = [...whatsappInboundByLead.values()].filter((count) => count >= 6 && count < 10).length;
  assert(deepWhatsappLeads >= 60, "at least 60 WhatsApp-first leads need 10 lead-side turns");
  assert(mixedWhatsappLeads >= 10, "at least 10 mixed-channel leads need 6 lead-side turns");
  assert(targetMessages.filter((message: Json) => message.direction === "outbound").every((message: Json) => !/\bLeadsy\b/i.test(message.body)));
  assert(targetMessages.filter((message: Json) => message.direction === "outbound").some((message: Json) => /\bChoritoes\b/.test(message.body)));

  const settings = await readJson(join(dataDir, "user-settings.json"));
  const workspace = settings.workspaces.find((item: Json) => item.tenantId === targetOwner.tenantId && item.ownerId === targetOwner.id);
  assert.equal(workspace.workspace.businessName, "Choritoes");
  assert.equal(workspace.profile.roleTitle, "Sales Manager");
  assert.equal(workspace.ai.providerMode, "openrouter");
  assert.equal(workspace.ai.remoteAiEnabled, true);

  const crm = await readJson(join(dataDir, "lead-crm.json"));
  assert(!crm.followUpTasks.some((task: Json) => task.id === "old_task"));
  assert(crm.followUpTasks.length > 0);
  assert(crm.followUpTasks.every((task: Json) => task.source !== "choritoes_seed_direct"));
  assert(crm.followUpTasks.some((task: Json) => task.destination === "human_tasks"));
  assert(crm.followUpTasks.some((task: Json) => task.destination === "ai_approvals"));
  assert(crm.assignmentHistory.some((entry: Json) => entry.reason?.includes("Choritoes")));

  const teamspace = await readJson(join(dataDir, "teamspace.json"));
  assert(teamspace.members.some((member: Json) => member.name === "Qualification AI" && member.senderMode === "workspace"));
  assert(teamspace.members.some((member: Json) => member.name === "Distributor Qualification AI"));
  assert(teamspace.members.some((member: Json) => member.name === "Pratik Choudhuri" && member.role === "manager"));
  assert(teamspace.threadMessages.some((message: Json) => message.eventType === "assignment_changed"));
  assert(teamspace.threadMessages.some((message: Json) => message.eventType === "task_generated"));

  const aiUsage = await readJson(join(dataDir, "ai-usage.json"));
  assert(!aiUsage.agentRuns.some((run: Json) => run.id === "old_ai"));
  assert(aiUsage.agentRuns.length >= 120);
  assert(aiUsage.agentRuns.every((run: Json) => run.cost?.provider === "openrouter"));

  const { getCostReceipt } = await import("../apps/web/src/lib/cost-receipt");
  const receipt = await getCostReceipt({ tenantId: targetOwner.tenantId, ownerId: targetOwner.id });
  assert(receipt.summary.openrouter.requests >= 120);
  assert(receipt.summary.openrouter.totalInr > 0);
  assert(receipt.summary.twilio.projectedSimulatorMessages > 0);
  assert(receipt.summary.totalInr >= receipt.summary.openrouter.totalInr);

  const stressReport = await readFile(join(dataDir, "CHORITOES_STRESS_TEST_REPORT.md"), "utf8");
  assert.match(stressReport, /# Choritoes Stress Test Report/);
  assert.match(stressReport, /Behavioral Findings/);
  assert.match(stressReport, /WhatsApp-first deep leads: 60/);
  assert.match(stressReport, /Documented skipped inbound turns:/);

  console.log("choritoes simulation demo seed regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
