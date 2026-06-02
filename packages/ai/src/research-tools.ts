import { lookup } from "node:dns/promises";
import net from "node:net";

export type PublicSearchResult = {
  title: string;
  url: string;
  snippet?: string;
  provider?: string;
};

export type PublicFetchAccessStatus = "fetched" | "cache-hit" | "retried";

export type PublicFetchDiagnosticType =
  | "api-search-used"
  | "api-search-failed"
  | "html-search-used"
  | "provider-circuit-open"
  | "direct-fetch-blocked"
  | "rate-limited"
  | "retried-after-backoff"
  | "robots-skipped"
  | "domain-capped"
  | "source-deferred"
  | "cache-hit";

export type PublicFetchDiagnostic = {
  type: PublicFetchDiagnosticType;
  message: string;
  url?: string;
  host?: string;
  provider?: string;
  status?: number;
  retryAfterMs?: number;
};

export type PublicFetchResult = {
  url: string;
  title: string;
  text: string;
  emails: string[];
  phones: string[];
  socialLinks: string[];
  siteName?: string;
  schemaName?: string;
  logoAlt?: string;
  accessStatus?: PublicFetchAccessStatus;
  diagnostics?: PublicFetchDiagnostic[];
  recoveredFromUrl?: string;
};

export type PublicFetchErrorCode =
  | "blocked"
  | "rate-limited"
  | "robots-disallowed"
  | "domain-capped"
  | "timeout"
  | "http-error"
  | "network-error";

export class PublicFetchError extends Error {
  code: PublicFetchErrorCode;
  url: string;
  finalUrl?: string;
  host?: string;
  status?: number;
  retryAfterMs?: number;
  diagnostics: PublicFetchDiagnostic[];

  constructor(input: {
    code: PublicFetchErrorCode;
    message: string;
    url: string;
    finalUrl?: string;
    host?: string;
    status?: number;
    retryAfterMs?: number;
    diagnostics?: PublicFetchDiagnostic[];
  }) {
    super(input.message);
    this.name = "PublicFetchError";
    this.code = input.code;
    this.url = input.url;
    this.finalUrl = input.finalUrl;
    this.host = input.host;
    this.status = input.status;
    this.retryAfterMs = input.retryAfterMs;
    this.diagnostics = input.diagnostics ?? [];
  }
}

export function isPublicFetchError(error: unknown): error is PublicFetchError {
  return error instanceof PublicFetchError;
}

const defaultResearchUserAgent = "LeadsyResearchBot/0.2 (+public business OSINT; manual review; contact configured by operator)";
const defaultFetchCacheTtlMs = 15 * 60_000;

const fetchCache = new Map<string, { expiresAt: number; result: PublicFetchResult }>();
const hostStates = new Map<string, { lastRequestAt: number; cooldownUntil: number }>();
const domainRunCounts = new Map<string, number>();
const providerStates = new Map<string, { cooldownUntil: number; failures: number }>();
const robotsCache = new Map<string, { expiresAt: number; result: RobotsCheckResult }>();

type FetchPurpose = "search" | "website" | "robots" | "api";

type FetchPolicyOptions = {
  purpose: FetchPurpose;
  runId?: string;
  respectRobots?: boolean;
  retryRateLimit?: boolean;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
};

type FetchTextResult = {
  text: string;
  contentType: string;
  finalUrl: string;
  diagnostics: PublicFetchDiagnostic[];
};

type RobotsCheckResult = {
  allowed: boolean;
  reason?: string;
  sitemaps: string[];
};

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function researchUserAgent() {
  return process.env.LEADSY_RESEARCH_USER_AGENT?.trim() || defaultResearchUserAgent;
}

function requestHeaders(extra: Record<string, string> = {}) {
  return {
    "user-agent": researchUserAgent(),
    accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5",
    ...extra
  };
}

function minDelayMs() {
  return envNumber("LEADSY_RESEARCH_MIN_DELAY_MS", 1500);
}

function domainCooldownMs() {
  return envNumber("LEADSY_RESEARCH_DOMAIN_COOLDOWN_MS", 30_000);
}

function maxPagesPerDomain() {
  return Math.max(1, Math.floor(envNumber("LEADSY_RESEARCH_MAX_PAGES_PER_DOMAIN", 2)));
}

function robotsTtlMs() {
  return envNumber("LEADSY_RESEARCH_ROBOTS_TTL_MS", 86_400_000);
}

