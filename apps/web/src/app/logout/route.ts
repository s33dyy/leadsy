import { NextResponse, type NextRequest } from "next/server";
import { urlForRequestHost } from "@/lib/request-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.redirect(urlForRequestHost(request, "/login"));
}
