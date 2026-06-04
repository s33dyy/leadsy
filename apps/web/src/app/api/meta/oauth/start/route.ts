import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { redirectToRequestHost, urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return redirectToRequestHost(request, "/login?next=/app/connect&error=meta_session");
  }

  const metaConnectUrl = process.env.META_EMBEDDED_SIGNUP_URL?.trim();
  if (!metaConnectUrl) {
    const url = urlForRequestHost(request, "/app/connect");
    url.searchParams.set("meta", "unconfigured");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(metaConnectUrl);
}
