import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { draftLeadMessage } from "@leadsy/ai";
import { eventBus } from "@leadsy/events";
import { withSpan } from "@leadsy/observability";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getLeadMagnetWorkspace, saveMessageDraft } from "@/lib/lead-magnet-store";

const schema = z.object({
  leadId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "workflow:run");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-magnet-outreach`, 80);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The outreach request could not be read. Try again." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_outreach_request",
        message: `Please check ${String(issue?.path[0] ?? "outreach")}: ${issue?.message ?? "this field needs attention."}`
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const workspace = await getLeadMagnetWorkspace(session.tenantId, session.id);
  const lead = workspace.leads.find((candidate) => candidate.id === input.leadId);
  if (!workspace.brief || !lead) {
    return NextResponse.json(
      { leadId: input.leadId, status: "blocked", message: "", reason: "No saved lead was found.", nextAction: "Run discovery or import real leads first." },
      { status: 404 }
    );
  }
  const brief = workspace.brief;

  const result = await withSpan(
    "leadmagnet.outreach",
    async () => {
      const draftResult = await draftLeadMessage({
        tenantId: session.tenantId,
        ownerId: session.id,
        brief,
        lead
      });
      await saveMessageDraft(draftResult.draft);
      return {
        leadId: draftResult.draft.leadId,
        status: "queued" as const,
        message: draftResult.draft.message,
        reason: draftResult.draft.rationale,
        nextAction: "Review and approve the draft before sending."
      };
    },
    {
    leadId: input.leadId
    }
  );

  await eventBus.publish({
    tenantId: session.tenantId,
    name: "leadmagnet.outreach.queued",
    payload: { leadId: result.leadId, status: result.status }
  });

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "leadmagnet.outreach",
    resource: result.leadId,
    metadata: { status: result.status, reason: result.reason }
  });

  return NextResponse.json(result);
}
