import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { getSessionFromRequest } from "@/lib/auth";
import { exchangeMetaOAuthCode, saveMetaOAuthConnection } from "@/lib/meta-oauth-store";
import { redirectToRequestHost, urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

const callbackPath = "/api/meta/oauth/callback";

function connectRedirect(request: NextRequest, meta: "connected" | "cancelled" | "error" | "unconfigured", reason?: string) {
  const url = urlForRequestHost(request, "/app/connect");
  url.searchParams.set("meta", meta);
  if (reason) {
    url.searchParams.set("reason", reason.slice(0, 80));
  }
  return NextResponse.redirect(url);
}

function callbackUrl(request: NextRequest) {
  return urlForRequestHost(request, callbackPath).toString();
}

function queryRecord(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const error = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");

  if (error) {
    return connectRedirect(request, "cancelled", requestUrl.searchParams.get("error_reason") ?? error);
  }

  if (!code) {
    return connectRedirect(request, "error", "missing_code");
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return redirectToRequestHost(request, "/login?next=/app/connect&error=meta_session");
  }

  const exchanged = await exchangeMetaOAuthCode({
    code,
    redirectUri: callbackUrl(request)
  });

  if (!exchanged.ok) {
    return connectRedirect(request, exchanged.reason === "unconfigured" ? "unconfigured" : "error", exchanged.reason);
  }

  const connection = await saveMetaOAuthConnection({
    tenantId: session.tenantId,
    ownerId: session.id,
    token: exchanged.token,
    query: queryRecord(requestUrl.searchParams)
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "integrations.meta.oauth.connected",
    resource: connection.id,
    metadata: {
      businessId: connection.businessId,
      whatsappBusinessAccountId: connection.whatsappBusinessAccountId,
      phoneNumberId: connection.phoneNumberId
    }
  });

  return connectRedirect(request, "connected");
}
