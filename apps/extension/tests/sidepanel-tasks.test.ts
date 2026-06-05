import { beforeEach, describe, expect, it, vi } from "vitest";

const queuedTask = {
  id: "exttask_1",
  type: "initiate_conversation",
  status: "queued",
  priority: "high",
  platform: "whatsapp-web",
  targetUrl: "https://web.whatsapp.com/send?phone=919830000000",
  contact: {
    displayName: "Asha Buyer",
    phone: "+919830000000"
  },
  draftMessage: "Hi Asha, I can send pricing here. What team size should I quote for?",
  contextSummary: "Imported lead with pricing interest.",
  createdAt: "2026-06-02T08:00:00.000Z",
  updatedAt: "2026-06-02T08:00:00.000Z"
};

const preparedTask = {
  ...queuedTask,
  id: "exttask_2",
  status: "awaiting_send_approval",
  contact: {
    displayName: "Prepared Buyer",
    phone: "+919830000001"
  },
  draftMessage: "Hi, should I send the details here?"
};

const duplicateTargetTask = {
  ...queuedTask,
  id: "exttask_duplicate_target",
  draftMessage: "Hi Asha, following up again.",
  createdAt: "2026-06-02T08:05:00.000Z",
  updatedAt: "2026-06-02T08:05:00.000Z"
};

describe("side panel task queue", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("renders queued worker tasks without task approval and lets them be opened", async () => {
    const sendMessage = vi.fn(async (message: { type: string; taskId?: string }) => {
      if (message.type === "leadsy:getSettings") {
        return {
          ok: true,
          value: {
            baseUrl: "http://localhost:3000",
            token: "lext_test",
            fallbackEnabled: true
          }
        };
      }
      if (message.type === "leadsy:getTasks") {
        return { ok: true, value: [queuedTask] };
      }
      if (message.type === "leadsy:openTask") {
        return { ok: true, value: { status: "in_progress" } };
      }
      return { ok: true, value: undefined };
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage
      }
    });

    await import("../src/sidepanel/index");
    await vi.waitFor(() => expect(document.body.textContent).toContain("Asha Buyer"));
    expect(document.body.textContent).toContain("Hi Asha, I can send pricing here");
    expect(document.body.textContent).not.toContain("Waiting approval");
    expect(document.querySelectorAll(".task-row")).toHaveLength(1);
    expect(document.querySelector(".task-row")?.textContent).not.toContain("Hi Asha, I can send pricing here");
    expect(document.querySelector(".task-row .meta")?.textContent).toContain("initiate conversation");
    expect(document.querySelectorAll(".preview")).toHaveLength(0);

    const button = document.querySelector<HTMLButtonElement>('[data-task-open="exttask_1"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Run task");
    button?.click();

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "leadsy:openTask", taskId: "exttask_1" });
    });
  });

  it("shows prepared tasks as waiting on Leadsy app approval", async () => {
    const sendMessage = vi.fn(async (message: { type: string; taskId?: string }) => {
      if (message.type === "leadsy:getSettings") {
        return {
          ok: true,
          value: {
            baseUrl: "http://localhost:3000",
            token: "lext_test",
            fallbackEnabled: true
          }
        };
      }
      if (message.type === "leadsy:getTasks") {
        return { ok: true, value: [preparedTask] };
      }
      return { ok: true, value: undefined };
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage
      }
    });

    await import("../src/sidepanel/index");
    await vi.waitFor(() => expect(document.body.textContent).toContain("Prepared Buyer"));

    expect(document.querySelector('[data-task-approve-send="exttask_2"]')).toBeNull();
    expect(document.body.textContent).toContain("Waiting for Leadsy app");
    expect(sendMessage).not.toHaveBeenCalledWith({ type: "leadsy:approveTaskSend", taskId: "exttask_2" });
  });

  it("selects only one runnable task per conversation target for batch runs", async () => {
    const sendMessage = vi.fn(async (message: { type: string; taskIds?: string[] }) => {
      if (message.type === "leadsy:getSettings") {
        return {
          ok: true,
          value: {
            baseUrl: "http://localhost:3000",
            token: "lext_test",
            fallbackEnabled: true
          }
        };
      }
      if (message.type === "leadsy:getTasks") {
        return { ok: true, value: [queuedTask, duplicateTargetTask] };
      }
      if (message.type === "leadsy:runSelectedTasks") {
        return { ok: true, value: { batchRunId: "batch_test", requested: message.taskIds?.length ?? 0, sent: 1, postponed: 0, failed: 0 } };
      }
      return { ok: true, value: undefined };
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage
      }
    });

    await import("../src/sidepanel/index");
    await vi.waitFor(() => expect(document.querySelectorAll(".task-row")).toHaveLength(2));

    document.querySelector<HTMLButtonElement>("#select-visible")?.click();

    expect(Array.from(document.querySelectorAll<HTMLInputElement>("[data-task-checkbox]")).filter((checkbox) => checkbox.checked)).toHaveLength(1);
    expect(document.body.textContent).toContain("1 selected, 1 ready to run.");

    document.querySelector<HTMLButtonElement>("#run-selected")?.click();

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "leadsy:runSelectedTasks", taskIds: ["exttask_1"] });
    });
  });
});
