import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAgencySession } from "@/lib/auth";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireAgencySession();
  return <AppShell session={session}>{children}</AppShell>;
}
