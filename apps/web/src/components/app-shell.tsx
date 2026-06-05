"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Grid2X2,
  LogOut,
  Menu,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Plus,
  Search,
  Settings,
  UsersRound,
  X,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SessionUser } from "@leadsy/security";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { ToastProvider } from "@/components/toast-provider";

const workflowNavItems: Array<{ href: string; label: string; icon: LucideIcon; activePaths: string[]; count?: string }> = [
  { href: "/app", label: "Dashboard", icon: Grid2X2, activePaths: ["/app", "/dashboard"] },
  { href: "/app/leads", label: "CRM", icon: UsersRound, activePaths: ["/app/leads", "/crm"] },
  { href: "/app/worker", label: "Workers", icon: Bot, activePaths: ["/app/worker", "/workers"] },
  { href: "/app/worker?tab=pending", label: "Approvals", icon: CheckCircle2, activePaths: ["/app/worker", "/workers"] },
  { href: "/app/leads?tab=communications", label: "Communications", icon: MessageSquareText, activePaths: ["/app/leads", "/crm"] },
  { href: "/app/leads?tab=tasks", label: "Tasks", icon: ClipboardList, activePaths: ["/app/leads", "/crm"] },
  { href: "/app/connect", label: "Integrations", icon: Plug, activePaths: ["/app/connect"] },
  { href: "/app/connect?panel=settings", label: "Settings", icon: Settings, activePaths: ["/app/connect", "/settings"] }
];

const knowledgeNavItems: Array<{ href: string; label: string; icon: LucideIcon; count: string }> = [
  { href: "/app/leads?panel=knowledge&view=icp", label: "ICP & playbooks", icon: BookOpen, count: "12" },
  { href: "/app/leads?panel=knowledge", label: "Recent AI findings", icon: BookOpen, count: "38" },
  { href: "/app/leads?panel=knowledge&view=snippets", label: "Snippets", icon: BookOpen, count: "24" }
];

const pageTitles: Array<{ path: string; title: string; eyebrow: string }> = [
  { path: "/app/connect", title: "Integrations", eyebrow: "Leadsy" },
  { path: "/app/worker", title: "Workers", eyebrow: "Leadsy" },
  { path: "/app/leads", title: "CRM", eyebrow: "Leadsy" },
  { path: "/app", title: "Dashboard", eyebrow: "Leadsy" }
];

type SearchParamsLike = Pick<URLSearchParams, "get">;

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "L"
  );
}

function pageTitleForPath(pathname: string, searchParams: SearchParamsLike) {
  if ((pathname === "/app/worker" || pathname === "/workers") && searchParams.get("tab") === "pending") {
    return { path: "/app/worker", title: "Approvals", eyebrow: "Leadsy" };
  }
  if ((pathname === "/app/leads" || pathname === "/crm") && searchParams.get("panel") === "knowledge") {
    return { path: "/app/leads", title: "Knowledge", eyebrow: "Leadsy" };
  }
  if ((pathname === "/app/connect" || pathname === "/settings") && searchParams.get("panel") === "settings") {
    return { path: "/app/connect", title: "Settings", eyebrow: "Leadsy" };
  }
  return pageTitles.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)) ?? pageTitles.at(-1)!;
}

function searchParamsMatch(searchParams: SearchParamsLike, href: string) {
  const [, query = ""] = href.split("?");
  if (!query) return true;
  const hrefParams = new URLSearchParams(query);
  return [...hrefParams.entries()].every(([key, value]) => searchParams.get(key) === value);
}

function isNavItemActive(pathname: string, searchParams: SearchParamsLike, label: string, href: string, activePaths: string[]) {
  if (label === "Dashboard") return pathname === "/app" || pathname === "/dashboard";
  const activePath = activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!activePath) return false;
  if (href.includes("?")) return searchParamsMatch(searchParams, href);
  if (label === "CRM") return searchParams.get("panel") !== "knowledge" && !searchParams.get("tab");
  if (label === "Workers") return searchParams.get("tab") !== "pending";
  if (label === "Integrations") return searchParams.get("panel") !== "settings";
  return true;
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  count,
  expanded,
  onClick
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  count?: string;
  expanded: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`group flex h-9 items-center gap-3 rounded-[6px] px-3 text-sm ${
        active
          ? "bg-white/[0.08] text-white"
          : "text-[var(--muted-2)] hover:bg-white/[0.045] hover:text-white"
      } ${expanded ? "justify-start" : "justify-center"}`}
    >
      <Icon size={17} className={active ? "text-[var(--teal)]" : "text-[var(--muted)] group-hover:text-[var(--muted-2)]"} />
      {expanded ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
      {expanded && count ? <span className="mono text-xs text-[var(--muted)]">{count}</span> : null}
    </Link>
  );
}

