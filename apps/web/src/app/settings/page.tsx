import { redirect } from "next/navigation";
import { requireAgencySession } from "@/lib/auth";

export default async function SettingsRouteAliasPage() {
  await requireAgencySession();
  redirect("/app/settings");
}
