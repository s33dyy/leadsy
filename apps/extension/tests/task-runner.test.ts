import { describe, expect, it, vi } from "vitest";

import { nextRunnableTask, runTaskQueueOnce } from "../src/background/task-runner";
import type { ExtensionTask } from "../src/core/tasks";

const baseTask = {
  id: "exttask_queued",
  type: "initiate_conversation",
  status: "queued",
  priority: "normal",
  platform: "whatsapp-web",
  targetUrl: "https://web.whatsapp.com/send?phone=919830000000",
  contact: { displayName: "Asha Buyer", phone: "+919830000000" },
  draftMessage: "Hi Asha, should I send the details here?",
  contextSummary: "Imported lead.",
  createdAt: "2026-06-02T08:00:00.000Z",
  updatedAt: "2026-06-02T08:00:00.000Z"
} satisfies ExtensionTask;

describe("background task runner", () => {
  it("picks queued or app-approved tasks without requiring extension approval", () => {
    const waiting = { ...baseTask, id: "exttask_waiting", status: "awaiting_send_approval" } satisfies ExtensionTask;
    const blocked = { ...baseTask, id: "exttask_blocked", status: "blocked" } satisfies ExtensionTask;
    const approved = { ...baseTask, id: "exttask_approved", status: "approved" } satisfies ExtensionTask;

    expect(nextRunnableTask([waiting, blocked, approved])?.id).toBe("exttask_approved");
  });

  it("opens the next queued task without side-panel interaction", async () => {
    const openTask = vi.fn(async () => ({ ...baseTask, status: "in_progress" }) satisfies ExtensionTask);
    const result = await runTaskQueueOnce({
      getActiveTask: vi.fn(async () => undefined),
      getTasks: vi.fn(async () => [baseTask]),
      openTask
    });

    expect(result).toEqual({ status: "opened", taskId: "exttask_queued" });
    expect(openTask).toHaveBeenCalledWith("exttask_queued");
  });

  it("does not open another task while one is active", async () => {
    const openTask = vi.fn();
    const result = await runTaskQueueOnce({
      getActiveTask: vi.fn(async () => ({ ...baseTask, status: "in_progress" }) satisfies ExtensionTask),
      getTasks: vi.fn(async () => [baseTask]),
      openTask
    });

    expect(result).toEqual({ status: "active_task_present", taskId: "exttask_queued" });
    expect(openTask).not.toHaveBeenCalled();
  });
});
