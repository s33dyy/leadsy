import { type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { createSignedSession, setSessionCookie } from "@/lib/auth";
import { createClientUser, deleteAuthUser, normalizeLogin } from "@/lib/auth-store";
import { getAgencyClientByInviteCode, markAgencyClientRegistered } from "@/lib/agency-client-store";
import { redirectToRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const input = {
    inviteCode: String(formData.get("inviteCode") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    emailOrPhone: String(formData.get("emailOrPhone") ?? "").trim(),
    password: String(formData.get("password") ?? "")
  };

  const limiter = rateLimit(`auth:client-register:${input.inviteCode}:${normalizeLogin(input.emailOrPhone)}`, 8, 15 * 60_000);
  if (!limiter.ok) {
    return redirectToRequestHost(request, "/client/register?error=rate_limited");
  }

  if (input.inviteCode.length < 6 || input.name.length < 2 || input.emailOrPhone.length < 5 || input.password.length < 8) {
    return redirectToRequestHost(request, "/client/register?error=invalid_fields");
  }

  const client = await getAgencyClientByInviteCode(input.inviteCode);
  if (!client) {
    return redirectToRequestHost(request, "/client/register?error=invalid_invite");
  }

  if (client.clientRegisteredAt) {
    return redirectToRequestHost(request, "/client/register?error=invite_used");
  }

  const createdUser = await createClientUser({
    clientId: client.id,
    name: input.name,
    emailOrPhone: input.emailOrPhone,
    password: input.password
  });

  if (!createdUser.ok) {
    return redirectToRequestHost(request, "/client/register?error=login_exists");
  }

  const registeredClient = await markAgencyClientRegistered(client.id, createdUser.user.id);
  if (!registeredClient) {
    await deleteAuthUser(createdUser.user.id);
    return redirectToRequestHost(request, "/client/register?error=invite_used");
  }

  const session = await createSignedSession(createdUser.user);
  const response = redirectToRequestHost(request, "/client/onboarding");
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
