import { redirect } from "next/navigation";

export default function RetiredAutomationsPage() {
  // Preserve old Automations bookmarks while Teamspace owns user-facing agent controls.
  redirect("/app/team");
}
