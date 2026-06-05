import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { pruneExtensionDataToTargets } from "@/lib/extension-store";
import { pruneLeadKnowledgeToTargets } from "@/lib/lead-knowledge-store";

export const runtime = "nodejs";

const requiredConfirmation = "KEEP_ONLY_BIBHOR_DAS";
const defaultKeepTerms = ["Bibhor Das", "8100510961", "Contendo"];

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:cleanup-dummy-data`, 4, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";
  if (confirm !== requiredConfirmation) {
    return NextResponse.json({ error: "confirmation_required", confirm: requiredConfirmation }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const tenantWide = body.tenantWide !== false;
  const keepTerms = Array.isArray(body.keepTerms)
    ? body.keepTerms.filter((term: unknown): term is string => typeof term === "string" && Boolean(term.trim()))
    : defaultKeepTerms;

  const scope = {
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    keepTerms,
    tenantWide,
    dryRun
  };

  const [leadKnowledge, extension] = await Promise.all([
    pruneLeadKnowledgeToTargets(scope),
    pruneExtensionDataToTargets(scope)
  ]);

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: dryRun ? "admin.cleanup_dummy_data.dry_run" : "admin.cleanup_dummy_data",
    resource: tenantWide ? "tenant" : auth.session.id,
    metadata: { keepTerms, leadKnowledge, extension }
  });

  return NextResponse.json({
    ok: true,
    dryRun,
    tenantWide,
    keepTerms,
    leadKnowledge,
    extension
  });
}
