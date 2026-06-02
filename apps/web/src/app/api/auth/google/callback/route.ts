import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { createSignedSession, setSessionCookie } from "@/lib/auth";
import { findOrCreateGoogleWorkspaceUser } from "@/lib/auth-store";
import { redirectToRequestHost, urlForRequestHost } from "@/lib/request-url";
import { googleCallbackUrl, googleNextCookie, googleStateCookie } from "../route";

export const runtime = "nodejs";

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  error_description?: string;
};

function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/client")) {
    return "/app/leads";
  }
  return next;
}

function clearGoogleCookies(response: NextResponse) {
  for (const name of [googleStateCookie, googleNextCookie]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
  }
}

function loginError(request: NextRequest, error: string) {
  const response = NextResponse.redirect(urlForRequestHost(request, `/login?error=${error}`));
  clearGoogleCookies(response);
  return response;
}

async function exchangeCode(request: NextRequest, code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleCallbackUrl(request)
    })
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function readGoogleIdentity(idToken: string) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as GoogleTokenInfo;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const expectedState = request.cookies.get(googleStateCookie)?.value;
  const next = safeNext(request.cookies.get(googleNextCookie)?.value);

  if (!code || !state || !expectedState || state !== expectedState) {
    return loginError(request, "google_state");
  }

  const token = await exchangeCode(request, code);
  if (!token?.id_token) {
    return loginError(request, "google_failed");
  }

  const identity = await readGoogleIdentity(token.id_token);
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const emailVerified = identity?.email_verified === true || identity?.email_verified === "true";
  if (!identity?.email || !emailVerified || identity.aud !== clientId) {
    return loginError(request, "google_failed");
  }

  const result = await findOrCreateGoogleWorkspaceUser({ name: identity.name, email: identity.email });

  const session = await createSignedSession(result.user);
  const response = redirectToRequestHost(request, next);
  clearGoogleCookies(response);
  setSessionCookie(response, session.cookieValue, session.expiresAt);

  audit({
    tenantId: result.user.tenantId,
    actorId: result.user.id,
    action: "auth.google.login",
    resource: result.user.id,
    metadata: { login: result.user.emailOrPhone }
  });

  return response;
}
