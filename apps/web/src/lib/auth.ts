import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import type { SessionUser } from "@leadsy/security";
import {
  createAuthSession,
  deleteAuthSession,
  hasOwnerUser,
  resolveAuthSession,
  type AuthUser
} from "./auth-store";

export const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "leadsy_session";

const devSecret = "leadsy-local-dev-secret-change-before-production";

function authSecret() {
  return process.env.LEADSY_AUTH_SECRET ?? process.env.AUTH_SECRET ?? devSecret;
}

function signToken(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function toCookieValue(token: string) {
  return `${token}.${signToken(token)}`;
}

function fromCookieValue(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const token = `${parts[0]}.${parts[1]}`;
  const signature = parts[2];
  return safeEqual(signature, signToken(token)) ? token : null;
}

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.emailOrPhone,
    role: user.role,
    clientId: user.clientId,
    onboardingCompletedAt: user.onboardingCompletedAt,
    onboardingProfile: user.onboardingProfile
  };
}

export async function createSignedSession(user: AuthUser) {
  const { token, expiresAt } = await createAuthSession(user);
  return { cookieValue: toCookieValue(token), expiresAt };
}

export function setSessionCookie(response: NextResponse, cookieValue: string, expiresAt: Date) {
  response.cookies.set(sessionCookieName, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getSessionFromCookieValue(cookieValue?: string) {
  const token = fromCookieValue(cookieValue);
  if (!token) {
    return null;
  }

  const resolved = await resolveAuthSession(token);
  return resolved ? toSessionUser(resolved.user) : null;
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  return getSessionFromCookieValue(cookieStore.get(sessionCookieName)?.value);
}

export async function getSessionFromRequest(request: NextRequest) {
  return getSessionFromCookieValue(request.cookies.get(sessionCookieName)?.value);
}

export async function destroySessionFromRequest(request: NextRequest) {
  const token = fromCookieValue(request.cookies.get(sessionCookieName)?.value);
  if (token) {
    await deleteAuthSession(token);
  }
}

export function redirectForSession(session: SessionUser) {
  return session.role === "client" ? "/app/leads" : "/app/leads";
}

export async function requireAgencySession() {
  const ownerExists = await hasOwnerUser();
  if (!ownerExists) {
    redirect("/login?next=/app/leads");
  }

  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/app/leads");
  }

  if (session.role === "client") {
    redirect("/app/leads");
  }

  return session;
}

export async function requireClientSession() {
  const ownerExists = await hasOwnerUser();
  if (!ownerExists) {
    redirect("/login?next=/app/leads");
  }

  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/app/leads");
  }

  if (session.role !== "client" || !session.clientId) {
    redirect("/app/leads");
  }

  return session;
}
