export const currentPathHeaderName = "x-leadsy-current-path";

const allowedNextPrefixes = ["/app", "/crm", "/dashboard", "/workers", "/settings", "/extension"];

export function safeInternalNextPath(value: string | null | undefined, fallback = "/app/leads") {
  const clean = value?.trim();
  if (!clean) return fallback;

  let path = clean;
  if (/^https?:\/\//i.test(clean)) {
    try {
      const url = new URL(clean);
      path = `${url.pathname}${url.search}`;
    } catch {
      return fallback;
    }
  }

  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  const pathname = path.split("?")[0] || "/";
  return allowedNextPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? path : fallback;
}

export function loginUrlForNextPath(nextPath: string | null | undefined, fallback = "/app/leads") {
  return `/login?next=${encodeURIComponent(safeInternalNextPath(nextPath, fallback))}`;
}