function retryAfterMaxMs() {
  return envNumber("LEADSY_RESEARCH_RETRY_AFTER_MAX_MS", 120_000);
}

function cacheTtlMs() {
  return envNumber("LEADSY_RESEARCH_FETCH_CACHE_TTL_MS", defaultFetchCacheTtlMs);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function htmlTitle(html: string, fallback: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? stripTags(title).slice(0, 180) : fallback;
}

function htmlMetaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const pattern = new RegExp(`<meta\\b[^>]*(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
    const reversePattern = new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "i");
    const value = html.match(pattern)?.[1] ?? html.match(reversePattern)?.[1];
    if (value) return stripTags(value).slice(0, 160);
  }
  return undefined;
}

function firstSchemaName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstSchemaName(item);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const type = Array.isArray(record["@type"]) ? record["@type"].join(" ") : String(record["@type"] ?? "");
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (name && /organization|localbusiness|store|medical|financial|professional|educational|school|college|clinic|dentist|physician|realestate/i.test(type)) {
    return stripTags(name).slice(0, 160);
  }
  for (const child of Object.values(record)) {
    const found = firstSchemaName(child);
    if (found) return found;
  }
  return undefined;
}

function htmlSchemaName(html: string) {
  const blocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks.slice(0, 6)) {
    const payload = block.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const found = firstSchemaName(JSON.parse(decodeHtml(payload)));
      if (found) return found;
    } catch {
      // Some sites ship broken JSON-LD. Other metadata sources will still be used.
    }
  }
  return undefined;
}

function htmlLogoAlt(html: string) {
  const imagePattern = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imagePattern.exec(html))) {
    const tag = match[0];
    if (!/\blogo\b/i.test(tag)) continue;
    const alt = tag.match(/\balt=["']([^"']+)["']/i)?.[1];
    if (alt && !/^\s*(logo|image)\s*$/i.test(alt)) {
      return stripTags(alt).slice(0, 120);
    }
  }
  return undefined;
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local");
}

function isPublicIp(address: string) {
  const version = net.isIP(address);
  if (version === 0) {
    return false;
  }
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    return true;
  }
  const normalized = address.toLowerCase();
  return !(
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

async function assertPublicUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("URL is invalid.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only public http/https URLs can be fetched.");
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error("Private/local hosts are blocked.");
  }
  if (net.isIP(parsed.hostname) && !isPublicIp(parsed.hostname)) {
    throw new Error("Private IP hosts are blocked.");
  }

  const addresses = await lookup(parsed.hostname, { all: true, verbatim: false });
  if (!addresses.length || addresses.some((address) => !isPublicIp(address.address))) {
    throw new Error("Host does not resolve to public internet addresses.");
  }

  return parsed;
}

function canonicalUrl(value: string) {
  const parsed = new URL(value);
  parsed.hash = "";
  parsed.searchParams.sort();
  return parsed.toString();
}

function cloneFetchResult(result: PublicFetchResult, diagnostic?: PublicFetchDiagnostic): PublicFetchResult {
  return {
    ...result,
    emails: [...result.emails],
    phones: [...result.phones],
    socialLinks: [...result.socialLinks],
    diagnostics: diagnostic ? [...(result.diagnostics ?? []), diagnostic] : [...(result.diagnostics ?? [])]
  };
}

async function respectHostDelay(host: string) {
  const state = hostStates.get(host) ?? { lastRequestAt: 0, cooldownUntil: 0 };
  const now = Date.now();
  const delay = Math.max(state.cooldownUntil - now, minDelayMs() - (now - state.lastRequestAt), 0);
  if (delay > 0) {
    await sleep(delay);
  }
}

function markHostRequest(host: string) {
  hostStates.set(host, {
    ...(hostStates.get(host) ?? { cooldownUntil: 0 }),
    lastRequestAt: Date.now()
  });
}

function markHostCooldown(host: string, ms = domainCooldownMs()) {
  const state = hostStates.get(host) ?? { lastRequestAt: 0, cooldownUntil: 0 };
  hostStates.set(host, {
    lastRequestAt: state.lastRequestAt,
    cooldownUntil: Math.max(state.cooldownUntil, Date.now() + ms)
  });
}

function enforceDomainCap(host: string, runId?: string) {
  const key = `${runId || "global"}:${host}`;
  const count = domainRunCounts.get(key) ?? 0;
  if (count >= maxPagesPerDomain()) {
    throw new PublicFetchError({
      code: "domain-capped",
      message: `Domain page cap reached for ${host}.`,
      url: `https://${host}`,
      host,
      diagnostics: [
        {
          type: "domain-capped",
          message: `Skipped because ${host} already hit the per-run page cap.`,
          host
        }
      ]
    });
  }
  domainRunCounts.set(key, count + 1);
}

