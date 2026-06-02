import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Sparkles } from "lucide-react";
import { getCurrentSession, redirectForSession } from "@/lib/auth";
import { hasOwnerUser } from "@/lib/auth-store";
import { ClientRegistrationForm } from "@/components/client-registration-form";
import { Badge, Panel, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const registerErrors: Record<string, string> = {
  invalid_fields: "Please fill all fields. Password must be at least 8 characters.",
  invalid_invite: "Invite code not found. Check the code from your agency owner.",
  invite_used: "This invite code is already used.",
  login_exists: "This phone or email already has a login.",
  rate_limited: "Too many registration attempts. Please wait a few minutes and try again."
};

export default async function ClientRegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [ownerExists, session] = await Promise.all([hasOwnerUser(), getCurrentSession()]);

  if (!ownerExists) {
    redirect("/setup");
  }

  if (session) {
    redirect(redirectForSession(session));
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
          <Badge tone="amber">Invite required</Badge>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.86fr_0.64fr] lg:items-start">
          <Panel className="p-5 md:p-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-amber-300/25 bg-amber-300/10 text-amber-100">
              <KeyRound size={20} />
            </div>
            <div className="mt-5">
              <SectionTitle eyebrow="Client access" title="Create your client login" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-2)]">
              Use the invite code from your agency owner once. After registration, you will always log in with phone/email and password.
            </p>
          </Panel>

          <Panel className="p-5 md:p-6">
            {error && registerErrors[error] ? (
              <p className="mb-4 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                {registerErrors[error]}
              </p>
            ) : null}
            <ClientRegistrationForm />
          </Panel>
        </section>
      </div>
    </main>
  );
}
