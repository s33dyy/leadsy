import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, destroySessionFromRequest } from "@/lib/auth";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  await destroySessionFromRequest(request);
  const response = NextResponse.redirect(urlForRequestHost(request, "/login"));
  clearSessionCookie(response);
  return response;
}
