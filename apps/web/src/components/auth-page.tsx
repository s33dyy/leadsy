import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, CheckSquare, LockKeyhole, MessageCircle, RadioTower, Sparkles, UsersRound } from "lucide-react";
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
          <Badge tone="teal">AI Lead Intelligence</Badge>
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
  const metrics = [
    { label: "New leads · 24h", value: "38", icon: UsersRound, delta: "+12" },
    { label: "Qualified · 24h", value: "14", icon: Sparkles, delta: "+4" },
    { label: "Worker activity", value: "4", icon: Bot, delta: "live" },
    { label: "Pending approvals", value: "7", icon: CheckSquare, delta: "+2" }
  ];
  const funnel = [
    ["Captured", 100, "412"],
    ["Researched", 77, "318"],
    ["Qualified", 45, "184"],
    ["Engaged", 24, "96"]
  ] as const;
  const needsYou = [
    ["P0", "WhatsApp reply to Marina Okafor", "Worker drafted a follow-up that needs review."],
    ["P0", "Helio Robotics expansion brief", "Research brief is ready for qualification."],
    ["P1", "Qualification rationale for Theodor Voss", "Score 88. Review before outreach."]
  ] as const;

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
          {["Dashboard", "CRM", "Workers", "Approvals", "Communications", "Tasks", "Integrations"].map((item, index) => (
            <div key={item} className={`flex h-9 items-center justify-between rounded-[6px] px-3 text-sm ${index === 0 ? "bg-white/[0.08] text-white" : "text-[var(--muted-2)]"}`}>
              <span>{item}</span>
              {item === "Approvals" ? <span className="rounded bg-teal-300/15 px-1.5 text-xs text-teal-200">7</span> : null}
            </div>
          ))}
        </div>
      </aside>

      <section className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--muted-2)]">Leadsy / <span className="text-white">Dashboard</span></div>
          <Badge tone="teal">4 workers running · queue 82</Badge>
        </div>
        <div className="mt-8">
          <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Operator overview</div>
          <h2 className="mt-3 text-2xl font-medium text-white">Good morning, Iris.</h2>
          <p className="mt-2 text-sm text-[var(--muted-2)]">7 items need your eyes · 4 workers running · pipeline is healthy.</p>
        </div>

        <div className="mt-6 grid grid-cols-4 overflow-hidden rounded-[8px] border border-[var(--line)]">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="border-r border-[var(--line)] p-4">
                <div className="flex items-center justify-between text-[var(--muted)]">
                  <Icon size={16} />
                  <span className="mono text-xs text-[var(--teal)]">{metric.delta}</span>
                </div>
                <div className="mt-5 text-2xl font-medium text-white">{metric.value}</div>
                <div className="mt-1 text-xs text-[var(--muted-2)]">{metric.label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)] overflow-hidden rounded-[8px] border border-[var(--line)]">
          <div className="p-4">
            <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Qualification funnel · 7d</div>
            <div className="mt-5 space-y-3">
              {funnel.map(([label, width, value]) => (
                <div key={label} className="grid grid-cols-[84px_minmax(0,1fr)_42px] items-center gap-3">
                  <span className="text-sm text-[var(--muted-2)]">{label}</span>
                  <span className="h-6 rounded-[5px] bg-white/[0.05]">
                    <span className="block h-full rounded-[5px] bg-emerald-400" style={{ width: `${width}%` }} />
                  </span>
                  <span className="mono text-xs text-[var(--muted)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-l border-[var(--line)] p-4">
            <div className="flex items-center gap-2 mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              <RadioTower size={13} />
              Lead sources
            </div>
            <div className="mt-5 space-y-4 text-sm">
              {["Instagram", "WhatsApp", "Meta Ads", "Extension"].map((source, index) => (
                <div key={source} className="flex items-center justify-between gap-3">
                  <span className="text-white">{source}</span>
                  <span className="mono text-xs text-[var(--muted)]">{[38, 27, 18, 11][index]}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="border-l border-[var(--line)] bg-black/15">
        <div className="border-b border-[var(--line)] p-5">
          <div className="mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">Needs you</div>
          <p className="mt-2 text-sm text-[var(--muted-2)]">5 items pending across 4 workers.</p>
        </div>
        <div className="divide-y divide-[var(--line)]">
          {needsYou.map(([priority, title, detail]) => (
            <div key={title} className="p-5">
              <div className="mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                <span className={priority === "P0" ? "text-rose-300" : "text-amber-300"}>{priority}</span> Draft
              </div>
              <div className="mt-3 text-sm font-semibold text-white">{title}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">{detail}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-[6px] bg-[var(--teal)] px-3 py-1.5 text-sm font-medium text-black">Approve</span>
                <span className="rounded-[6px] border border-[var(--line)] px-3 py-1.5 text-sm text-white">Edit</span>
                <span className="text-sm text-[var(--muted-2)]">Reject</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--line)] p-5 text-sm text-[var(--muted-2)]">
          <MessageCircle size={16} />
          Conversation-first workspace
        </div>
      </aside>
    </div>
  );
}
