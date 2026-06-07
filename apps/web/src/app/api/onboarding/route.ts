import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { completeUserOnboarding, saveUserOnboarding } from "@/lib/auth-store";
import { ensureDefaultQualificationAgent } from "@/lib/teamspace-store";
import { ensureWorkspaceWhatsAppSender, provisionLeadsyAssignedWhatsAppSender } from "@/lib/workspace-whatsapp-sender-store";

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
  let sender;
  if (input.complete) {
    await ensureDefaultQualificationAgent({
      tenantId: auth.session.tenantId,
      ownerId: auth.session.id
    });
  }
  if (workspaceConfiguration && typeof workspaceConfiguration === "object" && !Array.isArray(workspaceConfiguration)) {
    const config = workspaceConfiguration as Record<string, unknown>;
    const businessName = typeof config.businessName === "string" ? config.businessName : undefined;
    const industry = typeof config.industry === "string" ? config.industry : undefined;
    const website = typeof input.profile.website === "string" ? input.profile.website : undefined;
    sender = input.complete
      ? await provisionLeadsyAssignedWhatsAppSender(
          {
            tenantId: auth.session.tenantId,
            ownerId: auth.session.id
          },
          {
            businessName,
            industry,
            website
          }
        )
      : await ensureWorkspaceWhatsAppSender({
          tenantId: auth.session.tenantId,
          ownerId: auth.session.id,
          businessName
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
    },
    sender
  });
}