function providerCircuitOpen(provider: string) {
  const state = providerStates.get(provider);
  return Boolean(state && state.cooldownUntil > Date.now());
}

function providerCircuitDiagnostic(provider: string): PublicFetchDiagnostic {
  return {
    type: "provider-circuit-open",
    provider,
    message: `${provider} is cooling down after repeated blocked/rate-limited responses.`
  };
}

function markProviderSuccess(provider: string) {
  providerStates.delete(provider);
}

function markProviderFailure(provider: string, retryAfterMs?: number) {
  const existing = providerStates.get(provider) ?? { failures: 0, cooldownUntil: 0 };
  const failures = existing.failures + 1;
  const backoff = retryAfterMs ?? Math.min(120_000, 5000 * 2 ** Math.min(failures, 5));
  providerStates.set(provider, { failures, cooldownUntil: Date.now() + backoff });
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }
  return undefined;
}

function normalizeFetchFailure(error: unknown, url: string, host: string, diagnostics: PublicFetchDiagnostic[]): PublicFetchError {
  if (isPublicFetchError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  const timeout = error instanceof Error && /timeout|aborted|abort/i.test(`${error.name} ${error.message}`);
  return new PublicFetchError({
    code: timeout ? "timeout" : "network-error",
    message: timeout ? `Timed out while fetching ${host}.` : message,
    url,
    host,
    diagnostics: [
      ...diagnostics,
      {
        type: "source-deferred",
        message: timeout ? `Timed out while fetching ${host}.` : message,
        url,
        host
      }
    ]
  });
}

function parseRobots(text: string): { groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }>; sitemaps: string[] } {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  const sitemaps: string[] = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }

  return { groups, sitemaps };
}

function robotPathMatches(rulePath: string, path: string) {
  if (!rulePath) return false;
  const escaped = rulePath.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  const pattern = new RegExp(`^${escaped}`);
  return pattern.test(path);
}

function evaluateRobots(text: string, parsedUrl: URL): RobotsCheckResult {
  const robots = parseRobots(text);
  const botToken = "leadsyresearchbot";
  const leadsyGroups = robots.groups.filter((group) => group.agents.some((agent) => agent.includes(botToken)));
  const starGroups = robots.groups.filter((group) => group.agents.includes("*"));
  const groups = leadsyGroups.length ? leadsyGroups : starGroups;
  const rules = groups.flatMap((group) => group.rules).filter((rule) => rule.path);
  const path = `${parsedUrl.pathname || "/"}${parsedUrl.search || ""}`;
  const matched = rules
    .filter((rule) => robotPathMatches(rule.path, path))
    .sort((left, right) => right.path.length - left.path.length || Number(right.allow) - Number(left.allow))[0];

  if (!matched) {
    return { allowed: true, sitemaps: robots.sitemaps };
  }
  return {
    allowed: matched.allow,
    reason: `${matched.allow ? "Allow" : "Disallow"}: ${matched.path}`,
    sitemaps: robots.sitemaps
  };
}

async function robotsAllowed(parsedUrl: URL): Promise<RobotsCheckResult> {
  const robotsUrl = new URL("/robots.txt", parsedUrl.origin).toString();
  const cached = robotsCache.get(parsedUrl.origin);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const robotsParsed = await assertPublicUrl(robotsUrl);
    await respectHostDelay(robotsParsed.hostname);
    markHostRequest(robotsParsed.hostname);
    const response = await fetch(robotsUrl, {
      headers: requestHeaders({ accept: "text/plain,*/*;q=0.5" }),
      redirect: "follow",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status === 404) {
      const result = { allowed: true, sitemaps: [] };
      robotsCache.set(parsedUrl.origin, { expiresAt: Date.now() + robotsTtlMs(), result });
      return result;
    }
    if (!response.ok) {
      const result = { allowed: true, reason: `robots.txt unavailable: HTTP ${response.status}`, sitemaps: [] };
      robotsCache.set(parsedUrl.origin, { expiresAt: Date.now() + Math.min(robotsTtlMs(), 60 * 60_000), result });
      return result;
    }
    const result = evaluateRobots((await response.text()).slice(0, 200_000), parsedUrl);
    robotsCache.set(parsedUrl.origin, { expiresAt: Date.now() + robotsTtlMs(), result });
    return result;
  } catch {
    const result = { allowed: true, reason: "robots.txt could not be checked; using conservative one-page fetch.", sitemaps: [] };
    robotsCache.set(parsedUrl.origin, { expiresAt: Date.now() + Math.min(robotsTtlMs(), 60 * 60_000), result });
    return result;
  }
}

