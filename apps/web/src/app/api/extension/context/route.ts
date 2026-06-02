import { NextResponse, type NextRequest } from "next/server";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";
import { requireExtensionToken } from "@/lib/extension-auth";
import { listExtensionConversations } from "@/lib/extension-store";
import { sourceHealth } from "@/lib/source-health";

export async function GET(request: NextRequest) {
  const auth = await requireExtensionToken(request);
  if (!auth.ok) return auth.response;

  const workspace = await getLeadMagnetWorkspace(auth.tenantId, auth.ownerId);
  const conversations = await listExtensionConversations(auth.tenantId, auth.ownerId);
  return NextResponse.json({
    connected: true,
    ownerId: auth.ownerId,
    tokenLabel: auth.label,
    leadBrief: workspace.brief,
    leadCount: workspace.leads.length,
    conversationCount: conversations.length,
    sourceHealth: sourceHealth()
  });
}
