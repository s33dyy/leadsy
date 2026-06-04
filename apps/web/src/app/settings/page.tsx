import { redirect } from "next/navigation";

export default function SettingsRouteAliasPage() {
  redirect("/app/connect?panel=settings");
}
