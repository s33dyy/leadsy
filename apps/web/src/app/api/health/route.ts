import { NextResponse } from "next/server";
import {
  accounts,
  campaigns,
  deals,
  discoveredLeads,
  leadMagnetSources,
  metaLeads,
  whatsappConversations
} from "@leadsy/domain";
import { listAgencyClients } from "@/lib/agency-client-store";
import { summarizeAuthHealth } from "@/lib/auth-store";
import { summarizeCrmHealth } from "@/lib/crm-store";
import { summarizeExtensionHealth } from "@/lib/extension-store";
import { summarizeLeadKnowledgeHealth } from "@/lib/lead-knowledge-store";
import { listWorkspaceWhatsAppSenders } from "@/lib/workspace-whatsapp-sender-store";

export async function GET() {
  const [agencyClients, leadKnowledge, extension, crm, auth, workspaceWhatsAppSenders] = await Promise.all([
    listAgencyClients(),
    summarizeLeadKnowledgeHealth(),
    summarizeExtensionHealth(),
    summarizeCrmHealth(),
    summarizeAuthHealth(),
    listWorkspaceWhatsAppSenders()
  ]);
  return NextResponse.json({
    ok: true,
    service: "leadsy-web",
    release: "twilio-crm-transformation",
    checkedAt: new Date().toISOString(),
    modules: {
      accounts: accounts.length,
      deals: deals.length,
      leads: leadKnowledge.records,
      campaigns: campaigns.length,
      agencyClients: agencyClients.length,
      metaLeads: leadKnowledge.metaSourced || metaLeads.length,
      leadMagnetSources: leadMagnetSources.length,
      discoveredLeads: discoveredLeads.length,
      whatsappConversations: leadKnowledge.conversations || extension.conversations || whatsappConversations.length,
      extensionTasks: extension.visibleTasks,
      pendingApprovals: extension.pendingApprovals,
      crmFollowUpTasks: crm.followUpTasks,
      authUsers: auth.users,
      authSessions: auth.sessions,
      workspaceWhatsAppSenders: workspaceWhatsAppSenders.length,
      interestedLeads: leadKnowledge.interestedLeads,
      humanReviewLeads: leadKnowledge.humanReviewLeads
    },
    auth,
    workspaceWhatsAppSenders: {
      senders: workspaceWhatsAppSenders.length
    },
    leadKnowledge,
    extension,
    crm: {
      ...crm,
      statusPipeline: leadKnowledge.statusPipeline,
      assigneeWorkload: leadKnowledge.assigneeWorkload
    }
  });
}
