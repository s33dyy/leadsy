"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronsUpDown,
  Command,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings as SettingsIcon,
  UserRound,
  Users2,
  X,
  type LucideIcon
} from "lucide-react";
import type { SessionUser } from "@leadsy/security";
import { CostReceiptButton } from "@/components/cost-receipt-button";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { ToastProvider } from "@/components/toast-provider";

type ShellLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  count?: string;
  live?: boolean;
  accent?: boolean;
};

type ShellWhatsAppSender = {
  transportMode?: "twilio" | "simulator";
  simulatorHandle?: string;
  assignedPhoneNumber?: string;
  status?: string;
  statusReason?: string;
};

const workflowNav: ShellLink[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { href: "/app/leads", label: "Leads", icon: Users2 },
  { href: "/app/communications", label: "Inbox", icon: MessageSquare },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/team", label: "Team", icon: Users2 },
  { href: "/app?view=analytics", label: "Analytics", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon }
];

const supportingNav: ShellLink[] = [
  { href: "/app/approvals", label: "Approval queue", icon: CheckSquare, accent: true },
  { href: "/app/tasks", label: "Follow-up tasks", icon: ListChecks },
  { href: "/app/leads?panel=knowledge", label: "Lead context", icon: BookOpen }
];

type SearchParamsLike = Pick<URLSearchParams, "get">;

type NotificationRecord = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  readAt?: string;
  priority?: "low" | "medium" | "high";
};

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

function searchParamsMatch(searchParams: SearchParamsLike, href: string) {
  const [, query = ""] = href.split("?");
  if (!query) return true;
  const hrefParams = new URLSearchParams(query);
  return [...hrefParams.entries()].every(([key, value]) => searchParams.get(key) === value);
}

function linkPath(href: string) {
  return href.split("?")[0] || href;
}

function isActiveLink(pathname: string, searchParams: SearchParamsLike, link: ShellLink) {
  if (link.label === "Dashboard") return pathname === "/app" && searchParams.get("view") !== "analytics";
  if (link.label === "Analytics") return pathname === "/app" && searchParams.get("view") === "analytics";
  const path = linkPath(link.href);
  const activePath = pathname === path || pathname.startsWith(`${path}/`);
  if (!activePath) return false;
  if (link.href.includes("?")) return searchParamsMatch(searchParams, link.href);
  if (link.label === "Leads") return !searchParams.get("tab") && searchParams.get("panel") !== "knowledge";
  return true;
}

function whatsAppSenderLabel(sender?: ShellWhatsAppSender) {
  if (sender?.transportMode === "simulator") return "WhatsApp · simulator";
  if (sender?.assignedPhoneNumber) return `WhatsApp · ${sender.assignedPhoneNumber}`;
  if (sender?.status === "failed") return "WhatsApp · action needed";
  if (sender?.status === "pending_verification" || sender?.status === "sender_registration_pending" || sender?.status === "number_reserved") {
    return "WhatsApp · preparing";
  }
  return "WhatsApp · pending";
}

function pageTitle(pathname: string, searchParams: SearchParamsLike) {
  if (pathname === "/app" && searchParams.get("view") === "analytics") return "Analytics";
  if (pathname === "/app") return "Dashboard";
  if (pathname.startsWith("/app/leads") && searchParams.get("panel") === "knowledge") return "Lead context";
  if (pathname.startsWith("/app/leads")) {
    return "Leads";
  }
  if (pathname.startsWith("/app/approvals")) return "Approvals";
  if (pathname.startsWith("/app/communications")) return "Inbox";
  if (pathname.startsWith("/app/calendar")) return "Calendar";
  if (pathname.startsWith("/app/tasks")) return "Follow-up tasks";
  if (pathname.startsWith("/app/integrations")) return "Integrations";
  if (pathname.startsWith("/app/team")) return "Team";
  if (pathname.startsWith("/app/settings") && searchParams.get("panel") === "team") return "Team";
  if (pathname.startsWith("/app/settings")) return "Settings";
  if (pathname.startsWith("/app/connect")) return "Integrations";
  return "App";
}

