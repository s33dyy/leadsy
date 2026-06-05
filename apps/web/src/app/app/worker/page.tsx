import { Cable, RadioTower, ShieldCheck } from "lucide-react";
import { ExtensionTaskBoard } from "@/components/extension-task-board";
import { ExtensionPairing } from "@/components/extension-pairing";
import { Badge, Panel, SectionTitle } from "@/components/ui";
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

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Leadsy Worker" title="Pair browser workers and monitor field conversations" />
          <Badge tone="teal">{conversations.length} synced conversations</Badge>
        </div>
        <div className="mt-6">
          <ExtensionPairing initialTokens={tokens} />
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Hybrid channel monitor" title="Official webhook first, browser extension fallback" />
          <Badge tone="teal">V4 monitor</Badge>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[0.38fr_0.62fr]">
          <div className="rounded-[8px] border border-lime-300/25 bg-lime-300/[0.07] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-lime-50">
              <RadioTower size={16} />
              Official webhook
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
              Meta webhooks are the preferred 24/7 source when WhatsApp, Instagram, and Facebook assets are connected.
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

          <div className="rounded-[8px] border border-sky-300/25 bg-sky-300/[0.07] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-50">
              <Cable size={16} />
              Browser extension fallback
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {monitorHealth.map((item) => (
                <MonitorHealthCard key={item.platform} item={item} />
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle eyebrow="Operations center" title="Queue tasks and monitor worker execution" />
          <Badge tone="teal">{tasks.length} tasks</Badge>
        </div>
        <div className="mt-6">
          <ExtensionTaskBoard initialTasks={tasks} initialEvents={taskEvents} focusColumn={focusColumn} />
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel className="p-4">
          <Cable size={18} className="text-[var(--teal)]" />
          <div className="mt-4 text-sm font-semibold text-white">Worker role</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            The extension handles the active browser conversation and reports messages, pauses, errors, and decisions back to Leadsy.
          </p>
        </Panel>
        <Panel className="p-4">
          <ShieldCheck size={18} className="text-[var(--teal)]" />
          <div className="mt-4 text-sm font-semibold text-white">Leadsy role</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
            Leadsy receives official incoming WhatsApp identity from Meta webhooks and keeps worker execution visible.
          </p>
        </Panel>
      </section>
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
