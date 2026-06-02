import {
  accounts,
  activities,
  agencyClients,
  campaigns,
  contacts,
  deals,
  discoveredLeads,
  followUpTasks,
  leadMagnetSources,
  leads,
  metaLeads,
  whatsappConversations
} from "@leadsy/domain";

console.log(
  JSON.stringify(
    {
      message: "Clean seed prepared. No dummy business records are loaded.",
      counts: {
        accounts: accounts.length,
        contacts: contacts.length,
        deals: deals.length,
        leads: leads.length,
        activities: activities.length,
        campaigns: campaigns.length,
        agencyClients: agencyClients.length,
        metaLeads: metaLeads.length,
        leadMagnetSources: leadMagnetSources.length,
        discoveredLeads: discoveredLeads.length,
        whatsappConversations: whatsappConversations.length,
        followUpTasks: followUpTasks.length
      }
    },
    null,
    2
  )
);
