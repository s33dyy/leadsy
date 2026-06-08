import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const root = process.cwd();
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-settings-user-controls-"));
  process.env.LEADSY_DATA_DIR = tempDir;

  try {
    const settingsPage = await readFile(join(root, "apps/web/src/app/app/settings/page.tsx"), "utf8");
    for (const section of ['id: "profile"', 'id: "workspace"', 'id: "ai"', 'id: "agents"', 'id: "notifications"']) {
      assert(settingsPage.includes(section), `settings should expose ${section}`);
    }
    for (const removed of ['id: "twilio"', 'id: "infrastructure"', "TwilioSettingsPanel", "InfrastructurePanel", "Platform account SID", "/api/twilio/webhook"]) {
      assert(!settingsPage.includes(removed), `settings should not expose user-facing ${removed}`);
    }
    assert(settingsPage.includes('return "workspace"'), "unknown, twilio, and infrastructure sections should fall back to workspace");
    const settingsConsole = await readFile(join(root, "apps/web/src/components/settings-console.tsx"), "utf8");
    const settingsSurface = `${settingsPage}\n${settingsConsole}`;
    assert(settingsSurface.includes("Advanced AI Lab"), "AI settings should render an advanced lab, not a static card");
    assert(settingsSurface.includes("Prompt templates"), "AI settings should expose prompt template controls");
    assert(settingsSurface.includes("Notification preferences"), "notifications settings should expose editable preferences");
    assert(settingsSurface.includes("Quiet hours"), "notifications settings should expose quiet hours");
    assert(settingsSurface.includes("Operator knowledge base"), "profile settings should expose operator knowledge");
    assert(settingsSurface.includes("Business operations"), "workspace settings should expose business operations fields");

    const appShell = await readFile(join(root, "apps/web/src/components/app-shell.tsx"), "utf8");
    assert(!appShell.includes('/app/worker"'), "primary navigation should not link to Automations");
    assert(!appShell.includes(">Automations<"), "primary navigation should not label Automations");

    const workerPage = await readFile(join(root, "apps/web/src/app/app/worker/page.tsx"), "utf8");
    assert(workerPage.includes('redirect("/app/team")'), "Automation page should redirect to Team");

    const {
      getOperatorProfileSettings,
      updateOperatorProfileSettings,
      getWorkspaceBusinessSettings,
      updateWorkspaceBusinessSettings,
      getAiWorkspaceSettings,
      updateAiWorkspaceSettings,
      runAiSettingsTest,
      getNotificationPreferences,
      updateNotificationPreferences,
      createNotificationRecord,
      listNotificationRecords,
      markNotificationRead
    } = await import("../apps/web/src/lib/user-settings-store");

    const scope = { tenantId: "tenant_settings", ownerId: "owner_settings" };
    const profile = await updateOperatorProfileSettings({
      ...scope,
      roleTitle: "Owner operator",
      languages: ["English", "Hindi"],
      communicationStyle: "Concise and consultative",
      knowledgeBase: "Handles optical retail enquiries and appointment handoffs."
    });
    assert.equal(profile.roleTitle, "Owner operator");
    assert.deepEqual((await getOperatorProfileSettings(scope)).languages, ["English", "Hindi"]);

    const workspace = await updateWorkspaceBusinessSettings({
      ...scope,
      businessName: "LensMart",
      industry: "Optical retail",
      pipelineStages: ["new", "collecting", "qualified"],
      timezone: "Asia/Kolkata",
      currency: "INR"
    });
    assert.equal(workspace.businessName, "LensMart");
    assert.deepEqual((await getWorkspaceBusinessSettings(scope)).pipelineStages, ["new", "collecting", "qualified"]);

    const ai = await updateAiWorkspaceSettings({
      ...scope,
      providerMode: "deterministic",
      costMode: "free",
      monthlyBudgetInr: 500,
      temperature: 0.2,
      maxTokens: 600,
      taskRouting: {
        "qualification-reply": { enabled: true, model: "openrouter/free" },
        "calendar-reply": { enabled: true, model: "openrouter/free" }
      },
      promptTemplates: {
        "qualification-reply": "Ask one concise qualifying question.",
        "calendar-reply": "Offer only database returned slots."
      }
    });
    assert.equal(ai.taskRouting["qualification-reply"].enabled, true);
    const aiTest = await runAiSettingsTest({ ...scope, task: "qualification-reply", prompt: "Need glasses today" });
    assert.equal(aiTest.provider, "deterministic");
    assert.match(aiTest.output, /qualification-reply/);

    const notifications = await updateNotificationPreferences({
      ...scope,
      channels: { inApp: true, toast: true, badge: true, email: false },
      quietHours: { enabled: true, start: "21:00", end: "09:00", timezone: "Asia/Kolkata" },
      notifyOnlyMyLeads: true,
      digestFrequency: "daily",
      events: {
        newInboundLead: true,
        needsReply: true,
        assignedToMe: true,
        aiEscalation: true,
        humanReviewNeeded: true,
        taskDue: true,
        taskOverdue: true,
        calendarMeeting: true,
        deliveryFailed: true,
        aiBudgetThreshold: true,
        systemHealthWarning: false
      }
    });
    assert.equal(notifications.quietHours.enabled, true);
    assert.equal((await getNotificationPreferences(scope)).notifyOnlyMyLeads, true);

    const record = await createNotificationRecord({
      ...scope,
      type: "needsReply",
      title: "Asha needs a reply",
      detail: "New inbound WhatsApp message",
      href: "/app/communications?conversation=conv_1",
      priority: "high"
    });
    assert.equal((await listNotificationRecords(scope)).length, 1);
    const read = await markNotificationRead({ ...scope, notificationId: record.id });
    assert.equal(read?.readAt !== undefined, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log("settings user controls regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
