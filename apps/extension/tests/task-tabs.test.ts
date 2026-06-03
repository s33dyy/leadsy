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
  it("reuses the currently active WhatsApp tab before looking for another tab", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 41,
          active: true,
          url: "https://web.whatsapp.com/"
        }
      ]);
    const update = vi.fn(async () => ({ id: 41 }));
    const create = vi.fn();
    vi.stubGlobal("chrome", { tabs: { query, update, create }, windows: { update: vi.fn() } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(41);
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(update).toHaveBeenCalledWith(41, { active: true, url: task.targetUrl });
    expect(create).not.toHaveBeenCalled();
  });

  it("focuses an existing WhatsApp tab for the same task target", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(query).toHaveBeenCalledWith({ url: "https://web.whatsapp.com/*" });
    expect(update).toHaveBeenCalledWith(42, { active: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("reuses an existing WhatsApp tab by navigating it to the task target", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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
    expect(update).toHaveBeenCalledWith(43, { active: true, url: task.targetUrl });
    expect(create).not.toHaveBeenCalled();
  });

  it("reuses existing Instagram and Facebook tabs before creating a new tab", async () => {
    const query = vi.fn(async (input: chrome.tabs.QueryInfo) => {
      if (input.active) return [];
      if (input.url === "https://www.instagram.com/*") return [{ id: 51, url: "https://www.instagram.com/direct/inbox/" }];
      if (input.url === "https://www.facebook.com/*" || input.url === "https://www.messenger.com/*") return [{ id: 52, url: "https://www.facebook.com/messages/" }];
      return [];
    });
    const update = vi.fn(async (id: number) => ({ id }));
    const create = vi.fn();
    vi.stubGlobal("chrome", { tabs: { query, update, create }, windows: { update: vi.fn() } });

    const instagram = await getOrCreateTaskTab({
      ...task,
      id: "exttask_ig",
      platform: "instagram-web",
      targetUrl: "https://www.instagram.com/direct/t/ig_user_1"
    });
    const facebook = await getOrCreateTaskTab({
      ...task,
      id: "exttask_fb",
      platform: "facebook-web",
      targetUrl: "https://www.facebook.com/messages/t/fb_user_1"
    });

    expect(instagram.id).toBe(51);
    expect(facebook.id).toBe(52);
    expect(update).toHaveBeenCalledWith(51, { active: true, url: "https://www.instagram.com/direct/t/ig_user_1" });
    expect(update).toHaveBeenCalledWith(52, { active: true, url: "https://www.facebook.com/messages/t/fb_user_1" });
    expect(create).not.toHaveBeenCalled();
  });
});