async function fetchPublicTextUnderCap(url: string, maxChars: number, timeoutMs: number, options: FetchPolicyOptions): Promise<FetchTextResult> {
  let currentUrl = url;
  const diagnostics: PublicFetchDiagnostic[] = [];
  let retriedRateLimit = false;

  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const parsed = await assertPublicUrl(currentUrl);
    const host = parsed.hostname.toLowerCase();

    if (options.respectRobots) {
      const robots = await robotsAllowed(parsed);
      if (!robots.allowed) {
        throw new PublicFetchError({
          code: "robots-disallowed",
          message: `robots.txt disallows ${parsed.pathname || "/"}.`,
          url: currentUrl,
          host,
          diagnostics: [
            ...diagnostics,
            {
              type: "robots-skipped",
              message: robots.reason ?? "robots.txt disallowed this path.",
              url: currentUrl,
              host
            }
          ]
        });
      }
    }

    if (options.purpose === "website") {
      enforceDomainCap(host, options.runId);
    }

    await respectHostDelay(host);
    markHostRequest(host);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: options.method ?? "GET",
        headers: requestHeaders(options.headers),
        body: options.body,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      markHostCooldown(host, domainCooldownMs());
      throw normalizeFetchFailure(error, currentUrl, host, diagnostics);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new PublicFetchError({
          code: "http-error",
          message: "Redirect did not include a target URL.",
          url: currentUrl,
          host,
          status: response.status,
          diagnostics
        });
      }
      currentUrl = new URL(location, response.url).toString();
      continue;
    }

    if (response.status === 429) {
      const retryAfterMs = Math.min(parseRetryAfter(response.headers.get("retry-after")) ?? domainCooldownMs(), retryAfterMaxMs());
      markHostCooldown(host, retryAfterMs);
      diagnostics.push({
        type: "rate-limited",
        message: `HTTP 429 from ${host}.`,
        url: currentUrl,
        host,
        status: response.status,
        retryAfterMs
      });
      if (!retriedRateLimit && options.retryRateLimit !== false) {
        retriedRateLimit = true;
        await sleep(retryAfterMs);
        diagnostics.push({
          type: "retried-after-backoff",
          message: `Retried ${host} after ${retryAfterMs}ms backoff.`,
          url: currentUrl,
          host,
          retryAfterMs
        });
        redirects -= 1;
        continue;
      }
      throw new PublicFetchError({
        code: "rate-limited",
        message: `HTTP 429 from ${host}.`,
        url: currentUrl,
        host,
        status: response.status,
        retryAfterMs,
        diagnostics
      });
    }

    if (response.status === 401 || response.status === 403) {
      markHostCooldown(host, domainCooldownMs());
      throw new PublicFetchError({
        code: "blocked",
        message: `HTTP ${response.status} from ${host}.`,
        url: currentUrl,
        host,
        status: response.status,
        diagnostics: [
          ...diagnostics,
          {
            type: "direct-fetch-blocked",
            message: `Direct public fetch was blocked by ${host}.`,
            url: currentUrl,
            host,
            status: response.status
          }
        ]
      });
    }

    if (!response.ok) {
      throw new PublicFetchError({
        code: "http-error",
        message: `HTTP ${response.status}`,
        url: currentUrl,
        host,
        status: response.status,
        diagnostics
      });
    }

    const contentType = response.headers.get("content-type") || "";
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        text: (await response.text()).slice(0, maxChars),
        contentType,
        finalUrl: response.url,
        diagnostics
      };
    }

    const decoder = new TextDecoder();
    let text = "";
    while (text.length < maxChars) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return {
      text: text.slice(0, maxChars),
      contentType,
      finalUrl: response.url,
      diagnostics
    };
  }

  throw new PublicFetchError({
    code: "http-error",
    message: "Too many redirects.",
    url,
    diagnostics
  });
}

