import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, DatabaseZap, KeyRound, MessageCircle, Route, Sparkles } from "lucide-react";
import { GhostLink, Panel, PrimaryLink, SectionTitle } from "@/components/ui";

const steps = [
  { icon: Building2, title: "Client workspaces", detail: "Create isolated agency clients with city, vertical, ad spend, owners, and reporting rules." },
  { icon: KeyRound, title: "Secure access", detail: "Invite operators, sales coordinators, and client viewers with RBAC and audit policy." },
  { icon: DatabaseZap, title: "Meta ingestion", detail: "Connect Instagram and Facebook lead forms with campaign attribution and dedupe." },
  { icon: MessageCircle, title: "WhatsApp setup", detail: "Configure templates, AI language style, handoff rules, reminders, and booking flow." },
  { icon: Route, title: "Qualification logic", detail: "Tune budget, location, timeline, spam, urgency, and escalation thresholds." }
];

export default function OnboardingPage() {
  return (
    <main className="page-shell min-h-screen px-4 py-6 md:px-8">
      <div className="noise" />
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200">
              <Sparkles size={18} />
            </span>
            <span className="font-semibold">Leadsy</span>
          </Link>
          <GhostLink href="/">Home</GhostLink>
        </header>

        <Panel className="mt-8 p-5 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <SectionTitle eyebrow="onboarding" title="Configure the agency lead operating system" />
              <p className="mt-5 text-base leading-8 text-[var(--muted-2)]">
                Leadsy starts with client workspaces, Meta lead ingestion, WhatsApp templates, AI qualification rules, and the first automation from paid lead to booked appointment.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryLink href="/login?next=/app">
                  Launch workspace
                  <ArrowRight className="ml-2" size={16} />
                </PrimaryLink>
                <GhostLink href="/login?next=/app/workflows">Review workflows</GhostLink>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <article key={step.title} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-teal-300/10 text-teal-100">
                        <Icon size={18} />
                      </div>
                      <CheckCircle2 size={18} className={index < 2 ? "text-[var(--teal)]" : "text-[var(--muted)]"} />
                    </div>
                    <h2 className="mt-5 text-lg font-semibold text-white">{step.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{step.detail}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </Panel>
      </div>
    </main>
  );
}
