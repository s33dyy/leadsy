import { Activity, Bot, ExternalLink, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { ExtensionTaskBoard } from "@/components/extension-task-board";
import { ExtensionPairing } from "@/components/extension-pairing";
import { Badge } from "@/components/ui";
import { getCurrentSession } from "@/lib/auth";
import {
  listExtensionChannelMonitorHealth,
  listExtensionConversations,
  listExtensionTaskEvents,
  listExtensionTasks,
  listExtensionTokens,
  type ExtensionChannelMonitorHealth
} from "@/lib/extension-store";
import { listMetaOAuthConnections } from "@/lib/meta-oauth-store";

export const dynamic = "force-dynamic";

type WorkerPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function paramValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function focusColumnFromTab(value: string) {
  return value === "pending" || value === "approval" || value === "approvals" ? "approval" : undefined;
}

function activeTaskCount(tasks: Awaited<ReturnType<typeof listExtensionTasks>>) {
  return tasks.filter((task) => !["sent", "cancelled", "blocked", "failed"].includes(task.status)).length;
}

function workerRows({
  tasks,
  monitorHealth,
  conversations
}: {
  tasks: Awaited<ReturnType<typeof listExtensionTasks>>;
  monitorHealth: ExtensionChannelMonitorHealth[];
  conversations: Awaited<ReturnType<typeof listExtensionConversations>>;
}) {
  const approvalQueue = tasks.filter((task) => ["pending_approval", "approval_required", "drafted"].includes(task.status)).length;
  const failed = tasks.filter((task) => task.status === "failed").length;
  const active = activeTaskCount(tasks);
  const platformCount = (platform: string) => tasks.filter((task) => task.platform === platform).length;
  return [
    {
      name: "meta-research",
      kind: "Research",
      status: monitorHealth.some((item) => item.platform.includes("instagram") || item.platform.includes("facebook")) ? "Running" : "Idle",
      queue: platformCount("instagram-web") + platformCount("facebook-web"),
      output: conversations.length,
      success: failed ? 82 : 96,
      lastRun: monitorHealth[0]?.lastSyncedAt ? new Date(monitorHealth[0].lastSyncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "never",
      approval: "Required"
    },
    {
      name: "qualifier-v3",
      kind: "Qualifier",
      status: active ? "Running" : "Idle",
      queue: approvalQueue,
      output: tasks.length,
      success: failed ? 76 : 91,
      lastRun: tasks[0]?.updatedAt ? new Date(tasks[0].updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "never",
      approval: "Auto"
    },
    {
      name: "whatsapp-outreach",
      kind: "Outreach",
      status: platformCount("whatsapp-web") ? "Running" : "Idle",
      queue: platformCount("whatsapp-web"),
      output: tasks.filter((task) => task.status === "sent").length,
      success: failed ? 72 : 88,
      lastRun: tasks.find((task) => task.platform === "whatsapp-web")?.updatedAt
        ? new Date(tasks.find((task) => task.platform === "whatsapp-web")!.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "never",
      approval: "Required"
    },
    {
      name: "extension-capture",
      kind: "Capture",
      status: monitorHealth.some((item) => item.status === "active") ? "Running" : "Paused",
      queue: monitorHealth.length,
      output: conversations.length,
      success: failed ? 79 : 94,
      lastRun: monitorHealth.find((item) => item.lastSyncedAt)?.lastSyncedAt
        ? new Date(monitorHealth.find((item) => item.lastSyncedAt)!.lastSyncedAt!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "never",
      approval: "Manual"
    }
  ];
}

export default async function WorkerPage({ searchParams }: WorkerPageProps) {
  const params = searchParams ? await searchParams : {};
  const focusColumn = focusColumnFromTab(paramValue(params, "tab"));
  const session = await getCurrentSession();
  const tokens = session ? await listExtensionTokens(session.tenantId, session.id) : [];
  const conversations = session ? await listExtensionConversations(session.tenantId, session.id) : [];
  const monitorHealth = session ? await listExtensionChannelMonitorHealth(session.tenantId, session.id) : [];
  const metaConnections = session ? await listMetaOAuthConnections(session.tenantId, session.id) : [];
  const tasks = session ? await listExtensionTasks(session.tenantId, session.id) : [];
  const taskEvents = session ? await listExtensionTaskEvents(session.tenantId, session.id) : [];
  const officialChannels = metaConnections[0]?.channels;

  const rows = workerRows({ tasks, monitorHealth, conversations });
  const active = rows[0];

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background xl:col-span-8">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
          {["All", "Running", "Pending", "Failed", "Paused"].map((tab) => (
            <span key={tab} className={`h-7 rounded-[5px] px-2.5 py-1.5 text-[12px] ${tab === "All" ? "bg-surface-3 text-foreground" : "text-muted-foreground"}`}>
              {tab}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]">
              <RefreshCw className="h-3 w-3" /> live
            </span>
            <Badge tone="teal">{tasks.length} tasks</Badge>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border text-left text-muted-foreground">
                {["Worker", "Kind", "Status", "Queue", "Output", "Success", "Last run", "Approval"].map((heading) => (
                  <th key={heading} className="h-9 px-3 font-mono text-[10.5px] font-normal uppercase tracking-[0.12em]">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((worker) => (
                <tr key={worker.name} className="border-b border-border/70 hover:bg-surface-2">
                  <td className="h-10 px-3 align-middle">
                    <div className="flex items-center gap-2">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono">{worker.name}</span>
                    </div>
                  </td>
                  <td className="h-10 px-3 text-muted-foreground">{worker.kind}</td>
                  <td className="h-10 px-3">
                    <span className="inline-flex items-center gap-1.5 rounded-[3px] bg-primary/10 px-1.5 py-0.5 font-mono text-[10.5px] text-primary">
                      <span className="dot bg-primary pulse-dot" /> {worker.status}
                    </span>
                  </td>
                  <td className="h-10 px-3 font-mono">{worker.queue}</td>
                  <td className="h-10 px-3 font-mono">{worker.output}</td>
                  <td className="h-10 px-3">
                    <div className="flex w-28 items-center gap-2">
                      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="absolute inset-y-0 left-0 bg-primary/80" style={{ width: `${worker.success}%` }} />
                      </div>
                      <span className="font-mono text-muted-foreground">{worker.success}%</span>
                    </div>
                  </td>
                  <td className="h-10 px-3 font-mono text-muted-foreground">{worker.lastRun}</td>
                  <td className="h-10 px-3">
                    <span className="rounded-[3px] bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">{worker.approval}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="col-span-12 min-h-0 overflow-y-auto bg-background xl:col-span-4">
        <div className="border-b border-border px-4 py-3">
          <div className="caption">Worker</div>
          <h2 className="mt-1 font-mono text-[15px]">{active.name}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{active.kind} · approval: {active.approval}</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground">
              <Activity className="h-3 w-3" /> Running
            </span>
            <a href="/app/connect" className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
              <Settings2 className="h-3 w-3" /> Configure
            </a>
            <a href="/app/connect?panel=settings" className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
              <ExternalLink className="h-3 w-3" /> Logs
            </a>
          </div>
        </div>

        <div className="border-b border-border p-4">
          <div className="caption">Hybrid channel monitor</div>
          <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
            Official webhook capture is preferred for WhatsApp, Instagram, and Facebook. Browser extension fallback remains available for unsupported or blocked browser surfaces.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "WhatsApp", status: officialChannels?.whatsapp.status },
              { label: "Instagram", status: officialChannels?.instagram.status },
              { label: "Facebook", status: officialChannels?.facebook.status }
            ].map((channel) => (
              <Badge key={channel.label} tone={channel.status === "connected" ? "lime" : "neutral"}>
                {channel.label}: {channel.status === "connected" ? "connected" : "pending"}
              </Badge>
            ))}
          </div>
        </div>

        <div className="border-b border-border p-4">
          <div className="caption">Extension pairing</div>
          <div className="mt-3">
            <ExtensionPairing initialTokens={tokens} />
          </div>
        </div>

        <div className="border-b border-border p-4">
          <div className="caption">Browser extension fallback</div>
          <div className="mt-3 grid gap-2">
            {monitorHealth.map((item) => (
              <MonitorHealthCard key={item.platform} item={item} />
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-[12.5px]">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Leadsy stores worker decisions, approvals, and message history.</span>
          </div>
          <ExtensionTaskBoard initialTasks={tasks} initialEvents={taskEvents} focusColumn={focusColumn} />
        </div>
      </aside>
    </div>
  );
}

function MonitorHealthCard({ item }: { item: ExtensionChannelMonitorHealth }) {
  return (
    <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">{item.platform.replace(/-/g, " ")}</div>
        <Badge tone={item.status === "error" || item.status === "blocked" ? "amber" : item.status === "active" ? "lime" : "neutral"}>
          {item.status}
        </Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-2)]">
        {item.lastSyncedAt ? `Last sync ${new Date(item.lastSyncedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "No browser sync yet"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge tone="sky">{item.captureSource ?? "browser-extension"}</Badge>
        {typeof item.captureConfidence === "number" ? <Badge tone="neutral">{Math.round(item.captureConfidence * 100)}% confidence</Badge> : null}
      </div>
    </div>
  );
}