export function AppShell({
  children,
  session,
  hasMetaConnection = false,
  pendingApprovalCount = 0
}: {
  children: ReactNode;
  session: SessionUser;
  hasMetaConnection?: boolean;
  pendingApprovalCount?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const page = pageTitleForPath(pathname, searchParams);
  const setupIssues = hasMetaConnection ? 0 : 1;
  const onboardingReminder = session.onboardingCompletedAt ? 0 : 1;
  const notificationCount = setupIssues + pendingApprovalCount + onboardingReminder;

  const notificationItems = useMemo(
    () => [
      ...(session.onboardingCompletedAt
        ? []
        : [
            {
              title: "Finish onboarding",
              detail: "Complete your business profile so workers can generate better lead research and tasks.",
              href: "/app/leads"
            }
          ]),
      ...(hasMetaConnection
        ? []
        : [
            {
              title: "Meta connection needs attention",
              detail: "Connect Facebook, Instagram, or WhatsApp before lead ingestion is complete.",
              href: "/app/connect"
            }
          ]),
      {
        title: "Approval queue",
        detail: pendingApprovalCount ? `${pendingApprovalCount} worker item needs review.` : "Worker approvals will appear before outreach is sent.",
        href: "/app/worker?tab=pending"
      }
    ],
    [hasMetaConnection, pendingApprovalCount, session.onboardingCompletedAt]
  );

  const sidebarWidth = sidebarExpanded ? "lg:pl-[312px]" : "lg:pl-[84px]";

  async function logout() {
    if (logoutPending) return;
    setLogoutPending(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as { redirectTo?: unknown };
      router.replace(typeof payload.redirectTo === "string" ? payload.redirectTo : "/login");
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  const nav = (
    <div className="flex flex-1 flex-col gap-6" aria-label="Primary">
      <div className="space-y-1">
        {sidebarExpanded ? <div className="mono px-3 pb-2 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">Workflow</div> : null}
        {workflowNavItems.map((item) => {
          const count = item.label === "Approvals" && pendingApprovalCount ? String(pendingApprovalCount) : item.count;
          return (
            <SidebarLink
              key={`${item.label}-${item.href}`}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isNavItemActive(pathname, searchParams, item.label, item.href, item.activePaths)}
              count={count}
              expanded={sidebarExpanded}
              onClick={() => setMobileOpen(false)}
            />
          );
        })}
      </div>
      <div className="space-y-1">
        {sidebarExpanded ? <div className="mono px-3 pb-2 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">Knowledge</div> : null}
        {knowledgeNavItems.map((item) => {
          const view = searchParams.get("view") ?? "recent";
          const active =
            pathname === "/app/leads" &&
            searchParams.get("panel") === "knowledge" &&
            ((view === "recent" && item.label === "Recent AI findings") ||
              (view === "icp" && item.label === "ICP & playbooks") ||
              (view === "snippets" && item.label === "Snippets"));
          return (
            <SidebarLink
              key={`${item.label}-${item.href}`}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
              count={item.count}
              expanded={sidebarExpanded}
              onClick={() => setMobileOpen(false)}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div data-layout="lovable-operator" className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <aside
          data-testid="global-sidebar"
          data-state={sidebarExpanded ? "expanded" : "collapsed"}
          className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[var(--line)] bg-[var(--surface)] lg:block ${
            sidebarExpanded ? "w-[312px]" : "w-[84px]"
          }`}
        >
          <div className={`flex h-full flex-col py-4 ${sidebarExpanded ? "px-3" : "items-center px-2"}`}>
            <div className={`flex items-center gap-3 px-1 ${sidebarExpanded ? "justify-between" : "flex-col"}`}>
              <Link href="/app" aria-label="Leadsy dashboard" className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-[var(--teal)] text-sm font-bold text-black">
                  L
                </span>
                {sidebarExpanded ? (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">Leadsy</span>
                    <span className="block truncate text-xs text-[var(--muted)]">Helio · Operations</span>
                  </span>
                ) : null}
              </Link>
              <button
                type="button"
                data-testid="sidebar-toggle"
                aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                aria-expanded={sidebarExpanded}
                onClick={() => setSidebarExpanded((current) => !current)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--muted-2)] hover:bg-white/[0.045] hover:text-white"
              >
                {sidebarExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
            </div>

            {sidebarExpanded ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  className="flex h-10 w-full items-center gap-2 rounded-[6px] border border-[var(--line)] bg-black/20 px-3 text-sm text-[var(--muted-2)] hover:border-[var(--line-strong)] hover:text-white"
                >
                  <Search size={16} />
                  <span className="flex-1 text-left">Quick search</span>
                  <span className="mono rounded-[5px] border border-[var(--line)] bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">⌘K</span>
                </button>
                <Link
                  href="/app/leads?new=lead"
                  className="flex h-9 items-center gap-3 rounded-[6px] px-3 text-sm text-[var(--muted-2)] hover:bg-white/[0.045] hover:text-white"
                >
                  <Plus size={16} />
                  <span className="flex-1">New lead</span>
                  <span className="mono rounded-[5px] border border-[var(--line)] bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-[var(--muted)]">N</span>
                </Link>
              </div>
            ) : null}

            <nav className="mt-7 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-dark">{nav}</nav>

            <div className={`border-t border-[var(--line)] pt-4 ${sidebarExpanded ? "space-y-3" : "w-full space-y-2"}`}>
              <div className={`flex items-center gap-3 px-2 ${sidebarExpanded ? "" : "justify-center"}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.04] text-xs font-semibold text-white">
                  {initials(session.name)}
                </div>
                {sidebarExpanded ? (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{session.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{session.role} · Helio</div>
                  </div>
                ) : null}
                {sidebarExpanded ? (
                  <button
                    type="button"
                    aria-label="Open notifications"
                    onClick={() => setNotificationsOpen((current) => !current)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--muted-2)] hover:bg-white/[0.045] hover:text-white"
                  >
                    <Bell size={16} />
                  </button>
                ) : null}
              </div>
              {sidebarExpanded ? (
                <button
                  type="button"
                  onClick={logout}
                  disabled={logoutPending}
                  className="flex h-9 w-full items-center gap-2 rounded-[6px] px-2 text-sm text-[var(--muted-2)] hover:bg-white/[0.045] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut size={16} />
                  {logoutPending ? "Logging out..." : "Logout"}
                </button>
              ) : null}
            </div>
          </div>
        </aside>

        <header className={`sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(8,10,12,0.92)] backdrop-blur-xl ${sidebarWidth}`}>
          <div className="flex min-h-[64px] items-center justify-between gap-4 px-4 md:px-6">
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
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate text-[var(--muted)]">{page.eyebrow}</span>
                <span className="text-[var(--line-strong)]">/</span>
                <h1 className="truncate font-medium text-white">{page.title}</h1>
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              <Link
                href="/app/worker"
                className="hidden h-9 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.035] px-3 text-sm text-[var(--muted-2)] hover:border-[var(--line-strong)] hover:text-white md:inline-flex"
              >
                <Zap size={15} className="text-[var(--teal)]" />
                <span className="mono">4 workers running · queue {82 + pendingApprovalCount}</span>
              </Link>
              <Link
                href="/app/leads?filters=open"
                className="hidden h-9 items-center rounded-[6px] border border-[var(--line)] bg-white/[0.035] px-3 text-sm text-[var(--muted-2)] hover:border-[var(--line-strong)] hover:text-white sm:inline-flex"
              >
                Filter
              </Link>
              <Link
                href="/app/leads?new=lead"
                className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-[var(--teal)] px-3 text-sm font-medium text-black hover:bg-teal-200"
              >
                <Plus size={16} />
                New
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
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.035] text-[var(--muted-2)] hover:text-white"
              >
                <Bell size={16} />
                {notificationCount ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--teal)] px-1 text-[10px] font-bold text-black">
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
                    <div className="text-sm font-semibold text-white">Needs you</div>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--muted-2)] hover:bg-white/[0.04] hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-[var(--line)] rounded-[8px] border border-[var(--line)]">
                    {notificationItems.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        onClick={() => setNotificationsOpen(false)}
                        className="block p-3 hover:bg-white/[0.035]"
                      >
                        <span className="block text-sm font-medium text-white">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--muted-2)]">{item.detail}</span>
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
                className="hidden h-9 items-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.035] px-2 text-sm text-[var(--muted-2)] hover:text-white md:inline-flex"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-semibold text-white">
                  {initials(session.name)}
                </span>
                <ChevronDown size={14} />
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
                  <button
                    type="button"
                    onClick={logout}
                    disabled={logoutPending}
                    className="flex h-9 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm text-rose-100 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut size={15} />
                    {logoutPending ? "Logging out..." : "Logout"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {mobileOpen ? (
          <div data-testid="mobile-nav-drawer" className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm lg:hidden">
            <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Leadsy</div>
                  <div className="text-xs text-[var(--muted)]">Helio · Operations</div>
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
              <div className="mt-5">{nav}</div>
            </div>
          </div>
        ) : null}

        <main className={sidebarWidth}>
          <div className="min-h-[calc(100vh-64px)]">{children}</div>
        </main>
        {!session.onboardingCompletedAt ? <OnboardingWizard session={session} hasMetaConnection={hasMetaConnection} /> : null}
      </div>
    </ToastProvider>
  );
}
