import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAgencySession } from "@/lib/auth";
import { listExtensionTasks, taskNeedsApproval } from "@/lib/extension-store";
import { getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireAgencySession();
  const [tasks, whatsAppSender] = await Promise.all([
    listExtensionTasks(session.tenantId, session.id),
    getWorkspaceWhatsAppSender({ tenantId: session.tenantId, ownerId: session.id })
  ]);
  const pendingApprovalCount = tasks.filter(taskNeedsApproval).length;
  return (
    <AppShell
      session={session}
      pendingApprovalCount={pendingApprovalCount}
      whatsAppSender={
        whatsAppSender
          ? {
              assignedPhoneNumber: whatsAppSender.assignedPhoneNumber,
              status: whatsAppSender.status,
              statusReason: whatsAppSender.statusReason
            }
          : undefined
      }
    >
      {children}
    </AppShell>
  );
}
