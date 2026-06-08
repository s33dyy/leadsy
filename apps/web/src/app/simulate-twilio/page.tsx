import { TwilioSimulatorConsole } from "@/components/twilio-simulator-console";
import { requireAgencySession } from "@/lib/auth";
import { buildSimulatorSnapshot } from "@/lib/live-conversation-snapshots";
import { ensureWorkspaceTwilioSimulator } from "@/lib/twilio-simulator";

export const dynamic = "force-dynamic";

export default async function SimulateTwilioPage() {
  const session = await requireAgencySession();
  const businessName = typeof session.onboardingProfile?.businessName === "string" ? session.onboardingProfile.businessName : undefined;
  const sender = await ensureWorkspaceTwilioSimulator({
    tenantId: session.tenantId,
    ownerId: session.id,
    businessName
  });
  const snapshot = await buildSimulatorSnapshot({ tenantId: session.tenantId, ownerId: session.id });

  return <TwilioSimulatorConsole sender={snapshot.sender ?? sender} recentEvents={snapshot.recentEvents} simulatedConversations={snapshot.simulatedConversations} />;
}
