import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { createSignedSession, setSessionCookie } from "@/lib/auth";
import { createClientUser, deleteAuthUser, normalizeLogin } from "@/lib/auth-store";
import { getAgencyClientByInviteCode, markAgencyClientRegistered } from "@/lib/agency-client-store";

export const runtime = "nodejs";

const schema = z.object({
  inviteCode: z.string().trim().min(6).max(24),
  name: z.string().trim().min(2).max(80),
  emailOrPhone: z.string().trim().min(5).max(120),
  password: z.string().min(8).max(200)
});

export async function POST(request: NextRequest) {
  const input = schema.parse(await request.json());
  const limiter = rateLimit(`auth:client-register:${input.inviteCode}:${normalizeLogin(input.emailOrPhone)}`, 8, 15 * 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const client = await getAgencyClientByInviteCode(input.inviteCode);
  if (!client) {
    return NextResponse.json({ error: "invalid_invite" }, { status: 404 });
  }

  if (client.clientRegisteredAt) {
    return NextResponse.json({ error: "invite_used" }, { status: 409 });
  }

  const createdUser = await createClientUser({
    clientId: client.id,
    name: input.name,
    emailOrPhone: input.emailOrPhone,
    password: input.password
  });

  if (!createdUser.ok) {
    return NextResponse.json({ error: createdUser.reason }, { status: 409 });
  }

  const registeredClient = await markAgencyClientRegistered(client.id, createdUser.user.id);
  if (!registeredClient) {
    await deleteAuthUser(createdUser.user.id);
    return NextResponse.json({ error: "invite_used" }, { status: 409 });
  }

  const session = await createSignedSession(createdUser.user);
  const response = NextResponse.json(
    {
      client: registeredClient,
      user: {
        id: createdUser.user.id,
        name: createdUser.user.name,
        emailOrPhone: createdUser.user.emailOrPhone,
        role: createdUser.user.role,
        clientId: createdUser.user.clientId
      },
      redirectTo: "/client/onboarding"
    },
    { status: 201 }
  );
  setSessionCookie(response, session.cookieValue, session.expiresAt);

  audit({
    tenantId: createdUser.user.tenantId,
    actorId: createdUser.user.id,
    action: "auth.client.register",
    resource: registeredClient.id,
    metadata: { clientName: registeredClient.name }
  });

  return response;
}
