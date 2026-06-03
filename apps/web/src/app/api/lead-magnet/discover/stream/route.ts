import { leadMagnetArchivedResponse } from "@/lib/lead-magnet-archive";

const archivedError = "lead_magnet_archived";

export function POST() {
  void archivedError;
  return leadMagnetArchivedResponse();
}
