"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Grid2X2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  Sparkles,
  UsersRound,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "@leadsy/security";
import { ToastProvider } from "@/components/toast-provider";

const navItems: Array<{ href: string; label: string; icon: LucideIcon; activePaths: string[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: Grid2X2, activePaths: ["/app", "/dashboard"] },
  { href: "/crm", label: "CRM", icon: UsersRound, activePaths: ["/app/leads", "/crm"] },
  { href: "/workers", label: "Workers", icon: Bot, activePaths: ["/app/worker", "/workers"] },
  { href: "/workers?tab=pending", label: "Approvals", icon: CheckCircle2, activePaths: ["/app/worker", "/workers"] },
  { href: "/crm?panel=knowledge", label: "Knowledge", icon: BookOpen, activePaths: ["/app/leads", "/crm"] },
  { href: "/app/connect", label: "Integrations", icon: Plug, activePaths: ["/app/connect"] },
  { href: "/settings", label: "Settings", icon: Settings, activePaths: ["/app/connect", "/settings"] }
];

const pageTitles: Array<{ path: string; title: string; eyebrow: string }> = [
  { path: "/app/connect", title: "Integrations", eyebrow: "Configuration" },
  { path: "/app/worker", title: "Worker Center", eyebrow: "AI operations" },
  { path: "/app/leads", title: "CRM", eyebrow: "Lead intelligence" },
  { path: "/app", title: "Dashboard", eyebrow: "Operations" }
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "L";
}

function pageTitleForPath(pathname: string) {
  return pageTitles.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)) ?? pageTitles.at(-1)!;
}

