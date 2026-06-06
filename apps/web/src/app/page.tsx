import Link from "next/link";
import { ArrowRight, Bot, Cable, Download, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { LandingScene } from "@/components/landing-scene";
import { Badge, GhostLink, PrimaryLink } from "@/components/ui";

const modules = [
  {
    icon: MessageCircle,
    title: "Capture leads",
    detail: "Bring Meta, WhatsApp, browser extension, and manual lead intake into one conversion workspace."
  },
  {
    icon: Cable,
    title: "Qualify conversations",
    detail: "Use AI qualification fields, source context, and conversation history to identify the next best action."
  },
  {
    icon: Bot,
    title: "Route follow-up",
    detail: "Create owner assignments, approval queues, and follow-up tasks while Leadsy keeps the source of truth."
  },
  {
    icon: Download,
    title: "Draft with approval",
    detail: "Prepare outreach drafts without sending autonomously; operators approve every action first."
  },
  {
    icon: ShieldCheck,
    title: "Convert with follow-up",
    detail: "Track contacted, won, and lost outcomes without moving customer records outside Leadsy."
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
          <Badge tone="teal">{"AI Lead Capture, Qualification & Conversion Platform"}</Badge>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] text-white md:text-7xl">
            Leadsy
          </h1>
          <p className="mt-6 text-lg leading-8 text-[var(--muted-2)]">
            Capture inbound leads, qualify conversations with AI, coordinate follow-up, and convert prospects while preserving human approval for outbound messages.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink href="/login?next=/app/leads">
              Open Leads
              <ArrowRight className="ml-2" size={16} />
            </PrimaryLink>
            <GhostLink href="/extension">Download extension</GhostLink>
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
