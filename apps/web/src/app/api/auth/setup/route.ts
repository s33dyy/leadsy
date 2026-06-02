import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { createSignedSession, setSessionCookie } from "@/lib/auth";
import { createOwnerUser } from "@/lib/auth-store";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  emailOrPhone: z.string().trim().min(5).max(120),
  password: z.string().min(8).max(200)
});

function requestKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for") ?? "local";
}

export async function POST(request: NextRequest) {
  const limiter = rateLimit(`auth:setup:${requestKey(request)}`, 8, 15 * 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const result = await createOwnerUser(input);

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.reason === "owner_exists" ? 409 : 400 });
  }

  const session = await createSignedSession(result.user);
  const response = NextResponse.json(
    {
      user: {
        id: result.user.id,
        name: result.user.name,
        emailOrPhone: result.user.emailOrPhone,
        role: result.user.role
      },
      redirectTo: "/app"
    },
    { status: 201 }
  );
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
