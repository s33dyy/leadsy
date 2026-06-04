import { NextResponse, type NextRequest } from "next/server";
import { urlForRequestHost } from "./request-url";

export function leadMagnetArchivedResponse() {
  return NextResponse.json(
    {
      error: "lead_magnet_archived",
      message: "Lead Magnet is archived. Use the Lead Intelligence workspace for Meta and browser conversation tracking."
    },
    { status: 410 }
  );
}

export function leadMagnetArchivedRedirect(request: NextRequest) {
  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("notice", "lead-magnet-archived");
  return NextResponse.redirect(url, 303);
}