function SidebarLink({
  link,
  active,
  collapsed,
  count,
  onClick
}: {
  link: ShellLink;
  active: boolean;
  collapsed: boolean;
  count?: string;
  onClick?: () => void;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      onClick={onClick}
      aria-label={link.label}
      aria-current={active ? "page" : undefined}
      title={link.label}
      className={`nav-item ${active ? "bg-sidebar-accent text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}
    >
      <Icon className="nav-icon" />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{link.label}</span>
          {link.live ? <span className="dot bg-primary pulse-dot" /> : null}
          {count ? (
            <span className={`font-mono text-[10.5px] ${link.accent ? "rounded-[3px] bg-primary/15 px-1 text-primary" : "text-muted-foreground"}`}>
              {count}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

export function AppShell({
  children,
  session,
  pendingApprovalCount = 0,
  whatsAppSender
}: {
  children: ReactNode;
  session: SessionUser;
  pendingApprovalCount?: number;
  whatsAppSender?: ShellWhatsAppSender;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationRecords, setNotificationRecords] = useState<NotificationRecord[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const title = pageTitle(pathname, searchParams);
  const onboardingReminder = session.onboardingCompletedAt ? 0 : 1;
  const unreadNotifications = notificationRecords.filter((item) => !item.readAt);
  const notificationCount = pendingApprovalCount + onboardingReminder + unreadNotifications.length;
  const whatsAppLabel = whatsAppSenderLabel(whatsAppSender);

  useEffect(() => {
    let cancelled = false;
    async function loadNotifications() {
      const response = await fetch("/api/notifications", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => ({}))) as { notifications?: NotificationRecord[] };
      if (!cancelled) setNotificationRecords(Array.isArray(payload.notifications) ? payload.notifications : []);
    }
    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const notificationItems = useMemo(
    () => [
      ...unreadNotifications.map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.detail,
        href: item.href || "/app/leads",
        source: "record" as const
      })),
      ...(session.onboardingCompletedAt
        ? []
        : [
            {
              id: "onboarding",
              title: "Finish onboarding",
              detail: "Complete the workspace profile so AI qualification can use the right lead context.",
              href: "/app/leads",
              source: "system" as const
            }
          ]),
      {
        id: "approvals",
        title: "Approval queue",
        detail: pendingApprovalCount ? `${pendingApprovalCount} item needs review.` : "Human review items appear here before sensitive action.",
        href: "/app/approvals",
        source: "system" as const
      }
    ],
    [pendingApprovalCount, session.onboardingCompletedAt, unreadNotifications]
  );

  async function markAllNotificationsRead() {
    const response = await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { accept: "application/json" }
    });
    if (!response.ok) return;
    const payload = (await response.json().catch(() => ({}))) as { notifications?: NotificationRecord[] };
    if (Array.isArray(payload.notifications)) setNotificationRecords(payload.notifications);
  }

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
    <nav className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3 scrollbar-dark" aria-label="Primary">
      {!collapsed ? <div className="caption px-2 pb-1 pt-1.5">Conversion workflow</div> : null}
      {workflowNav.map((link) => {
        const count = undefined;
        return (
          <SidebarLink
            key={`${link.label}-${link.href}`}
            link={link}
            active={isActiveLink(pathname, searchParams, link)}
            count={count}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        );
      })}

      {!collapsed ? <div className="caption mt-4 px-2 pb-1">Supporting routes</div> : null}
      {supportingNav.map((link) => {
        const count = link.label === "Approval queue" && pendingApprovalCount ? String(pendingApprovalCount) : undefined;
        return (
          <SidebarLink
            key={`${link.label}-${link.href}`}
            link={link}
            active={isActiveLink(pathname, searchParams, link)}
            count={count}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div data-layout="lovable-operator" className="flex h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-background text-foreground">
        <aside
          data-testid="global-sidebar"
          data-state={collapsed ? "collapsed" : "expanded"}
          className={`hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex ${
            collapsed ? "w-[54px]" : "w-[232px]"
          }`}
        >
          <div className="flex h-11 items-center gap-2 border-b border-sidebar-border px-2.5">
            <Link href="/app" aria-label="Leadsy dashboard" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] bg-primary text-primary-foreground">
              <span className="font-mono text-[11px] font-semibold">L</span>
            </Link>
            {!collapsed ? (
              <Link href="/app" className="group flex min-w-0 flex-1 items-center justify-between rounded-[5px] px-1.5 py-1 hover:bg-sidebar-accent">
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[12.5px] font-medium">Leadsy</span>
                  <span className="truncate text-[10.5px] text-muted-foreground">Helio · Operations</span>
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </Link>
            ) : null}
          </div>

          {!collapsed ? (
            <div className="px-2.5 pt-2.5">
              <Link href="/app/leads?q=" className="flex h-7 w-full items-center gap-2 rounded-[5px] border border-sidebar-border bg-background/40 px-2 text-left text-[12px] text-muted-foreground hover:bg-sidebar-accent">
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1">Quick search</span>
                <span className="kbd">
                  <Command className="h-2.5 w-2.5" />K
                </span>
              </Link>
            </div>
          ) : null}

          {!collapsed ? (
            <div className="px-2.5 pt-1.5">
              <Link href="/app/leads?new=lead" className="flex h-7 w-full items-center gap-2 rounded-[5px] px-2 text-[12.5px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
                <span className="flex-1 text-left">New lead</span>
                <span className="kbd">N</span>
              </Link>
            </div>
          ) : null}

          {nav}

          <div className="border-t border-sidebar-border p-2">
            <div className={`flex items-center gap-2 rounded-[5px] p-1.5 hover:bg-sidebar-accent ${collapsed ? "justify-center" : ""}`}>
              <button
                type="button"
                data-testid="user-menu"
                aria-label="Open user menu"
                aria-expanded={userMenuOpen}
                onClick={() => {
                  setUserMenuOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[10.5px] text-foreground"
              >
                {initials(session.name)}
              </button>
              {!collapsed ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[12px]">{session.name}</span>
                    <span className="truncate text-[10.5px] text-muted-foreground">{session.role} · Helio</span>
                    <span className="truncate text-[10px] text-muted-foreground" title={whatsAppSender?.statusReason || whatsAppLabel}>
                      {whatsAppLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Open notifications"
                    onClick={() => {
                      setNotificationsOpen((open) => !open);
                      setUserMenuOpen(false);
                    }}
                    className="relative rounded p-1 text-muted-foreground hover:bg-background"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {notificationCount ? <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                  </button>
                </>
              ) : null}
            </div>
            <button
              type="button"
              data-testid="sidebar-toggle"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
              className={`mt-1 flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground ${
                collapsed ? "justify-center px-0" : ""
              }`}
            >
              {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
              {!collapsed ? <span>Collapse</span> : null}
              {!collapsed ? <span className="kbd ml-auto">[</span> : null}
            </button>
          </div>
        </aside>

        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-11 min-w-0 shrink-0 items-center justify-between border-b border-border/80 bg-background px-3">
            <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
              <button
                type="button"
                data-testid="mobile-nav-toggle"
                aria-label="Open mobile navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2 text-muted-foreground hover:text-foreground lg:hidden"
              >
                <Menu className="h-3.5 w-3.5" />
              </button>
              <span>Leadsy</span>
              <span className="opacity-40">/</span>
              <span className="truncate text-foreground">{title}</span>
            </div>
            <div className="relative flex items-center gap-1.5">
              <Link href="/app/approvals" className="hidden items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 py-1 font-mono text-[10.5px] text-muted-foreground hover:bg-surface-3 md:flex">
                <Activity className="h-3 w-3 text-primary" />
                <span>{pendingApprovalCount ? `${pendingApprovalCount} approvals` : "No pending approvals"}</span>
              </Link>
              <Link href="/app/leads?view=needs-reply" className="hidden h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px] hover:bg-surface-3 sm:flex">
                <span>Needs reply</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Link>
              <Link href="/app/leads?new=lead" className="flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3 w-3" /> New
              </Link>
              <CostReceiptButton />
              <button
                type="button"
                data-testid="notification-bell"
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setUserMenuOpen(false);
                }}
                className="relative grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
              >
                <Bell className="h-3.5 w-3.5" />
                {notificationCount ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{notificationCount}</span> : null}
              </button>

              {notificationsOpen ? (
                <div data-testid="notification-center" className="absolute right-0 top-9 z-40 w-[min(360px,calc(100vw-2rem))] rounded-[8px] border border-border bg-surface p-3 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">Needs you</div>
                    <div className="flex items-center gap-1">
                      {unreadNotifications.length ? (
                        <button type="button" onClick={markAllNotificationsRead} className="h-7 rounded-[6px] px-2 text-xs text-muted-foreground hover:bg-surface-3 hover:text-foreground">
                          Mark read
                        </button>
                      ) : null}
                      <button type="button" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} className="grid h-7 w-7 place-items-center rounded-[6px] text-muted-foreground hover:bg-surface-3 hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 divide-y divide-border rounded-[8px] border border-border">
                    {notificationItems.map((item) => (
                      <Link key={item.id} href={item.href} onClick={() => setNotificationsOpen(false)} className="block p-3 hover:bg-surface-2">
                        <span className="block text-sm font-medium text-foreground">{item.title}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {userMenuOpen ? (
                <div className="absolute bottom-12 left-2 z-40 w-56 rounded-[8px] border border-border bg-surface p-2 shadow-2xl lg:bottom-11">
                  <div className="border-b border-border px-2 pb-2">
                    <div className="truncate text-sm font-medium text-foreground">{session.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{session.email}</div>
                  </div>
                  <Link href="/app/connect?panel=profile" className="mt-2 flex h-9 items-center rounded-[6px] px-2 text-sm text-muted-foreground hover:bg-surface-3 hover:text-foreground">
                    <UserRound className="mr-2 h-3.5 w-3.5" /> Profile
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    disabled={logoutPending}
                    className="flex h-9 w-full items-center gap-2 rounded-[6px] px-2 text-left text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {logoutPending ? "Logging out..." : "Logout"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        </main>

        {mobileOpen ? (
          <div data-testid="mobile-nav-drawer" className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm lg:hidden">
            <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[8px] border border-border bg-sidebar p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Leadsy</div>
                  <div className="text-xs text-muted-foreground">Helio · Operations</div>
                </div>
                <button type="button" aria-label="Close mobile navigation" onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center rounded-[6px] border border-border text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5">{nav}</div>
            </div>
          </div>
        ) : null}

        {!session.onboardingCompletedAt ? <OnboardingWizard session={session} /> : null}
      </div>
    </ToastProvider>
  );
}
