import { redirect } from "next/navigation";
import { requireAgencySession } from "@/lib/auth";

export default async function DashboardRouteAliasPage() {
  await requireAgencySession();
  redirect("/app");
}
