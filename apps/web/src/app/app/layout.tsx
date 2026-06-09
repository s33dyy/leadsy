import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireAgencySession } from "@/lib/auth";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";
import { ensureDefaultQualificationAgent, listTeamMembers } from "@/lib/teamspace-store";
import { listCrmFollowUpTasks } from "@/lib/crm-store";
import { getWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireAgencySession();
  const scope = { tenantId: session.tenantId, ownerId: session.id };
  await ensureDefaultQualificationAgent(scope);
  const [leads, whatsAppSender, teamMembers, aiTasks] = await Promise.all([
    listLeadKnowledgeRecords({ tenantId: session.tenantId, ownerId: session.id }),
    getWorkspaceWhatsAppSender({ tenantId: session.tenantId, ownerId: session.id }),
    listTeamMembers(scope),
    listCrmFollowUpTasks(scope, { includeClosed: false, destination: "ai_approvals" })
  ]);
  const pendingApprovalCount = leads.filter((lead) => lead.crmStatus === "human_review").length + aiTasks.length;
  return (
    <AppShell
      session={session}
      pendingApprovalCount={pendingApprovalCount}
      manualLeadOptions={leads.slice(0, 30).map((lead) => ({
        id: lead.id,
        label: lead.contact.displayName || lead.contact.phone || lead.contact.email || "Unnamed lead",
        detail: lead.lastMessagePreview
      }))}
      teamMembers={teamMembers.map((member) => ({
        id: member.id,
        name: member.name,
        type: member.type,
        senderMode: member.senderMode,
        autoReplyEnabled: member.autoReplyEnabled
      }))}
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
