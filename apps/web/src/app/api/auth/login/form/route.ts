import { type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { createSignedSession, redirectForSession, setSessionCookie, toSessionUser } from "@/lib/auth";
import { authenticateUser, hasOwnerUser, normalizeLogin } from "@/lib/auth-store";
import { redirectToRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function safeNext(next: string | undefined, fallback: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  return next.startsWith("/client") ? fallback : next;
}

export async function POST(request: NextRequest) {
  if (!(await hasOwnerUser())) {
    return redirectToRequestHost(request, "/login?error=signup_required");
  }

  const formData = await request.formData();
  const emailOrPhone = String(formData.get("emailOrPhone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const limiter = rateLimit(`auth:login:${normalizeLogin(emailOrPhone)}`, 12, 15 * 60_000);
  if (!limiter.ok) {
    return redirectToRequestHost(request, "/login?error=rate_limited");
  }

  const user = await authenticateUser(emailOrPhone, password);
  if (!user) {
    return redirectToRequestHost(request, "/login?error=invalid_credentials");
  }

  const sessionUser = toSessionUser(user);
  const authSession = await createSignedSession(user);
  const response = redirectToRequestHost(request, safeNext(next, redirectForSession(sessionUser)));
  setSessionCookie(response, authSession.cookieValue, authSession.expiresAt);

  audit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "auth.login",
    resource: user.id,
    metadata: { role: user.role }
  });

  return response;
}
