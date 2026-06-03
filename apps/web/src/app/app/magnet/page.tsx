import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LeadMagnetPage() {
  redirect("/app/leads?notice=lead-magnet-archived");
}
