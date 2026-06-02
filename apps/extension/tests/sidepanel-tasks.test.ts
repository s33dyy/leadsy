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

    const button = document.querySelector<HTMLButtonElement>('[data-task-open="exttask_1"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Run task");
    button?.click();

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "leadsy:openTask", taskId: "exttask_1" });
    });
  });

  it("shows a send approval action for prepared tasks", async () => {
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
      if (message.type === "leadsy:approveTaskSend") {
        return { ok: true, value: { ...preparedTask, status: "in_progress", sendApprovedAt: "2026-06-02T08:01:00.000Z" } };
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

    const button = document.querySelector<HTMLButtonElement>('[data-task-approve-send="exttask_2"]');
    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Approve send");
    button?.click();

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: "leadsy:approveTaskSend", taskId: "exttask_2" });
    });
  });
});