async function fetchTextUnderCap(url: string, maxChars: number, timeoutMs: number) {
  return fetchPublicTextUnderCap(url, maxChars, timeoutMs, {
    purpose: "search",
    retryRateLimit: true
  });
}

function parseSearchResults(html: string, maxResults: number): PublicSearchResult[] {
  const results: PublicSearchResult[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) && results.length < maxResults) {
    const rawHref = decodeHtml(match[1]);
    if (!rawHref.includes("uddg=")) {
      continue;
    }
    const parsed = new URL(rawHref, "https://duckduckgo.com");
    const target = parsed.searchParams.get("uddg");
    if (!target || seen.has(target)) {
      continue;
    }
    const url = new URL(target);
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      continue;
    }
    seen.add(target);
    results.push({
      title: stripTags(match[2]).slice(0, 180) || target,
      url: target,
      provider: "DuckDuckGo"
    });
  }

  return results;
}

function parseBingResults(html: string, maxResults: number): PublicSearchResult[] {
  const results: PublicSearchResult[] = [];
  const seen = new Set<string>();
  const linkPattern = /<h2\b[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) && results.length < maxResults) {
    const rawHref = decodeHtml(match[1]);
    let url: URL;
    try {
      url = new URL(rawHref);
    } catch {
      continue;
    }
    if (/(^|\.)bing\.com$/i.test(url.hostname) && url.pathname.startsWith("/ck/")) {
      const redirected = decodeBingRedirect(url);
      if (!redirected) {
        continue;
      }
      try {
        url = new URL(redirected);
      } catch {
        continue;
      }
    }
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      continue;
    }
    if (/(^|\.)bing\.com$|(^|\.)microsoft\.com$/i.test(url.hostname)) {
      continue;
    }
    const target = url.toString();
    if (seen.has(target)) {
      continue;
    }
    seen.add(target);
    results.push({
      title: stripTags(match[2]).slice(0, 180) || target,
      url: target,
      provider: "Bing"
    });
  }

  return results;
}

function parseMojeekResults(html: string, maxResults: number): PublicSearchResult[] {
  const results: PublicSearchResult[] = [];
  const seen = new Set<string>();
  const linkPattern = /<h2\b[\s\S]*?<a\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) && results.length < maxResults) {
    const rawHref = decodeHtml(match[1]);
    let url: URL;
    try {
      url = new URL(rawHref);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(url.protocol) || isBlockedHost(url.hostname)) {
      continue;
    }
    const target = url.toString();
    if (seen.has(target)) {
      continue;
    }
    seen.add(target);
    results.push({
      title: stripTags(match[2]).slice(0, 180) || target,
      url: target,
      provider: "Mojeek"
    });
  }

  return results;
}

function decodeBingRedirect(url: URL) {
  const encoded = url.searchParams.get("u");
  if (!encoded) {
    return undefined;
  }
  const payload = encoded.startsWith("a1") || encoded.startsWith("a2") ? encoded.slice(2) : encoded;
  try {
    const decoded = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return /^https?:\/\//i.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function parseApiResults(payload: unknown, provider: string, maxResults: number): PublicSearchResult[] {
  const root = payload as Record<string, unknown>;
  const candidates = [
    root.results,
    (root.web as Record<string, unknown> | undefined)?.results,
    root.organic,
    root.items,
    root.webPages && (root.webPages as Record<string, unknown>).value
  ].find(Array.isArray) as Array<Record<string, unknown>> | undefined;

  if (!candidates) {
    return [];
  }

  const seen = new Set<string>();
  const results: PublicSearchResult[] = [];
  for (const item of candidates) {
    const url = String(item.url ?? item.link ?? "").trim();
    const title = String(item.title ?? item.name ?? url).trim();
    const snippet = String(item.snippet ?? item.description ?? item.summary ?? "").trim();
    if (!url || seen.has(url)) continue;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) continue;
    } catch {
      continue;
    }
    seen.add(url);
    results.push({ title: title.slice(0, 180), url, snippet: snippet.slice(0, 320) || undefined, provider });
    if (results.length >= maxResults) break;
  }
  return results;
}

