import { NextResponse } from "next/server";
import {
  accounts,
  campaigns,
  deals,
  discoveredLeads,
  leadMagnetSources,
  leads,
  metaLeads,
  whatsappConversations
} from "@leadsy/domain";
import { listAgencyClients } from "@/lib/agency-client-store";

export async function GET() {
  const agencyClients = await listAgencyClients();
  return NextResponse.json({
    ok: true,
    service: "leadsy-web",
    checkedAt: new Date().toISOString(),
    modules: {
      accounts: accounts.length,
      deals: deals.length,
      leads: leads.length,
      campaigns: campaigns.length,
      agencyClients: agencyClients.length,
      metaLeads: metaLeads.length,
      leadMagnetSources: leadMagnetSources.length,
      discoveredLeads: discoveredLeads.length,
      whatsappConversations: whatsappConversations.length
    }
  });
}