function isNavItemActive(pathname: string, label: string, activePaths: string[]) {
  if (label === "Dashboard") return pathname === "/app" || pathname === "/dashboard";
  if (label === "Approvals" || label === "Knowledge" || label === "Settings") return false;
  return activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function AppShell({
  children,
  session,
  hasMetaConnection = false
}: {
  children: ReactNode;
  session: SessionUser;
  hasMetaConnection?: boolean;
}) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const page = pageTitleForPath(pathname);
  const setupIssues = hasMetaConnection ? 0 : 1;
  const pendingApprovals = 0;
  const notificationCount = setupIssues + pendingApprovals;

  const notificationItems = useMemo(
    () => [
      ...(hasMetaConnection
        ? []
        : [
            {
              title: "Meta messaging connection needs attention",
              detail: "Connect Facebook, Instagram, or WhatsApp before lead ingestion is complete.",
              href: "/app/connect",
              tone: "amber" as const
            }
          ]),
      {
        title: "Approval queue ready",
        detail: pendingApprovals ? `${pendingApprovals} worker item needs review.` : "Worker approvals will appear here before any outreach action.",
        href: "/app/worker?tab=pending",
        tone: "teal" as const
      }
    ],
    [hasMetaConnection, pendingApprovals]
  );

  const sidebarWidth = sidebarExpanded ? "lg:pl-[248px]" : "lg:pl-[88px]";

  const nav = (
    <nav className="flex flex-1 flex-col gap-2" aria-label="Primary">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isNavItemActive(pathname, item.label, item.activePaths);
        return (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`group flex h-11 items-center gap-3 rounded-[8px] border px-3 text-sm font-medium ${
              active
                ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                : "border-transparent text-[var(--muted-2)] hover:border-[var(--line)] hover:bg-white/[0.04] hover:text-white"
            } ${sidebarExpanded ? "justify-start" : "justify-center"}`}
            title={item.label}
          >
            <Icon size={18} className="shrink-0" />
            {sidebarExpanded ? <span className="truncate">{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="noise" />

        <aside
          data-testid="global-sidebar"
          data-state={sidebarExpanded ? "expanded" : "collapsed"}
          className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[var(--line)] bg-black/45 backdrop-blur-xl lg:block ${
            sidebarExpanded ? "w-[248px]" : "w-[88px]"
          }`}
        >
          <div className={`flex h-full flex-col gap-4 py-5 ${sidebarExpanded ? "px-4" : "items-center px-3"}`}>
            <div className={`flex items-center gap-3 ${sidebarExpanded ? "justify-between" : "flex-col"}`}>
              <Link
                href="/"
                aria-label="Leadsy home"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-teal-300/30 bg-teal-300/10 text-teal-200"
              >
                <Sparkles size={19} />
              </Link>
              {sidebarExpanded ? (
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">Leadsy</div>
                  <div className="mono text-[10px] uppercase text-[var(--muted)]">AI lead intelligence</div>
                </div>
              ) : null}
              <button
                type="button"
                data-testid="sidebar-toggle"
                aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                aria-expanded={sidebarExpanded}
                onClick={() => setSidebarExpanded((current) => !current)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
              >
                {sidebarExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
            </div>

            {nav}

            <div className={`border-t border-[var(--line)] pt-4 ${sidebarExpanded ? "" : "w-full"}`}>
              <div className={`flex items-center gap-3 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-2 ${sidebarExpanded ? "" : "justify-center"}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-300/15 text-xs font-semibold text-teal-100">
                  {initials(session.name)}
                </div>
                {sidebarExpanded ? (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{session.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{session.role}</div>
                  </div>
                ) : null}
              </div>
              {sidebarExpanded ? (
                <Link
                  href="/logout"
                  className="mt-2 flex h-9 items-center gap-2 rounded-[6px] px-2 text-sm text-[var(--muted-2)] hover:bg-white/[0.04] hover:text-white"
                >
                  <LogOut size={16} />
                  Logout
                </Link>
              ) : null}
            </div>
          </div>
        </aside>

        <header className={`sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(7,9,11,0.86)] backdrop-blur-xl ${sidebarWidth}`}>
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open mobile navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <div className="mono text-[11px] uppercase text-[var(--muted)]">{page.eyebrow}</div>
                <h1 className="truncate text-lg font-semibold text-white md:text-xl">{page.title}</h1>
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              <Link
                href="/app/connect"
                className={`hidden h-10 items-center gap-2 rounded-[6px] border px-3 text-sm md:inline-flex ${
                  hasMetaConnection
                    ? "border-teal-300/25 bg-teal-300/10 text-teal-100"
                    : "border-amber-300/25 bg-amber-300/10 text-amber-100"
                }`}
              >
                <Plug size={16} />
                <span>Meta messaging connection</span>
                <span className="mono text-[10px] uppercase">{hasMetaConnection ? "Connected" : "Action needed"}</span>
              </Link>

              <button
                type="button"
                data-testid="notification-bell"
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setUserMenuOpen(false);
                }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
              >
                <Bell size={17} />
                {notificationCount ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-bold text-black">
                    {notificationCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div
                  data-testid="notification-center"
                  className="absolute right-12 top-12 z-40 w-[min(360px,calc(100vw-2rem))] rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">Notifications</div>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--muted-2)] hover:bg-white/[0.04] hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {notificationItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setNotificationsOpen(false)}
                        className="flex gap-3 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 hover:border-[var(--line-strong)]"
                      >
                        <CircleAlert size={17} className={item.tone === "amber" ? "text-amber-200" : "text-teal-200"} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-white">{item.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--muted-2)]">{item.detail}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                data-testid="user-menu"
                aria-label="Open user menu"
                aria-expanded={userMenuOpen}
                onClick={() => {
                  setUserMenuOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-2 text-sm text-[var(--muted-2)] hover:text-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-300/15 text-[10px] font-semibold text-teal-100">
                  {initials(session.name)}
                </span>
                <ChevronDown size={14} className="hidden md:block" />
              </button>

              {userMenuOpen ? (
                <div className="absolute right-0 top-12 z-40 w-56 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xl">
                  <div className="border-b border-[var(--line)] px-2 pb-2">
                    <div className="truncate text-sm font-medium text-white">{session.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{session.email}</div>
                  </div>
                  <Link href="/app/connect?panel=profile" className="mt-2 flex h-9 items-center rounded-[6px] px-2 text-sm text-[var(--muted-2)] hover:bg-white/[0.04] hover:text-white">
                    Profile
                  </Link>
                  <Link href="/app/connect?panel=settings" className="flex h-9 items-center rounded-[6px] px-2 text-sm text-[var(--muted-2)] hover:bg-white/[0.04] hover:text-white">
                    Settings
                  </Link>
                  <Link href="/logout" className="flex h-9 items-center gap-2 rounded-[6px] px-2 text-sm text-rose-100 hover:bg-rose-300/10">
                    <LogOut size={15} />
                    Logout
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {mobileOpen ? (
          <div data-testid="mobile-nav-drawer" className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm lg:hidden">
            <div className="absolute inset-x-0 bottom-0 rounded-t-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Leadsy</div>
                  <div className="mono text-[10px] uppercase text-[var(--muted)]">AI lead intelligence</div>
                </div>
                <button
                  type="button"
                  aria-label="Close mobile navigation"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--line)] text-[var(--muted-2)] hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4">{nav}</div>
            </div>
          </div>
        ) : null}

        <main className={sidebarWidth}>
          <div className="px-4 py-6 md:px-8">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
