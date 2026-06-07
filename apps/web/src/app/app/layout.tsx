import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAgencySession } from "@/lib/auth";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireAgencySession();
  const [leads, whatsAppSender] = await Promise.all([
    listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id }),
    getWorkspaceWhatsAppSender({ tenantId: session.tenantId, ownerId: session.id })
  ]);
  const pendingApprovalCount = leads.filter((lead) => lead.crmStatus === "human_review").length;
  return (
    <AppShell
      session={session}
      pendingApprovalCount={pendingApprovalCount}
      whatsAppSender={
        whatsAppSender
          ? {
              transportMode: whatsAppSender.transportMode,
              simulatorHandle: whatsAppSender.simulatorHandle,
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
