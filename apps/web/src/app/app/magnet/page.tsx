import { DatabaseZap, Magnet, MessageCircle, MousePointerClick, ShieldCheck } from "lucide-react";
import { LeadMagnetLab } from "@/components/lead-magnet-lab";
import { Badge, Panel, SectionTitle } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import { getLeadMagnetWorkspace } from "@/lib/lead-magnet-store";
import { sourceHealth } from "@/lib/source-health";

export const dynamic = "force-dynamic";

type LeadMagnetSearchParams = Promise<Record<string, string | string[] | undefined>>;

function flashMessage(params: Record<string, string | string[] | undefined>) {
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;

  const errors: Record<string, string> = {
    "missing-brief": "Fill what you sell, who to find, and where to search before running this action.",
    "rate-limited": "Too many clicks in a short time. Wait a moment, then try again.",
    "discovery-failed": "Lead discovery hit a technical issue. Your brief is safe; try again in a moment."
  };
  const notices: Record<string, string> = {
    "brief-saved": "Brief saved. This is now stored in your workspace.",
    "sources-full": "Full free search selected and saved.",
    "sources-light": "Light search selected and saved.",
    "discovery-complete": "Discovery finished. Review the lead dossiers on this page.",
    "discovery-needs-source": "Discovery ran, but no real leads were found yet. Check source connection or paste a real list."
  };

  return {
    initialError: error ? errors[error] ?? "" : "",
    initialNotice: notice ? notices[notice] ?? "" : ""
  };
}

export default async function LeadMagnetPage({ searchParams }: { searchParams?: LeadMagnetSearchParams }) {
  const session = await getCurrentSession();
  const flash = flashMessage(searchParams ? await searchParams : {});
  const workspace = session
    ? await getLeadMagnetWorkspace(session.tenantId, session.id)
    : { brief: null, briefHistory: [], leads: [], runs: [], drafts: [], agentRuns: [], searchSessions: [], activeSearchSession: null };

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Lead Magnet Engine" title="Find real leads, research them, and draft messages for approval" />
          <Badge tone="teal">agency owner workflow</Badge>
        </div>
        <div className="mt-6">
          <LeadMagnetLab initialWorkspace={{ ...workspace, sourceHealth: sourceHealth() }} {...flash} />
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          { icon: MousePointerClick, title: "Free public research", detail: "Search free public directories, socials, websites, reviews, news, competitors, and imported lists." },
          { icon: DatabaseZap, title: "Lead dossiers", detail: "Store every public detail found with evidence, quality score, and confidence." },
          { icon: MessageCircle, title: "Drafting", detail: "Write WhatsApp, DM, or email drafts without sending anything automatically." },
          { icon: ShieldCheck, title: "Guardrails", detail: "No fake data, no private scraping, no login bypass, and no spam automation." }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel key={item.title} className="p-4">
              <Icon size={18} className="text-[var(--teal)]" />
              <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
            </Panel>
          );
        })}
      </section>

      <Panel className="p-5">
        <div className="flex items-start gap-3">
          <Magnet size={19} className="mt-1 text-[var(--teal)]" />
          <p className="text-sm leading-7 text-[var(--muted-2)]">
            This screen is for your agency&apos;s own leads. Give Leadsy the niche, city, and offer; it will use free public web
            sources, build evidence-backed dossiers, and prepare transparent messages for you to approve.
          </p>
        </div>
      </Panel>
    </div>
  );
}
