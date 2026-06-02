import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { deleteLeadDossier, updateLeadDossier } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

export const runtime = "nodejs";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : undefined));

const updateSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  area: optionalText(120),
  phone: optionalText(60),
  whatsapp: optionalText(60),
  email: optionalText(160),
  website: optionalText(300),
  instagram: optionalText(300),
  facebook: optionalText(300),
  linkedin: optionalText(300),
  address: optionalText(300),
  contentQualitySignal: z.string().trim().min(2).max(500),
  whyTheyMayNeedAgency: z.string().trim().min(2).max(700),
  outreachAngle: z.string().trim().min(2).max(700),
  nextAction: z.string().trim().min(2).max(500)
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-update`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The lead update could not be read. Try again." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: "invalid_lead",
        message: `Please check ${String(issue?.path[0] ?? "lead")}: ${issue?.message ?? "this field needs attention."}`
      },
      { status: 400 }
    );
  }

  const { leadId } = await context.params;
  const result = await updateLeadDossier(session.tenantId, session.id, leadId, parsed.data);

  if (result.status === "not-found") {
    return NextResponse.json({ error: "lead_not_found", message: "This lead was not found in your workspace." }, { status: 404 });
  }

  if (result.status === "duplicate") {
    return NextResponse.json(
      {
        error: "duplicate_lead",
        message: `This would duplicate ${result.duplicate.businessName}. Open that lead instead of creating another copy.`
      },
      { status: 409 }
    );
  }

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "leadmagnet.lead.update",
    resource: leadId,
    metadata: { businessName: result.lead.businessName, city: result.lead.city }
  });

  return NextResponse.json({ ...result.workspace, lead: result.lead, sourceHealth: sourceHealth() });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:lead-delete`, 80);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const { leadId } = await context.params;
  const result = await deleteLeadDossier(session.tenantId, session.id, leadId);
  if (!result) {
    return NextResponse.json({ error: "lead_not_found", message: "This lead was already deleted or was not found." }, { status: 404 });
  }

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "leadmagnet.lead.delete",
    resource: leadId,
    metadata: { businessName: result.lead.businessName, city: result.lead.city }
  });

  return NextResponse.json({ ...result.workspace, deletedLeadId: leadId, sourceHealth: sourceHealth() });
}
