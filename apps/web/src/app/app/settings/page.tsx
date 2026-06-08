import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, Bot, Brain, Building2, Search, User } from "lucide-react";
import { SettingsConsole } from "@/components/settings-console";
import { getCurrentSession } from "@/lib/auth";
import {
  getAiWorkspaceSettings,
  getNotificationPreferences,
  getOperatorProfileSettings,
  getWorkspaceBusinessSettings,
  type AiWorkspaceSettings,
  type NotificationPreferences,
  type OperatorKnowledgeProfile,
  type WorkspaceBusinessSettings
} from "@/lib/user-settings-store";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type SettingsSection = "profile" | "workspace" | "ai" | "agents" | "notifications";

const groups: Array<{ id: SettingsSection; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "ai", label: "AI", icon: Brain },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "notifications", label: "Notifications", icon: Bell }
];

const sectionSummaries: Record<SettingsSection, {
  eyebrow: string;
  title: string;
  detail: string;
  primaryHref?: string;
  primaryLabel?: string;
}> = {
  profile: {
    eyebrow: "Settings / Profile",
    title: "Operator profile",
    detail: "Operator knowledge base, identity, working style, restrictions, and escalation context used by AI and human handoffs."
  },
  workspace: {
    eyebrow: "Settings / Workspace",
    title: "Workspace",
    detail: "Business operations, pipeline defaults, qualification fields, assignment rules, follow-up rules, and calendar defaults."
  },
  ai: {
    eyebrow: "Settings / AI",
    title: "Advanced AI Lab",
    detail: "Prompt templates, model routing, generation controls, cost policy, safety rules, and a deterministic test console."
  },
  agents: {
    eyebrow: "Settings / Agents",
    title: "Teamspace agents",
    detail: "Human members, full AI agents, assisted AI agents, pipeline ownership, sender modes, and auto-reply toggles.",
    primaryHref: "/app/team",
    primaryLabel: "Open teamspace"
  },
  notifications: {
    eyebrow: "Settings / Notifications",
    title: "Notification preferences",
    detail: "Quiet hours, event categories, delivery channels, role routing, digests, and notification center behavior."
  }
};

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function sectionFromValue(value: string): SettingsSection {
  if (groups.some((group) => group.id === value)) return value as SettingsSection;
  return "workspace";
}

function emailConfigured() {
  return Boolean(process.env.SMTP_HOST || process.env.EMAIL_SERVER || process.env.RESEND_API_KEY || process.env.POSTMARK_SERVER_TOKEN);
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : {};
  const activeSection = sectionFromValue(paramValue(params, "section"));
  const section = sectionSummaries[activeSection];
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [profile, workspace, ai, notifications] = scope
    ? await Promise.all([
        getOperatorProfileSettings(scope),
        getWorkspaceBusinessSettings(scope),
        getAiWorkspaceSettings(scope),
        getNotificationPreferences(scope)
      ])
    : ([
        undefined,
        undefined,
        undefined,
        undefined
      ] as [OperatorKnowledgeProfile | undefined, WorkspaceBusinessSettings | undefined, AiWorkspaceSettings | undefined, NotificationPreferences | undefined]);

  return (
    <div className="grid h-full min-h-0 min-w-0 grid-cols-12 gap-px overflow-hidden bg-border">
      <aside className="col-span-12 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-background md:col-span-3 xl:col-span-2">
        <div className="border-b border-border p-3">
          <div className="flex h-7 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <span className="flex-1 text-[12px] text-muted-foreground">Search settings...</span>
          </div>
        </div>
        <nav className="p-2">
          {groups.map((group) => {
            const Icon = group.icon;
            const active = group.id === activeSection;
            return (
              <Link key={group.id} href={`/app/settings?section=${group.id}`} className={`nav-item w-full ${active ? "bg-sidebar-accent text-foreground" : ""}`}>
                <Icon className="nav-icon" />
                <span className="flex-1 text-left">{group.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="col-span-12 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-background md:col-span-9 xl:col-span-10">
        <div className="mx-auto w-full min-w-0 max-w-5xl p-6">
          <div className="caption">{section.eyebrow}</div>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <h1 className="mt-1 text-[22px] tracking-tight">{section.title}</h1>
              <p className="mt-0.5 max-w-3xl text-[12.5px] leading-6 text-muted-foreground">{section.detail}</p>
            </div>
            {section.primaryHref ? (
              <Link href={section.primaryHref} className="inline-flex h-8 items-center rounded-[5px] bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                {section.primaryLabel}
              </Link>
            ) : null}
          </div>

          {activeSection === "agents" ? (
            <section className="mt-6 rounded-[8px] border border-border bg-background p-5">
              <h2 className="text-[15px] font-semibold">Agent controls live in Teamspace</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted-foreground">
                Create human members, full AI agents, and assisted AI agents from Teamspace. Each member can own pipeline stages, sender identity, workload, and auto-reply settings.
              </p>
              <Link href="/app/team" className="mt-4 inline-flex h-9 items-center rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Open teamspace
              </Link>
            </section>
          ) : profile && workspace && ai && notifications ? (
            <SettingsConsole
              activeSection={activeSection}
              profile={profile}
              workspace={workspace}
              ai={ai}
              notifications={notifications}
              emailConfigured={emailConfigured()}
            />
          ) : (
            <div className="mt-6 rounded-[8px] border border-border bg-surface p-6 text-sm text-muted-foreground">
              Sign in to edit Leadsy settings.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
