import { describe, expect, it, vi } from "vitest";

import { getOrCreateTaskTab } from "../src/background/task-tabs";
import type { ExtensionTask } from "../src/core/tasks";

const task = {
  id: "exttask_tab",
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

describe("task tab routing", () => {
  it("focuses an existing WhatsApp tab for the same task target", async () => {
    const query = vi.fn(async () => [
      {
        id: 42,
        url: "https://web.whatsapp.com/send?phone=919830000000"
      }
    ]);
    const update = vi.fn(async () => ({ id: 42 }));
    const create = vi.fn();
    vi.stubGlobal("chrome", { tabs: { query, update, create } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(42);
    expect(query).toHaveBeenCalledWith({});
    expect(update).toHaveBeenCalledWith(42, { active: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("reuses an existing WhatsApp tab by navigating it to the task target", async () => {
    const query = vi.fn(async () => [
      {
        id: 43,
        url: "https://web.whatsapp.com/"
      }
    ]);
    const update = vi.fn(async () => ({ id: 43 }));
    const create = vi.fn();
    vi.stubGlobal("chrome", { tabs: { query, update, create } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(43);
    expect(query).toHaveBeenCalledWith({});
    expect(update).toHaveBeenCalledWith(43, { active: true, url: task.targetUrl });
    expect(create).not.toHaveBeenCalled();
  });

  it("reuses a loading WhatsApp tab before Chrome has committed its url", async () => {
    const query = vi.fn(async () => [
      {
        id: 44,
        pendingUrl: "https://web.whatsapp.com/"
      }
    ]);
    const update = vi.fn(async () => ({ id: 44 }));
    const create = vi.fn();
    vi.stubGlobal("chrome", { tabs: { query, update, create } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(44);
    expect(update).toHaveBeenCalledWith(44, { active: true, url: task.targetUrl });
    expect(create).not.toHaveBeenCalled();
  });
});
