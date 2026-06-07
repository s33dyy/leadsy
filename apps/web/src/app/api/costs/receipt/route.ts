import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getCostReceipt } from "@/lib/cost-receipt";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "analytics:read");
  if (!auth.ok) return auth.response;

  const receipt = await getCostReceipt({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "cost.receipt.read",
    resource: "cost:receipt",
    metadata: {
      totalInr: receipt.summary.totalInr,
      totalUsd: receipt.summary.totalUsd,
      lineItems: receipt.lineItems.length
    }
  });

  return NextResponse.json({ ok: true, receipt });
}
