import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, Sparkles } from "lucide-react";
import { getCurrentSession, redirectForSession } from "@/lib/auth";
import { hasOwnerUser } from "@/lib/auth-store";
import { LoginForm } from "@/components/login-form";
import { Badge, Panel, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const loginErrors: Record<string, string> = {
  invalid_credentials: "Wrong phone/email or password.",
  rate_limited: "Too many login attempts. Please wait a few minutes and try again."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
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
          <Badge tone="teal">Secure access</Badge>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-[0.86fr_0.64fr] lg:items-start">
          <Panel className="p-5 md:p-7">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-teal-300/25 bg-teal-300/10 text-teal-100">
              <LockKeyhole size={20} />
            </div>
            <div className="mt-5">
              <SectionTitle eyebrow="Login" title="Enter your Leadsy workspace" />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-2)]">
              Agency owners land in the command center. Client users land in their own client workspace.
            </p>
          </Panel>

          <Panel className="p-5 md:p-6">
            {error && loginErrors[error] ? (
              <p className="mb-4 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                {loginErrors[error]}
              </p>
            ) : null}
            <LoginForm nextPath={next} />
          </Panel>
        </section>
      </div>
    </main>
  );
}
