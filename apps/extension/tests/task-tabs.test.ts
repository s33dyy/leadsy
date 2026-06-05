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
  it("opens a fresh WhatsApp target instead of reusing a different active chat", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 41,
          active: true,
          url: "https://web.whatsapp.com/send?phone=919831111111"
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const update = vi.fn();
    const create = vi.fn(async () => ({ id: 99 }));
    vi.stubGlobal("chrome", { tabs: { query, update, create }, windows: { update: vi.fn() } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(99);
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(update).not.toHaveBeenCalledWith(41, expect.anything());
    expect(create).toHaveBeenCalledWith({ url: task.targetUrl });
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

  it("creates a new WhatsApp tab when existing tabs are not the same task target", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 43,
          url: "https://web.whatsapp.com/"
        }
      ])
      .mockResolvedValue([]);
    const update = vi.fn();
    const create = vi.fn(async () => ({ id: 99 }));
    vi.stubGlobal("chrome", { tabs: { query, update, create } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(99);
    expect(update).not.toHaveBeenCalledWith(43, expect.anything());
    expect(create).toHaveBeenCalledWith({ url: task.targetUrl });
  });

  it("does not fallback-reuse a different WhatsApp tab when Chrome URL matching misses", async () => {
    const query = vi.fn(async (input: chrome.tabs.QueryInfo) => {
      if (input.active) return [];
      if (input.url === "https://web.whatsapp.com/*") return [];
      return [
        {
          id: 44,
          url: "https://web.whatsapp.com/"
        }
      ];
    });
    const update = vi.fn();
    const create = vi.fn(async () => ({ id: 99 }));
    vi.stubGlobal("chrome", { tabs: { query, update, create } });

    const tab = await getOrCreateTaskTab(task);

    expect(tab.id).toBe(99);
    expect(query).toHaveBeenCalledWith({});
    expect(update).not.toHaveBeenCalledWith(44, expect.anything());
    expect(create).toHaveBeenCalledWith({ url: task.targetUrl });
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
