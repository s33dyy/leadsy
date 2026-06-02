import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { magnetRedirect, hasMinimumBrief, parseLeadBriefForm } from "@/lib/lead-magnet-form";
import { upsertLeadBrief } from "@/lib/lead-magnet-store";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) {
    return NextResponse.redirect(new URL("/login?next=/app/magnet", request.url), 303);
  }

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:lead-brief-form`, 60);
  if (!limiter.ok) {
    return NextResponse.redirect(magnetRedirect(request, { error: "rate-limited" }), 303);
  }

  const { input, sourcePreset } = parseLeadBriefForm(await request.formData());
  if (!hasMinimumBrief(input)) {
    return NextResponse.redirect(magnetRedirect(request, { error: "missing-brief" }), 303);
  }

  await upsertLeadBrief(auth.session.tenantId, auth.session.id, input);

  const notice = sourcePreset === "light" ? "sources-light" : sourcePreset === "full" ? "sources-full" : "brief-saved";
  return NextResponse.redirect(magnetRedirect(request, { notice }), 303);
}
