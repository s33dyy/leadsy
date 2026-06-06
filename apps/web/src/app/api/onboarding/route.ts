import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { completeUserOnboarding, saveUserOnboarding } from "@/lib/auth-store";
import { ensureWorkspaceWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

export const runtime = "nodejs";

const schema = z.object({
  profile: z.record(z.string(), z.unknown()).optional().default({}),
  complete: z.boolean().optional().default(false)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:onboarding`, 60, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const input = schema.parse(await request.json().catch(() => ({})));
  const user = input.complete
    ? await completeUserOnboarding({ userId: auth.session.id, profile: input.profile })
    : await saveUserOnboarding({ userId: auth.session.id, profile: input.profile });

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const workspaceConfiguration = input.profile.workspaceConfiguration;
  if (workspaceConfiguration && typeof workspaceConfiguration === "object" && !Array.isArray(workspaceConfiguration)) {
    const config = workspaceConfiguration as Record<string, unknown>;
    await ensureWorkspaceWhatsAppSender({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id,
      businessName: typeof config.businessName === "string" ? config.businessName : undefined
    });
  }

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: input.complete ? "onboarding.complete" : "onboarding.progress",
    resource: auth.session.id
  });

  return NextResponse.json({
    user: {
      id: user.id,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingProfile: user.onboardingProfile
    }
  });
}
