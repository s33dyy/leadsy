import { type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { createSignedSession, setSessionCookie } from "@/lib/auth";
import { createOwnerUser } from "@/lib/auth-store";
import { redirectToRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

function requestKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for") ?? "local";
}

export async function POST(request: NextRequest) {
  const limiter = rateLimit(`auth:setup:${requestKey(request)}`, 8, 15 * 60_000);
  if (!limiter.ok) {
    return redirectToRequestHost(request, "/setup?error=rate_limited");
  }

  const formData = await request.formData();
  const input = {
    name: String(formData.get("name") ?? "").trim(),
    emailOrPhone: String(formData.get("emailOrPhone") ?? "").trim(),
    password: String(formData.get("password") ?? "")
  };

  if (input.name.length < 2 || input.emailOrPhone.length < 5 || input.password.length < 8) {
    return redirectToRequestHost(request, "/setup?error=invalid_fields");
  }

  const result = await createOwnerUser(input);
  if (!result.ok) {
    return redirectToRequestHost(request, result.reason === "owner_exists" ? "/login" : "/setup?error=login_exists");
  }

  const session = await createSignedSession(result.user);
  const response = redirectToRequestHost(request, "/app");
  setSessionCookie(response, session.cookieValue, session.expiresAt);

  audit({
    tenantId: result.user.tenantId,
    actorId: result.user.id,
    action: "auth.owner.setup",
    resource: result.user.id,
    metadata: { login: result.user.emailOrPhone }
  });

  return response;
}
