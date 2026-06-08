import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckSquare, LockKeyhole, MessageCircle, RadioTower, Sparkles, UsersRound } from "lucide-react";
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
  session_expired: "Your Leadsy session expired. Log in again to continue."
};

const modeCopy: Record<AuthMode, { eyebrow: string; title: string; body: string }> = {
  login: {
    eyebrow: "Secure access",
    title: "Enter your lead capture, qualification, and conversion workspace",
    body: "Sign in to capture leads, qualify conversations with AI, and manage approved follow-up."
  },
  signup: {
    eyebrow: "Create workspace",
    title: "Start converting leads with AI qualification",
    body: "Create your workspace with Google. Leadsy will prepare WhatsApp routing and AI qualification during onboarding."
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
    <main className="page-shell min-h-screen px-4 py-5 md:px-6">
      <div className="noise" />
      <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-[1520px] flex-col">
        <header className="flex h-12 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-[7px] bg-[var(--teal)] text-black">
              <Sparkles size={18} />
            </span>
            <span className="font-semibold">Leadsy</span>
          </Link>
          <Badge tone="teal">AI Lead Capture, Qualification & Conversion Platform</Badge>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(360px,520px)_minmax(0,1fr)] xl:gap-12">
          <div className="w-full">
            <Panel className="overflow-hidden p-4 md:p-5">
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.025] p-4">
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

          <OperatorPreview />
        </section>
      </div>
    </main>
  );
}

function OperatorPreview() {
  const navItems = ["Dashboard", "Leads", "Inbox", "Calendar", "Team", "Settings"];
  const pipelineStatuses = ["New", "Qualified", "Interested", "Contacted", "Won", "Lost"];

  return (
    <div className="hidden min-h-[720px] overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="border-r border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[var(--teal)] text-sm font-bold text-black">L</span>
          <span>
            <span className="block text-sm font-semibold text-white">Leadsy</span>
            <span className="block text-xs text-[var(--muted)]">Helio · Operations</span>
          </span>
        </div>
        <div className="mt-8 space-y-1">
          {navItems.map((item, index) => (
            <div key={item} className={`flex h-9 items-center justify-between rounded-[6px] px-3 text-sm ${index === 0 ? "bg-white/[0.08] text-white" : "text-[var(--muted-2)]"}`}>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </aside>

      <section className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--muted-2)]">Leadsy / <span className="text-white">Dashboard</span></div>
          <Badge tone="teal">AI qualification ready</Badge>
        </div>
        <div className="mt-8">
          <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Operator overview</div>
          <h2 className="mt-3 text-2xl font-medium text-white">Conversion workspace preview</h2>
          <p className="mt-2 text-sm text-[var(--muted-2)]">Live lead counts appear after a workspace connects sources or logs leads.</p>
        </div>

        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-[8px] border border-[var(--line)]">
          {pipelineStatuses.map((status) => {
            return (
              <div key={status} className="border-r border-[var(--line)] p-4">
                <div className="flex items-center justify-between text-[var(--muted)]">
                  <UsersRound size={16} />
                  <span className="mono text-xs text-[var(--teal)]">status</span>
                </div>
                <div className="mt-5 text-sm font-medium text-white">{status}</div>
                <div className="mt-1 text-xs text-[var(--muted-2)]">No live records yet</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)] overflow-hidden rounded-[8px] border border-[var(--line)]">
          <div className="p-4">
            <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Qualification funnel · 7d</div>
            <div className="mt-5 flex min-h-[168px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] text-center">
              <Sparkles size={20} className="text-[var(--teal)]" />
              <div className="mt-3 text-sm font-medium text-white">No live lead data yet</div>
              <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted-2)]">Captured, qualified, interested, and contacted records will appear here from real workspace data.</p>
            </div>
          </div>
          <div className="border-l border-[var(--line)] p-4">
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              <RadioTower size={13} />
              Lead sources
            </div>
            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-[8px] border border-dashed border-[var(--line)] p-4 text-[var(--muted-2)]">
                Leadsy-managed WhatsApp and manual intake populate real source performance.
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="border-l border-[var(--line)] bg-black/15">
        <div className="border-b border-[var(--line)] p-5">
          <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Needs you</div>
          <p className="mt-2 text-sm text-[var(--muted-2)]">Approvals and follow-ups appear only when real workspace items need review.</p>
        </div>
        <div className="p-5">
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-[var(--line)] text-center">
            <CheckSquare size={22} className="text-[var(--teal)]" />
            <div className="mt-3 text-sm font-semibold text-white">No live approvals in preview</div>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted-2)]">Drafts, follow-ups, and automation reviews stay empty until real records exist.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--line)] p-5 text-sm text-[var(--muted-2)]">
          <MessageCircle size={16} />
          Conversation-first workspace
        </div>
      </aside>
    </div>
  );
}
