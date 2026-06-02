import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAgencySession } from "@/lib/auth";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireAgencySession();
  const metaConnections = await listMetaOAuthConnections(session.tenantId, session.id);
  return (
    <AppShell session={session} hasMetaConnection={metaConnections.length > 0}>
      {children}
    </AppShell>
  );
}