async function fetchJsonSearchProvider(input: {
  provider: string;
  url: URL;
  headers?: Record<string, string>;
  maxResults: number;
  errors: string[];
}) {
  if (providerCircuitOpen(input.provider)) {
    input.errors.push(`${input.provider}: circuit open`);
    return [];
  }
  try {
    const response = await fetchPublicTextUnderCap(input.url.toString(), 500_000, 12_000, {
      purpose: "api",
      retryRateLimit: true,
      headers: {
        accept: "application/json",
        ...(input.headers ?? {})
      }
    });
    const parsed = JSON.parse(response.text) as unknown;
    const results = parseApiResults(parsed, input.provider, input.maxResults);
    if (results.length) {
      markProviderSuccess(input.provider);
    }
    return results;
  } catch (error) {
    const retryAfterMs = isPublicFetchError(error) ? error.retryAfterMs : undefined;
    markProviderFailure(input.provider, retryAfterMs);
    input.errors.push(`${input.provider}: ${(error as Error).message}`);
    return [];
  }
}

async function configuredApiSearchResults(query: string, maxResults: number, errors: string[]) {
  const customUrl = process.env.LEADSY_SEARCH_API_URL?.trim();
  const customKey = process.env.LEADSY_SEARCH_API_KEY?.trim();
  if (customUrl) {
    const url = new URL(customUrl);
    url.searchParams.set(process.env.LEADSY_SEARCH_QUERY_PARAM || "q", query);
    url.searchParams.set(process.env.LEADSY_SEARCH_LIMIT_PARAM || "count", String(maxResults));
    const customResults = await fetchJsonSearchProvider({
      provider: "Configured search API",
      url,
      headers: customKey ? { authorization: `Bearer ${customKey}` } : undefined,
      maxResults,
      errors
    });
    if (customResults.length) return customResults;
  }

  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (braveKey) {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    url.searchParams.set("safesearch", "strict");
    url.searchParams.set("text_decorations", "false");
    const braveResults = await fetchJsonSearchProvider({
      provider: "Brave Search API",
      url,
      headers: { "x-subscription-token": braveKey },
      maxResults,
      errors
    });
    if (braveResults.length) return braveResults;
  }

  const bingKey = process.env.BING_SEARCH_API_KEY?.trim();
  if (bingKey) {
    const url = new URL(process.env.BING_SEARCH_ENDPOINT?.trim() || "https://api.bing.microsoft.com/v7.0/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    url.searchParams.set("safeSearch", "Strict");
    const bingResults = await fetchJsonSearchProvider({
      provider: "Bing Search API",
      url,
      headers: { "ocp-apim-subscription-key": bingKey },
      maxResults,
      errors
    });
    if (bingResults.length) return bingResults;
  }

  return [];
}

async function searchEngineResults(input: {
  name: string;
  url: URL;
  maxResults: number;
  parser: (html: string, maxResults: number) => PublicSearchResult[];
  errors: string[];
}) {
  if (providerCircuitOpen(input.name)) {
    input.errors.push(`${input.name}: ${providerCircuitDiagnostic(input.name).message}`);
    return [];
  }
  try {
    const { text } = await fetchTextUnderCap(input.url.toString(), 500_000, 12_000);
    const results = input.parser(text, input.maxResults);
    if (results.length) {
      markProviderSuccess(input.name);
    }
    return results;
  } catch (error) {
    const retryAfterMs = isPublicFetchError(error) ? error.retryAfterMs : undefined;
    markProviderFailure(input.name, retryAfterMs);
    input.errors.push(`${input.name}: ${(error as Error).message}`);
    return [];
  }
}

function resultHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function locationRelevantSearchResults(query: string, results: PublicSearchResult[]) {
  const siteDomain = query.match(/\bsite:([a-z0-9.-]+)/i)?.[1]?.toLowerCase();
  const locationPattern = /australia/i.test(query)
    ? { host: /\.au$/i, text: /\baustralia|australian\b/i }
    : /india/i.test(query)
      ? { host: /\.in$/i, text: /\bindia|indian\b/i }
      : /canada/i.test(query)
        ? { host: /\.ca$/i, text: /\bcanada|canadian\b/i }
        : /united kingdom|uk|england/i.test(query)
          ? { host: /\.uk$/i, text: /\bunited kingdom|england|british|london\b/i }
          : undefined;

  if (!siteDomain && !locationPattern) return results;

  return results.filter((result) => {
    const host = resultHost(result.url);
    const text = `${result.title} ${result.snippet ?? ""} ${result.url}`;
    const matchesSite = siteDomain ? host === siteDomain || host.endsWith(`.${siteDomain}`) : true;
    const matchesLocation = locationPattern ? locationPattern.host.test(host) || locationPattern.text.test(text) : true;
    return matchesSite && matchesLocation;
  });
}

function searchRegion(query: string) {
  if (/australia/i.test(query)) return { duck: "au-en", bingMarket: "en-AU", bingCountry: "AU" };
  if (/india/i.test(query)) return { duck: "in-en", bingMarket: "en-IN", bingCountry: "IN" };
  if (/canada/i.test(query)) return { duck: "ca-en", bingMarket: "en-CA", bingCountry: "CA" };
  if (/united kingdom|uk|england/i.test(query)) return { duck: "uk-en", bingMarket: "en-GB", bingCountry: "GB" };
  return undefined;
}

type PhoneRegion = "AU" | "IN" | "UNKNOWN";

function phoneRegionFromContext(context: string): PhoneRegion {
  if (/\.(?:com|net|org|edu|gov)\.au\b|\.au\b|\baustralia(?:n)?\b/i.test(context)) return "AU";
  if (/\.(?:co|org|net|gov|ac)\.in\b|\.in\b|\bindia(?:n)?\b/i.test(context)) return "IN";
  return "UNKNOWN";
}

function normalizeAustralianPhone(digits: string) {
  if (/^61[23478]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[23478]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^[23478]\d{8}$/.test(digits)) return `+61${digits}`;
  return undefined;
}

function normalizeIndianPhone(digits: string) {
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  return undefined;
}

function extractContacts(text: string, context = "") {
  const blockedEmailTlds = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "svg",
    "avif",
    "css",
    "js",
    "json",
    "map",
    "woff",
    "woff2",
    "ttf",
    "ico"
  ]);
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])]
    .map((email) => email.toLowerCase())
    .filter((email) => {
      const tld = email.split(".").pop() ?? "";
      const local = email.split("@")[0] ?? "";
      return !blockedEmailTlds.has(tld) && !/\b(?:asset|sprite|image|icon|logo|2x|3x)\b/i.test(local);
    })
    .slice(0, 8);
  const phones = [
    ...new Set(
      (text.match(/(?:\+?\d[\d\s().-]{8,}\d)/g) ?? [])
        .map((phone) => normalizeExtractedPhone(phone, phoneRegionFromContext(`${context}\n${text.slice(0, 2000)}`)))
        .filter((phone): phone is string => Boolean(phone))
    )
  ].slice(0, 8);
  const socialLinks = [
    ...new Set(
      text.match(/https?:\/\/(?:www\.)?(?:instagram|facebook|linkedin|youtube)\.com\/[A-Za-z0-9_./?=&%-]+/gi) ?? []
    )
  ].slice(0, 12);

  return { emails, phones, socialLinks };
}

