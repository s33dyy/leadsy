import Link from "next/link";
import { ArrowRight, Bot, Cable, Download, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { LandingScene } from "@/components/landing-scene";
import { Badge, GhostLink, PrimaryLink } from "@/components/ui";

const modules = [
  {
    icon: MessageCircle,
    title: "Research prospects",
    detail: "Collect Meta, browser extension, and manual context before AI adds any generated interpretation."
  },
  {
    icon: Cable,
    title: "Build lead knowledge",
    detail: "Turn notes, conversations, status changes, and worker findings into one living lead profile."
  },
  {
    icon: Bot,
    title: "Generate operator tasks",
    detail: "Let workers propose next steps while humans keep control of approval, edits, and completion."
  },
  {
    icon: Download,
    title: "Draft with approval",
    detail: "Prepare outreach drafts without sending autonomously; operators approve every action first."
  },
  {
    icon: ShieldCheck,
    title: "Support human operators",
    detail: "Keep qualification, communication logs, and task queues focused on daily lead operations."
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
          <a href="/login?next=/app/leads" className="rounded-[6px] px-3 py-2 text-sm text-[var(--muted-2)] hover:text-white">
            Workspace
          </a>
          <a href="/extension" className="rounded-[6px] px-3 py-2 text-sm text-[var(--muted-2)] hover:text-white">
            Extension
          </a>
          <a href="/login?next=/app/connect" className="rounded-[6px] px-3 py-2 text-sm text-[var(--muted-2)] hover:text-white">
            Connect
          </a>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-8 pt-8 md:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:pb-14">
        <div className="max-w-xl">
          <Badge tone="teal">{"AI Lead Intelligence & Operations Platform"}</Badge>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
            Leadsy
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted-2)]">
            Research prospects, build knowledge about every lead, generate tasks for human operators, and draft outreach that waits for approval before anything is sent.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink href="/login?next=/app/leads">
              Open lead intelligence
              <ArrowRight className="ml-2" size={16} />
            </PrimaryLink>
            <GhostLink href="/extension">Download extension</GhostLink>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ["0", "knowledge records"],
              ["0", "operator tasks"],
              ["0", "autonomous sends"]
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
