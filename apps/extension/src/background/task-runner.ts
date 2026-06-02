import type { ExtensionTask } from "../core/tasks";

export type TaskRunnerPorts = {
  getActiveTask(): Promise<ExtensionTask | undefined>;
  getTasks(): Promise<ExtensionTask[]>;
  openTask(taskId: string): Promise<ExtensionTask>;
};

export type TaskRunnerResult =
  | { status: "active_task_present"; taskId: string }
  | { status: "opened"; taskId: string }
  | { status: "idle" };

export async function runTaskQueueOnce(ports: TaskRunnerPorts): Promise<TaskRunnerResult> {
  const activeTask = await ports.getActiveTask();
  if (activeTask && taskKeepsRunnerBusy(activeTask.status)) {
    return { status: "active_task_present", taskId: activeTask.id };
  }

  const task = nextRunnableTask(await ports.getTasks());
  if (!task) {
    return { status: "idle" };
  }

  await ports.openTask(task.id);
  return { status: "opened", taskId: task.id };
}

export function nextRunnableTask(tasks: ExtensionTask[]) {
  return tasks.find((task) => (task.status === "queued" || task.status === "approved") && task.targetUrl);
}

function taskKeepsRunnerBusy(status: ExtensionTask["status"]) {
  return status === "queued" || status === "in_progress" || status === "approved";
}