function normalizeExtractedPhone(value: string, region: PhoneRegion = "UNKNOWN") {
  const compact = value.replace(/\s+/g, " ").trim();
  const digits = compact.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15 || /^(\d)\1+$/.test(digits)) {
    return undefined;
  }
  if (/^(978|979)\d{10}$/.test(digits)) {
    return undefined;
  }
  if (compact.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    const normalized = `+${digits}`;
    if (region === "AU" && !normalized.startsWith("+61")) return undefined;
    if (region === "IN" && !normalized.startsWith("+91")) return undefined;
    return normalized;
  }
  if (region === "AU") return normalizeAustralianPhone(digits);
  if (region === "IN") return normalizeIndianPhone(digits);
  if (/^61[23478]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return undefined;
}

export async function searchPublicWeb(input: {
  query: string;
  maxResults?: number;
}): Promise<{ query: string; results: PublicSearchResult[]; diagnostics?: PublicFetchDiagnostic[] }> {
  const query = input.query.trim();
  if (!query) {
    return { query, results: [] };
  }

  const maxResults = Math.max(1, Math.min(10, input.maxResults ?? 6));
  const errors: string[] = [];
  const region = searchRegion(query);
  const apiResults = await configuredApiSearchResults(query, maxResults, errors);
  if (apiResults.length) {
    return {
      query,
      results: apiResults,
      diagnostics: [{ type: "api-search-used", message: "Configured search API returned public results." }]
    };
  }

  const duckUrl = new URL("https://lite.duckduckgo.com/lite/");
  duckUrl.searchParams.set("q", query);
  duckUrl.searchParams.set("kp", "1");
  if (region?.duck) duckUrl.searchParams.set("kl", region.duck);
  const duckResults = await searchEngineResults({
    name: "DuckDuckGo",
    url: duckUrl,
    maxResults,
    parser: parseSearchResults,
    errors
  });
  const relevantDuckResults = locationRelevantSearchResults(query, duckResults);
  if (relevantDuckResults.length) {
    return {
      query,
      results: relevantDuckResults,
      diagnostics: [{ type: "html-search-used", provider: "DuckDuckGo", message: "DuckDuckGo public HTML search returned results." }]
    };
  }

  const mojeekUrl = new URL("https://www.mojeek.com/search");
  mojeekUrl.searchParams.set("q", query);
  const mojeekResults = await searchEngineResults({
    name: "Mojeek",
    url: mojeekUrl,
    maxResults,
    parser: parseMojeekResults,
    errors
  });
  const relevantMojeekResults = locationRelevantSearchResults(query, mojeekResults);
  if (relevantMojeekResults.length) {
    return {
      query,
      results: relevantMojeekResults,
      diagnostics: [{ type: "html-search-used", provider: "Mojeek", message: "Mojeek public HTML search returned results." }]
    };
  }

  const bingUrl = new URL("https://www.bing.com/search");
  bingUrl.searchParams.set("q", query);
  bingUrl.searchParams.set("safeSearch", "Strict");
  if (region?.bingMarket) bingUrl.searchParams.set("mkt", region.bingMarket);
  if (region?.bingCountry) bingUrl.searchParams.set("cc", region.bingCountry);
  const bingResults = await searchEngineResults({
    name: "Bing",
    url: bingUrl,
    maxResults,
    parser: parseBingResults,
    errors
  });
  const relevantBingResults = locationRelevantSearchResults(query, bingResults);
  if (relevantBingResults.length) {
    return {
      query,
      results: relevantBingResults,
      diagnostics: [{ type: "html-search-used", provider: "Bing", message: "Bing public HTML search returned results." }]
    };
  }

  if (errors.length >= 3) {
    throw new Error([...new Set(errors)].join("; "));
  }

  return errors.length
    ? {
        query,
        results: [],
        diagnostics: [...new Set(errors)].map((message) => ({ type: "api-search-failed", message }))
      }
    : { query, results: [] };
}

