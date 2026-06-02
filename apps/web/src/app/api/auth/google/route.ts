import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export const googleStateCookie = "leadsy_google_oauth_state";
export const googleNextCookie = "leadsy_google_oauth_next";

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/client")) {
    return "/app/leads";
  }
  return next;
}

export function googleCallbackUrl(request: NextRequest) {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || urlForRequestHost(request, "/api/auth/google/callback").toString();
}

export function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(urlForRequestHost(request, "/login?error=google_unconfigured"));
  }

  const state = randomUUID();
  const requestUrl = new URL(request.url);
  const next = safeNext(requestUrl.searchParams.get("next"));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleCallbackUrl(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.cookies.set(googleStateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 600
  });
  response.cookies.set(googleNextCookie, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 600
  });
  return response;
}
