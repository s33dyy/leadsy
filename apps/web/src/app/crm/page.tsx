import { redirect } from "next/navigation";
import { requireAgencySession } from "@/lib/auth";

export default async function CrmRouteAliasPage() {
  await requireAgencySession();
  redirect("/app/leads");
}