export async function fetchPublicPage(input: { url: string; runId?: string; recoveredFromUrl?: string }): Promise<PublicFetchResult> {
  const parsed = new URL(input.url);
  const cacheKey = canonicalUrl(parsed.toString());
  const cached = fetchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cloneFetchResult(cached.result, {
      type: "cache-hit",
      message: "Used cached public page evidence instead of fetching again.",
      url: parsed.toString(),
      host: parsed.hostname
    });
  }

  const { text: rawText, contentType, finalUrl, diagnostics } = await fetchPublicTextUnderCap(parsed.toString(), 220_000, 10_000, {
    purpose: "website",
    runId: input.runId,
    respectRobots: true,
    retryRateLimit: true
  });
  const isHtml = contentType.toLowerCase().includes("html") || /<html|<title|<body/i.test(rawText);
  const visibleText = isHtml ? stripTags(rawText) : rawText.replace(/\s+/g, " ").trim();
  const contacts = extractContacts(`${rawText}\n${visibleText}`, `${finalUrl}\n${visibleText.slice(0, 1000)}`);
  const result: PublicFetchResult = {
    url: finalUrl,
    title: isHtml ? htmlTitle(rawText, finalUrl) : finalUrl,
    text: visibleText.slice(0, 12_000),
    emails: contacts.emails,
    phones: contacts.phones,
    socialLinks: contacts.socialLinks,
    siteName: isHtml ? htmlMetaContent(rawText, ["og:site_name", "application-name", "twitter:site"]) : undefined,
    schemaName: isHtml ? htmlSchemaName(rawText) : undefined,
    logoAlt: isHtml ? htmlLogoAlt(rawText) : undefined,
    accessStatus: diagnostics.some((diagnostic) => diagnostic.type === "retried-after-backoff") ? "retried" : "fetched",
    diagnostics,
    recoveredFromUrl: input.recoveredFromUrl
  };

  fetchCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs(), result });
  return cloneFetchResult(result);
}
