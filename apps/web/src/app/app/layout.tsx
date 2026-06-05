import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAgencySession } from "@/lib/auth";
import { listExtensionTasks, taskNeedsApproval } from "@/lib/extension-store";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireAgencySession();
  const [metaConnections, tasks] = await Promise.all([
    listMetaOAuthConnections(session.tenantId, session.id),
    listExtensionTasks(session.tenantId, session.id)
  ]);
  const pendingApprovalCount = tasks.filter(taskNeedsApproval).length;
  return (
    <AppShell session={session} hasMetaConnection={metaConnections.length > 0} pendingApprovalCount={pendingApprovalCount}>
      {children}
    </AppShell>
  );
}
