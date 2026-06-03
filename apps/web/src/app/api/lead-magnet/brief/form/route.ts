import { type NextRequest } from "next/server";
import { leadMagnetArchivedRedirect } from "@/lib/lead-magnet-archive";

export function POST(request: NextRequest) {
  return leadMagnetArchivedRedirect(request);
}
