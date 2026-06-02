import "server-only";

import { NextResponse, type NextRequest } from "next/server";

export function urlForRequestHost(request: NextRequest, pathname: string) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  return new URL(pathname, `${protocol}://${host}`);
}

export function redirectToRequestHost(request: NextRequest, pathname: string) {
  return NextResponse.redirect(urlForRequestHost(request, pathname));
}
