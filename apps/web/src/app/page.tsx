import Link from "next/link";
import { ArrowRight, Bot, Building2, DatabaseZap, GitBranch, LockKeyhole, MessageCircle, Sparkles } from "lucide-react";
import { LandingScene } from "@/components/landing-scene";
import { Badge, GhostLink, PrimaryLink } from "@/components/ui";

const modules = [
  {
    icon: DatabaseZap,
    title: "Meta lead ingestion",
    detail: "Instagram and Facebook lead webhooks with campaign attribution, dedupe, and instant qualification."
  },
  {
    icon: MessageCircle,
    title: "WhatsApp conversion",
    detail: "AI-assisted replies, multilingual qualification, smart follow-ups, bookings, and escalation."
  },
  {
    icon: GitBranch,
    title: "Automation builder",
    detail: "Triggers, branching logic, AI actions, CRM writes, routing and messaging nodes."
  },
  {
    icon: Building2,
    title: "Agency clients",
    detail: "Multi-client isolation, campaign analytics, white-label reporting, and client-ready summaries."
  },
  {
    icon: Bot,
    title: "Revenue copilot",
    detail: "Account summaries, forecasts, workflow generation, CRM answers, smart filters."
  },
  {
    icon: LockKeyhole,
    title: "Enterprise core",
    detail: "Multitenancy, RBAC, audit logs, rate limits, event bus, workers and observability."
  }
];

export default function Home() {
  return (
    <main className="page-shell overflow-hidden">
      <div className="noise" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-3 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200">
            <Sparkles size={18} />
          </span>
          <span className="font-semibold">Leadsy</span>
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          <a href="/login?next=/app" className="rounded-[6px] px-3 py-2 text-sm text-[var(--muted-2)] hover:text-white">
            Workspace
          </a>
          <a href="/onboarding" className="rounded-[6px] px-3 py-2 text-sm text-[var(--muted-2)] hover:text-white">
            Onboarding
          </a>
          <a href="/login?next=/app/workflows" className="rounded-[6px] px-3 py-2 text-sm text-[var(--muted-2)] hover:text-white">
            Workflows
          </a>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-8 md:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:pb-14">
        <div className="max-w-xl">
          <Badge tone="teal">AI-powered lead operating system</Badge>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
            Leadsy Lead OS
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted-2)]">
            Convert expensive Meta leads into qualified WhatsApp conversations, appointments, and client-ready reports with an AI sales coordinator that never misses follow-up.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink href="/login?next=/app">
              Enter command center
              <ArrowRight className="ml-2" size={16} />
            </PrimaryLink>
            <GhostLink href="/onboarding">Configure workspace</GhostLink>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["0", "connected sources"],
              ["0", "live leads"],
              ["0", "bookings"]
            ].map(([value, label]) => (
              <div key={label} className="panel-quiet p-3">
                <div className="text-2xl font-semibold text-white">{value}</div>
                <div className="mono mt-1 text-[10px] uppercase text-[var(--muted)]">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <LandingScene />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-8">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article key={module.title} className="panel-quiet p-5">
                <Icon size={20} className="text-[var(--teal)]" />
                <h2 className="mt-4 text-lg font-semibold text-white">{module.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{module.detail}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
