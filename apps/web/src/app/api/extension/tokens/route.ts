import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createExtensionToken, listExtensionTokens } from "@/lib/extension-store";

const schema = z.object({
  label: z.string().trim().max(120).optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;
  const tokens = await listExtensionTokens(auth.session.tenantId, auth.session.id);
  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "admin:manage");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:extension-token`, 12, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const result = await createExtensionToken({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    label: input.label
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "extension.token.create",
    resource: result.record.id,
    metadata: { label: result.record.label }
  });

  return NextResponse.json({ token: result.token, record: { ...result.record, tokenHash: undefined } });
}
