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
    if (message.type !== "leadsy:sendPreparedTask") return false;
    void sendPreparedTask(controller, message.task)
      .then((value) => sendResponse({ ok: true, value }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Could not send prepared task." }));
    return true;
  });

  const activeTask = await runtimeClient.getActiveTask().catch(() => undefined);
  if (activeTask && taskCanBeHandled(activeTask)) {
    await executeActiveTask(controller, activeTask);
  } else {
    await controller.arm();
  }
}

async function executeActiveTask(controller: ChatAutomationController, activeTask?: ExtensionTask) {
  const task = activeTask || (await runtimeClient.getActiveTask().catch(() => undefined));
  if (!task || !taskCanBeHandled(task)) return;

  try {
    if (task.sendApprovedAt) {
      const result = await controller.sendPreparedTask(task);
      await runtimeClient.completeTask({
        taskId: task.id,
        status: "sent",
        resultSummary: "Worker sent the Leadsy-approved task draft.",
        outboundMessage: {
          externalId: result.externalId,
          body: task.draftMessage,
          sentAt: result.sentAt
        }
      });
      void controller.arm().catch(() => undefined);
      return;
    }

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
    await runtimeClient.prepareTask(task.id, result.draftMessage);
    await runtimeClient.logTaskEvent({
      taskId: task.id,
      eventType: "worker_prepared",
      summary: "Worker prepared the draft and is waiting for Leadsy app approval."
    }).catch(() => undefined);
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
  if (!task.sendApprovedAt) throw new Error("Leadsy app approval is required before the worker sends this task.");
  const result = await controller.sendPreparedTask(task);
  await runtimeClient.completeTask({
    taskId: task.id,
    status: "sent",
    resultSummary: "Worker sent the Leadsy-approved task draft.",
    outboundMessage: {
      externalId: result.externalId,
      body: task.draftMessage,
      sentAt: result.sentAt
    }
  });
  void controller.arm().catch(() => undefined);
}

function taskCanBeHandled(task: ExtensionTask) {
  return taskCanBePrepared(task.status) || Boolean(task.sendApprovedAt);
}

function taskCanBePrepared(status: ExtensionTask["status"]) {
  return status === "queued" || status === "in_progress";
}
