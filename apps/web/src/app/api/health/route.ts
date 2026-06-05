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
import { summarizeCrmHealth } from "@/lib/crm-store";
import { summarizeExtensionHealth } from "@/lib/extension-store";
import { summarizeLeadKnowledgeHealth } from "@/lib/lead-knowledge-store";

export async function GET() {
  const [agencyClients, leadKnowledge, extension, crm] = await Promise.all([
    listAgencyClients(),
    summarizeLeadKnowledgeHealth(),
    summarizeExtensionHealth(),
    summarizeCrmHealth()
  ]);
  return NextResponse.json({
    ok: true,
    service: "leadsy-web",
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
      interestedLeads: leadKnowledge.interestedLeads,
      humanReviewLeads: leadKnowledge.humanReviewLeads
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
