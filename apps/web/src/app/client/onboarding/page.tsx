import Link from "next/link";
import { LogOut, Sparkles } from "lucide-react";
import { getAgencyClient } from "@/lib/agency-client-store";
import { requireClientSession } from "@/lib/auth";
import { ClientOnboardingForm } from "@/components/client-onboarding-form";
import { Badge, Panel, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientOnboardingPage() {
  const session = await requireClientSession();
  const client = session.clientId ? (await getAgencyClient(session.clientId)) ?? null : null;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="noise" />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-3 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200">
            <Sparkles size={18} />
          </span>
          <span className="font-semibold">Leadsy Client Onboarding</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="teal">{session.name}</Badge>
          <a
            href="/logout"
            aria-label="Log out"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
            title="Log out"
          >
            <LogOut size={16} />
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-10 md:px-8">
        <Panel className="p-5 md:p-6">
          <SectionTitle
            eyebrow="Client setup"
            title="Tell the AI who should become your leads"
          />
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-2)]">
            This page is for the client. They define their ideal customer, first offer, target location, and monthly lead goal.
          </p>
          <div className="mt-6">
            <ClientOnboardingForm client={client} />
          </div>
        </Panel>
      </section>
    </main>
  );
}
