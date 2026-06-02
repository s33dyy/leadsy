import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { LEAD_MAGNET_MAX_LEAD_GOAL } from "@leadsy/domain";
import { rateLimit } from "@leadsy/security";
import { getLeadMagnetWorkspace, upsertLeadBrief } from "@/lib/lead-magnet-store";
import { requireApiSession } from "@/lib/api-auth";
import { sourceHealth } from "@/lib/source-health";

const sourceSchema = z.enum([
  "openrouter-web-search",
  "directory-osint",
  "social-osint",
  "website-contact-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint",
  "browser-public-page",
  "manual-import"
]);

const briefSchema = z.object({
  service: z.string().trim().min(2).max(240),
  ownerWebsiteUrl: z.string().trim().max(300).default(""),
  idealCustomers: z.string().trim().min(2).max(500),
  searchLocations: z.string().trim().min(2).max(240),
  leadGoal: z.coerce.number().int().min(1).max(LEAD_MAGNET_MAX_LEAD_GOAL),
  researchMode: z.enum(["broad", "focused"]).optional(),
  sources: z.array(sourceSchema).min(1),
  aiAction: z.enum(["draft-only", "follow-up-plan"]).default("draft-only"),
  excludedLeads: z.string().trim().max(500).default("")
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) {
    return auth.response;
  }

  const workspace = await getLeadMagnetWorkspace(auth.session.tenantId, auth.session.id);
  return NextResponse.json({ ...workspace, sourceHealth: sourceHealth() });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return auth.response;
  }

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-brief`, 60);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "The form could not be read. Please try again." }, { status: 400 });
  }

  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] ? String(issue.path[0]) : "brief";
    return NextResponse.json(
      {
        error: "invalid_brief",
        message: `Please check ${field}: ${issue?.message ?? "this field needs attention."}`
      },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const brief = await upsertLeadBrief(auth.session.tenantId, auth.session.id, input);
  const workspace = await getLeadMagnetWorkspace(auth.session.tenantId, auth.session.id);
  return NextResponse.json({ ...workspace, brief, sourceHealth: sourceHealth() });
}
