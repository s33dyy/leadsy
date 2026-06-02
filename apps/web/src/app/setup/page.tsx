import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getCurrentSession, redirectForSession } from "@/lib/auth";
import { hasOwnerUser } from "@/lib/auth-store";
import { OwnerSetupForm } from "@/components/owner-setup-form";
import { Badge, Panel, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const setupErrors: Record<string, string> = {
  invalid_fields: "Please fill all fields. Password must be at least 8 characters.",
  rate_limited: "Too many setup attempts. Please wait a few minutes and try again.",
  login_exists: "That phone or email is already registered."
};

export default async function SetupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [ownerExists, session] = await Promise.all([hasOwnerUser(), getCurrentSession()]);

  if (session) {
    redirect(redirectForSession(session));
  }

  if (ownerExists) {
    redirect("/login");
  }

  return (
    <main className="page-shell min-h-screen px-4 py-6 md:px-8">
      <div className="noise" />
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200">
              <Sparkles size={18} />
            </span>
            <span className="font-semibold">Leadsy</span>
          </Link>
          <Badge tone="teal">First run</Badge>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.86fr_0.64fr] lg:items-start">
          <Panel className="p-5 md:p-7">
            <SectionTitle eyebrow="Owner setup" title="Create the agency login" />
            <p className="mt-4 text-sm leading-7 text-[var(--muted-2)]">
              This creates the first agency owner account. After this, everyone enters Leadsy through the normal login screen.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {["Owner access", "Client isolation", "Signed sessions"].map((item) => (
                <div key={item} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                  <div className="mono text-[10px] uppercase text-[var(--teal)]">{item}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5 md:p-6">
            {error && setupErrors[error] ? (
              <p className="mb-4 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                {setupErrors[error]}
              </p>
            ) : null}
            <OwnerSetupForm />
          </Panel>
        </section>
      </div>
    </main>
  );
}
