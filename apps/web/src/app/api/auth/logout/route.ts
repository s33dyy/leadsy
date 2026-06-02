import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie, destroySessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await destroySessionFromRequest(request);
  const response = NextResponse.json({ ok: true, redirectTo: "/login" });
  clearSessionCookie(response);
  return response;
}
