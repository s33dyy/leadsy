export interface PageScopeOptions {
  leadsyBaseUrl?: string;
}

export function shouldArmOnPage(url: URL, options: PageScopeOptions = {}) {
  if (isLeadsyAppUrl(url, options.leadsyBaseUrl)) return false;
  return isSupportedChatUrl(url);
}

function isLeadsyAppUrl(url: URL, leadsyBaseUrl?: string) {
  if (url.hostname === "localhost" && url.port === "3000") return true;
  if (url.hostname === "127.0.0.1" && url.port === "3000") return true;
  if (/\.leadsy\.local$/i.test(url.hostname)) return true;
  if (!leadsyBaseUrl) return false;

  try {
    const baseUrl = new URL(leadsyBaseUrl);
    return url.origin === baseUrl.origin;
  } catch {
    return false;
  }
}

function isSupportedChatUrl(url: URL) {
  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname === "web.whatsapp.com") return true;
  if (hostname === "instagram.com" && url.pathname.startsWith("/direct")) return true;
  if (hostname === "facebook.com" && url.pathname.startsWith("/messages")) return true;
  if (hostname === "messenger.com") return true;
  return false;
}
