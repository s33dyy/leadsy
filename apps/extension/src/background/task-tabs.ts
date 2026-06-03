import type { ExtensionTask } from "../core/tasks";

export async function getOrCreateTaskTab(task: ExtensionTask) {
  const targetUrl = task.targetUrl;
  if (!targetUrl) {
    throw new Error("Task is missing a target chat/profile.");
  }

  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeReusable = active.find((tab) => tab.id && tab.url && samePlatformTarget(tab.url, task));
  if (activeReusable?.id) {
    return focusTab(activeReusable.id, targetUrl);
  }

  const urls = platformQueryUrls(task, targetUrl);
  for (const queryUrl of urls) {
    const existing = await chrome.tabs.query({ url: queryUrl });
    const sameTarget = existing.find((tab) => tab.id && tab.url && sameExactTarget(tab.url, targetUrl, task));
    if (sameTarget?.id) {
      return focusTab(sameTarget.id);
    }

    const reusable = existing.find((tab) => tab.id);
    if (reusable?.id) {
      return focusTab(reusable.id, targetUrl);
    }
  }

  const allTabs = await chrome.tabs.query({});
  const fallbackSameTarget = allTabs.find((tab) => tab.id && tab.url && sameExactTarget(tab.url, targetUrl, task));
  if (fallbackSameTarget?.id) {
    return focusTab(fallbackSameTarget.id);
  }

  const fallbackReusable = allTabs.find((tab) => tab.id && tab.url && samePlatformTarget(tab.url, task));
  if (fallbackReusable?.id) {
    return focusTab(fallbackReusable.id, targetUrl);
  }

  const created = await chrome.tabs.create({ url: targetUrl });
  if (!created) {
    throw new Error("Could not open task tab.");
  }
  return created;
}

function platformQueryUrls(task: ExtensionTask, targetUrl: string) {
  if (task.platform === "whatsapp-web" || isWhatsAppUrl(targetUrl)) return ["https://web.whatsapp.com/*"];
  if (task.platform === "instagram-web" || hostIncludes(targetUrl, "instagram.com")) return ["https://www.instagram.com/*"];
  if (task.platform === "facebook-web" || hostIncludes(targetUrl, "facebook.com") || hostIncludes(targetUrl, "messenger.com")) {
    return ["https://www.facebook.com/*", "https://www.messenger.com/*"];
  }
  return [];
}

function samePlatformTarget(tabUrl: string, task: ExtensionTask) {
  if (task.platform === "whatsapp-web") return isWhatsAppUrl(tabUrl);
  if (task.platform === "instagram-web") return hostIncludes(tabUrl, "instagram.com");
  if (task.platform === "facebook-web") return hostIncludes(tabUrl, "facebook.com") || hostIncludes(tabUrl, "messenger.com");
  return false;
}

function sameExactTarget(left: string, right: string, task: ExtensionTask) {
  if (task.platform === "whatsapp-web" || isWhatsAppUrl(left) || isWhatsAppUrl(right)) return sameWhatsAppTarget(left, right);
  return normalizeUrl(left) === normalizeUrl(right);
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

function hostIncludes(value: string, host: string) {
  try {
    return new URL(value).hostname.toLowerCase().includes(host);
  } catch {
    return false;
  }
}
