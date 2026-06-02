import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { createSignedSession, redirectForSession, setSessionCookie, toSessionUser } from "@/lib/auth";
import { authenticateUser, hasOwnerUser, normalizeLogin } from "@/lib/auth-store";

export const runtime = "nodejs";

const schema = z.object({
  emailOrPhone: z.string().trim().min(5).max(120),
  password: z.string().min(1).max(200),
  next: z.string().optional()
});

function safeNext(next: string | undefined, fallback: string, role: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  if (role === "client") {
    return next.startsWith("/client") ? next : "/client/onboarding";
  }
  return next.startsWith("/client") ? "/app" : next;
}

export async function POST(request: NextRequest) {
  if (!(await hasOwnerUser())) {
    return NextResponse.json({ error: "setup_required" }, { status: 428 });
  }

  const input = schema.parse(await request.json());
  const limiter = rateLimit(`auth:login:${normalizeLogin(input.emailOrPhone)}`, 12, 15 * 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const user = await authenticateUser(input.emailOrPhone, input.password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const sessionUser = toSessionUser(user);
  const authSession = await createSignedSession(user);
  const redirectTo = safeNext(input.next, redirectForSession(sessionUser), user.role);
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      emailOrPhone: user.emailOrPhone,
      role: user.role,
      clientId: user.clientId
    },
    redirectTo
  });
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
