import { ChatAutomationController } from "./automation";
import type { StatusChipController } from "./status-chip";
import { createStatusChip } from "./status-chip";
import { shouldArmOnPage } from "./page-scope";
import { RuntimeWorkerClient, openLeadsySidePanel } from "../core/runtime-client";
import type { ExtensionTask } from "../core/tasks";

const runtimeClient = new RuntimeWorkerClient();
void bootWorker();

async function bootWorker() {
  const settings = await runtimeClient.getSettings().catch(() => undefined);
  if (!shouldArmOnPage(new URL(window.location.href), { leadsyBaseUrl: settings?.baseUrl })) {
    return;
  }

  let controller: ChatAutomationController | undefined;
  const chip: StatusChipController = createStatusChip({
    onOpenPanel: openLeadsySidePanel,
    onPause: () => controller?.pause()
  });

  controller = new ChatAutomationController((state) => chip.setState(state), {
    openRouter: runtimeClient
  });

  chip.mount(document.documentElement);
  chrome.runtime.onMessage.addListener((message: { type?: string; task?: ExtensionTask }, _sender, sendResponse) => {
    if (message.type !== "leadsy:sendPreparedTask") return false;
    void sendPreparedTask(controller, message.task)
      .then((value) => sendResponse({ ok: true, value }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not send prepared task." }));
    return true;
  });

  await controller.arm();
  await prepareActiveTask(controller);
}

async function prepareActiveTask(controller: ChatAutomationController) {
  const task = await runtimeClient.getActiveTask().catch(() => undefined);
  if (!task || !taskCanBePrepared(task.status)) return;

  try {
    const result = await controller.prepareTaskForApproval(task);
    if (result.status === "blocked") {
      await runtimeClient.logTaskEvent({
        taskId: task.id,
        eventType: "worker_blocked",
        reason: result.reason,
        summary: result.summary
      });
      await runtimeClient.completeTask({
        taskId: task.id,
        status: "blocked",
        reason: result.reason,
        resultSummary: result.summary
      });
      return;
    }
    await runtimeClient.prepareTask({
      taskId: task.id,
      draftMessage: result.draftMessage
    });
  } catch (error) {
    await runtimeClient
      .completeTask({
        taskId: task.id,
        status: "failed",
        reason: "worker_prepare_failed",
        resultSummary: error instanceof Error ? error.message : "Worker could not execute this task."
      })
      .catch(() => undefined);
  }
}

async function sendPreparedTask(controller: ChatAutomationController, task?: ExtensionTask) {
  if (!task) throw new Error("No prepared task was provided.");
  const result = await controller.sendPreparedTask(task);
  await runtimeClient.completeTask({
    taskId: task.id,
    status: "sent",
    resultSummary: "Worker sent the owner-approved task draft.",
    outboundMessage: {
      externalId: result.externalId,
      body: task.draftMessage,
      sentAt: result.sentAt
    }
  });
}

function taskCanBePrepared(status: ExtensionTask["status"]) {
  return status === "queued" || status === "in_progress";
}
