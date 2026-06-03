import { NextResponse, type NextRequest } from "next/server";
import { requireExtensionToken } from "@/lib/extension-auth";
import { listExtensionConversations } from "@/lib/extension-store";
import { listLeadKnowledgeRecords } from "@/lib/lead-knowledge-store";

export async function GET(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const leads = await listLeadKnowledgeRecords({ tenantId: auth.tenantId, ownerId: auth.ownerId });
  const conversations = await listExtensionConversations(auth.tenantId, auth.ownerId);
  return NextResponse.json({
    connected: true,
    ownerId: auth.ownerId,
    tokenLabel: auth.label,
    leadCount: leads.length,
    activeLeadCount: leads.filter((lead) => lead.leadStatus === "lead").length,
    knowledgeMessageCount: leads.reduce((total, lead) => total + lead.messageCount, 0),
    conversationCount: conversations.length,
    channels: [...new Set(leads.flatMap((lead) => lead.channels))]
  });
}
