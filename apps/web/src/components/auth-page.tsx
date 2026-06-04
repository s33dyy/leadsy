import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole, Sparkles } from "lucide-react";
import { getCurrentSession, redirectForSession } from "@/lib/auth";
import { LoginForm, type AuthMode } from "@/components/login-form";
import { Badge, Panel, SectionTitle } from "@/components/ui";

const loginErrors: Record<string, string> = {
  invalid_credentials: "Wrong phone/email or password.",
  rate_limited: "Too many login attempts. Please wait a few minutes and try again.",
  signup_required: "Use Google to create your Leadsy account first.",
  google_unconfigured: "Google signup is not connected yet. Please contact Leadsy support.",
  google_state: "Google signup expired. Please try again.",
  google_failed: "Google signup could not be completed.",
  meta_session: "Your Leadsy session expired before Meta authorization could finish. Log in, then reconnect Meta from Integrations."
};

const modeCopy: Record<AuthMode, { eyebrow: string; title: string; body: string }> = {
  login: {
    eyebrow: "Secure access",
    title: "Enter your lead intelligence workspace",
    body: "Sign in to research prospects, build lead knowledge, and approve worker-generated tasks."
  },
  signup: {
    eyebrow: "Create workspace",
    title: "Start with verified lead intelligence",
    body: "Create your workspace with Google, then connect Meta, WhatsApp, and the browser extension when you are ready."
  },
  forgot: {
    eyebrow: "Account help",
    title: "Recover access without losing context",
    body: "Use the recovery form for guidance, or continue with Google if your workspace was created that way."
  }
};

export async function AuthPage({
  searchParams,
  initialMode
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
  initialMode: AuthMode;
}) {
  const { next, error } = await searchParams;
  const session = await getCurrentSession();

  if (session) {
    redirect(redirectForSession(session));
  }

  const copy = modeCopy[initialMode];

  return (
    <main className="page-shell min-h-screen px-4 py-6 md:px-8">
      <div className="noise" />
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200">
              <Sparkles size={18} />
            </span>
            <span className="font-semibold">Leadsy</span>
          </Link>
          <Badge tone="teal">AI Lead Intelligence</Badge>
        </header>

        <section className="grid flex-1 place-items-center py-10">
          <div className="w-full max-w-[440px]">
            <Panel className="overflow-hidden p-5 md:p-6">
              <div className="rounded-[8px] border border-teal-300/20 bg-[radial-gradient(circle_at_top_left,rgba(32,230,190,0.12),transparent_34%),rgba(255,255,255,0.03)] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-teal-300/25 bg-teal-300/10 text-teal-100">
                  <LockKeyhole size={20} />
                </div>
                <div className="mt-5">
                  <SectionTitle eyebrow={copy.eyebrow} title={copy.title} />
                </div>
                <p className="mt-4 text-sm leading-7 text-[var(--muted-2)]">{copy.body}</p>
              </div>

              {error && loginErrors[error] ? (
                <p className="mt-5 rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">
                  {loginErrors[error]}
                </p>
              ) : null}

              <div className="mt-5">
                <LoginForm nextPath={next} initialMode={initialMode} />
              </div>
            </Panel>

            <div
              data-testid="auth-step-dots"
              aria-label="Leadsy setup progress preview"
              className="mt-5 flex justify-center gap-2"
            >
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className={`h-2 w-2 rounded-full ${dot === 0 ? "bg-teal-300" : "bg-white/25"}`}
                />
              ))}
            </div>

          </div>
        </section>
      </div>
    </main>
  );
}
