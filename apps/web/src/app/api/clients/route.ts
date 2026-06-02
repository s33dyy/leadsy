import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAgencyClient, listAgencyClients } from "@/lib/agency-client-store";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2),
  city: z.string().trim().min(2),
  businessType: z.string().trim().min(2)
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) {
    return auth.response;
  }
  return NextResponse.json({ clients: await listAgencyClients() });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }
  const session = auth.session;

  const limiter = rateLimit(`${session.tenantId}:${session.id}:clients-create`, 30);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json());
  const client = await createAgencyClient(input);

  audit({
    tenantId: session.tenantId,
    actorId: session.id,
    action: "client.create",
    resource: client.id,
    metadata: { name: client.name, city: client.city, businessType: client.businessType }
  });

  return NextResponse.json({ client }, { status: 201 });
}
