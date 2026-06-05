import { redirect } from "next/navigation";
import { requireAgencySession } from "@/lib/auth";

export default async function WorkersRouteAliasPage() {
  await requireAgencySession();
  redirect("/app/worker");
}
