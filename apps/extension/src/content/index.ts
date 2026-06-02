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
    if (message.type === "leadsy:prepareActiveTask") {
      void executeActiveTask(controller)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not execute active task." }));
      return true;
    }
    return false;
  });

  const activeTask = await runtimeClient.getActiveTask().catch(() => undefined);
  if (activeTask && taskCanBePrepared(activeTask.status)) {
    await executeActiveTask(controller, activeTask);
  } else {
    await controller.arm();
  }
}

async function executeActiveTask(controller: ChatAutomationController, activeTask?: ExtensionTask) {
  const task = activeTask || (await runtimeClient.getActiveTask().catch(() => undefined));
  if (!task || !taskCanBePrepared(task.status)) return;

  try {
    const result = await controller.executeTask(task);
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
    await runtimeClient.completeTask({
      taskId: task.id,
      status: "sent",
      resultSummary: "Worker sent the task draft.",
      outboundMessage: {
        externalId: result.externalId,
        body: task.draftMessage,
        sentAt: result.sentAt
      }
    });
    void controller.arm().catch(() => undefined);
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

function taskCanBePrepared(status: ExtensionTask["status"]) {
  return status === "queued" || status === "in_progress" || status === "approved";
}
