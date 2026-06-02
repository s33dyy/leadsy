import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Cable,
  Crosshair,
  GitBranch,
  Camera,
  LayoutDashboard,
  LogOut,
  Magnet,
  MessageCircle,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import type { SessionUser } from "@leadsy/security";
import { CopilotDock } from "./copilot-dock";

const navItems = [
  { href: "/app", label: "Ops", icon: LayoutDashboard },
  { href: "/app/magnet", label: "Magnet", icon: Magnet },
  { href: "/app/inbox", label: "WhatsApp", icon: MessageCircle },
  { href: "/app/meta", label: "Meta", icon: Camera },
  { href: "/app/clients", label: "Clients", icon: Building2 },
  { href: "/app/crm", label: "CRM", icon: Users },
  { href: "/app/intelligence", label: "Intel", icon: Crosshair },
  { href: "/app/outreach", label: "Outreach", icon: RadioTower },
  { href: "/app/workflows", label: "Flows", icon: GitBranch },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/capture", label: "Capture", icon: Cable },
  { href: "/app/extension", label: "Worker", icon: Bot }
];

export function AppShell({ children, session }: { children: ReactNode; session: SessionUser }) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="noise" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[88px] border-r border-[var(--line)] bg-black/35 backdrop-blur-xl lg:block">
        <div className="flex h-full flex-col items-center gap-4 py-5">
          <Link
            href="/"
            aria-label="Leadsy home"
            className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200"
          >
            <Sparkles size={19} />
          </Link>
          <nav className="mt-4 flex flex-1 flex-col items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className="group flex h-12 w-12 items-center justify-center rounded-[8px] border border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:bg-white/[0.04] hover:text-white"
                  title={item.label}
                >
                  <Icon size={19} />
                </Link>
              );
            })}
          </nav>
          <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted)]">
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(7,9,11,0.82)] backdrop-blur-xl lg:pl-[88px]">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 md:px-8">
          <div>
            <div className="mono text-[11px] uppercase text-[var(--muted)]">Leadsy Revenue OS</div>
            <div className="flex items-center gap-2 text-sm text-[var(--muted-2)]">
              <span className="h-2 w-2 rounded-full bg-[var(--teal)] signal-pulse" />
              Agency workspace: {session.name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--muted-2)] md:flex">
              <Activity size={16} className="text-[var(--teal)]" />
              Clean workspace · connect sources
            </div>
            <a
              href="/app/magnet"
              className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-amber-300/30 bg-amber-300/10 px-3 text-sm text-amber-100 hover:bg-amber-300/15"
            >
              <Bot size={16} />
              Find leads
            </a>
            <a
              href="/logout"
              aria-label="Log out"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
              title="Log out"
            >
              <LogOut size={16} />
            </a>
          </div>
        </div>
      </header>

      <main className="lg:pl-[88px]">
        <div className="px-4 py-6 md:px-8">{children}</div>
      </main>
      <CopilotDock />
    </div>
  );
}
