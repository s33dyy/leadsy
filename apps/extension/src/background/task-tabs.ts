import type { ExtensionTask } from "../core/tasks";

export async function getOrCreateTaskTab(task: ExtensionTask) {
  const targetUrl = task.targetUrl;
  if (!targetUrl) {
    throw new Error("Task is missing a target chat/profile.");
  }

  if (task.platform === "whatsapp-web" || isWhatsAppUrl(targetUrl)) {
    const existing = await chrome.tabs.query({});
    const whatsappTabs = existing.filter((tab) => tab.id && looksLikeWhatsAppTab(tab));
    const sameTarget = whatsappTabs.find((tab) => tab.id && tabUrl(tab) && sameWhatsAppTarget(tabUrl(tab), targetUrl));
    if (sameTarget?.id) {
      return focusTab(sameTarget.id);
    }

    const reusable = whatsappTabs.find((tab) => tab.id);
    if (reusable?.id) {
      return focusTab(reusable.id, targetUrl);
    }
  }

  const created = await chrome.tabs.create({ url: targetUrl });
  if (!created) {
    throw new Error("Could not open task tab.");
  }
  return created;
}

async function focusTab(tabId: number, url?: string) {
  const tab = await chrome.tabs.update(tabId, url ? { active: true, url } : { active: true });
  if (!tab) {
    throw new Error("Could not focus task tab.");
  }
  if (tab.windowId && chrome.windows?.update) {
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
  }
  return tab;
}

function sameWhatsAppTarget(left: string, right: string) {
  const leftPhone = whatsappPhone(left);
  const rightPhone = whatsappPhone(right);
  return Boolean(leftPhone && rightPhone && leftPhone === rightPhone) || normalizeUrl(left) === normalizeUrl(right);
}

function looksLikeWhatsAppTab(tab: chrome.tabs.Tab) {
  const url = tabUrl(tab);
  return (url && isWhatsAppUrl(url)) || /\bwhatsapp\b/i.test(tab.title || "");
}

function tabUrl(tab: chrome.tabs.Tab) {
  return tab.url || tab.pendingUrl || "";
}

function whatsappPhone(value: string) {
  try {
    const url = new URL(value);
    return url.searchParams.get("phone")?.replace(/[^\d]/g, "") || "";
  } catch {
    return "";
  }
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

function isWhatsAppUrl(value: string) {
  try {
    return new URL(value).hostname === "web.whatsapp.com";
  } catch {
    return false;
  }
}
