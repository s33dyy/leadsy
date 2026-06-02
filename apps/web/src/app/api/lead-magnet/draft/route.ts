import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { draftLeadMessage } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { audit, rateLimit } from "@leadsy/security";
import { getLeadMagnetWorkspace, saveMessageDraft } from "@/lib/lead-magnet-store";
import { requireApiSession } from "@/lib/api-auth";

const schema = z.object({
  leadId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "ai:invoke");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-draft`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The draft request could not be read. Try again." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_draft_request",
        message: `Please check ${String(issue?.path[0] ?? "draft")}: ${issue?.message ?? "this field needs attention."}`
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  const lead = workspace.leads.find((candidate) => candidate.id === input.leadId);
  if (!workspace.brief || !lead) {
    return NextResponse.json(
      { error: "not_found", message: "Save a lead brief and select a discovered lead before drafting." },
      { status: 404 }
    );
  }

  const result = await draftLeadMessage({
    tenantId: session.tenantId,
    ownerId: session.id,
    brief: workspace.brief,
    lead
  });
  const draft = await saveMessageDraft(result.draft);

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "leadmagnet.outreach.queued",
    payload: { leadId: draft.leadId, status: draft.status, channel: draft.channel }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "leadmagnet.draft",
    resource: draft.leadId,
    metadata: { channel: draft.channel, provider: result.agentRun.provider }
  });

  return NextResponse.json({ draft, agentRun: result.agentRun });
}
