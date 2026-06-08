import { NextResponse } from "next/server";
import {
  accounts,
  campaigns,
  deals
} from "@leadsy/domain";
import { listAgencyClients } from "@/lib/agency-client-store";
import { summarizeAuthHealth } from "@/lib/auth-store";
import { summarizeCalendarHealth } from "@/lib/calendar-store";
import { summarizeCrmHealth } from "@/lib/crm-store";
import { summarizeLeadKnowledgeHealth } from "@/lib/lead-knowledge-store";
import { summarizeTeamspaceHealth } from "@/lib/teamspace-store";
import { listWorkspaceWhatsAppSenders } from "@/lib/workspace-whatsapp-sender-store";

export async function GET() {
  const [agencyClients, leadKnowledge, crm, auth, teamspace, calendar, workspaceWhatsAppSenders] = await Promise.all([
    listAgencyClients(),
    summarizeLeadKnowledgeHealth(),
    summarizeCrmHealth(),
    summarizeAuthHealth(),
    summarizeTeamspaceHealth(),
    summarizeCalendarHealth(),
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
      whatsappConversations: leadKnowledge.conversations,
      crmFollowUpTasks: crm.followUpTasks,
      authUsers: auth.users,
      authSessions: auth.sessions,
      teamMembers: teamspace.members,
      aiAgents: teamspace.aiAgents,
      calendarEvents: calendar.events,
      workspaceWhatsAppSenders: workspaceWhatsAppSenders.length,
      interestedLeads: leadKnowledge.interestedLeads,
      humanReviewLeads: leadKnowledge.humanReviewLeads
    },
    auth,
    workspaceWhatsAppSenders: {
      senders: workspaceWhatsAppSenders.length
    },
    leadKnowledge,
    teamspace,
    calendar,
    crm: {
      ...crm,
      statusPipeline: leadKnowledge.statusPipeline,
      assigneeWorkload: leadKnowledge.assigneeWorkload
    }
  });
}
