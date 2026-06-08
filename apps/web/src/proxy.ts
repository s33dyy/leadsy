import { NextResponse, type NextRequest } from "next/server";
import { currentPathHeaderName } from "./lib/request-path";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(currentPathHeaderName, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ["/app/:path*", "/analytics", "/dashboard", "/crm", "/workers", "/settings"]
};
