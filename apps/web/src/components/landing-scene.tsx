import { Activity, ArrowRight, Bot, GitBranch, Camera, Magnet, MessageCircle, Users } from "lucide-react";
import { metaQualificationWorkflowNodes } from "@leadsy/domain";
import { Badge, ProgressBar } from "./ui";

export function LandingScene() {
  return (
    <div className="panel relative min-h-[520px] overflow-hidden p-4 md:p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-200/60 to-transparent" />
      <div className="grid h-full gap-4 lg:grid-cols-[1fr_0.72fr]">
        <div className="grid gap-4">
          <div className="panel-quiet p-4">
            <div className="flex items-center justify-between">
              <Badge tone="teal">clean workspace</Badge>
              <div className="mono text-[11px] text-[var(--muted)]">connect sources to activate</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Sources", "0", "awaiting setup"],
                ["Prospects", "0", "no discovery yet"],
                ["Conversations", "0", "WhatsApp not connected"],
                ["Bookings", "0", "no meetings yet"]
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded-[6px] border border-[var(--line)] bg-black/[0.24] p-3">
                  <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
                  <div className="mono mt-1 text-[11px] text-teal-200">{detail}</div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-[var(--muted-2)]">
                <span>Activation path</span>
                <span className="mono text-teal-200">0 records</span>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {["Client", "Source", "Inbox", "Automation"].map((step) => (
                  <div key={step} className="h-16 rounded-[6px] border border-dashed border-[var(--line)] bg-black/20 p-3">
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">{step}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/[0.08]" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel-quiet p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Users size={16} className="text-[var(--sky)]" />
                Client workspaces
              </div>
              <div className="relative h-[190px]">
                <div className="absolute left-[50%] top-[46%] flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-teal-300/30 bg-teal-300/10 text-center text-[10px] text-teal-100 shadow-lg">
                  add clients
                </div>
                <div className="absolute left-[30%] top-[46%] h-px w-[44%] rotate-12 bg-teal-300/50" />
                <div className="absolute left-[26%] top-[46%] h-px w-[42%] -rotate-12 bg-amber-300/45" />
                <div className="absolute left-[50%] top-[22%] h-[52%] w-px bg-sky-300/45" />
              </div>
            </div>

            <div className="panel-quiet p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Bot size={16} className="text-[var(--teal)]" />
                AI qualification flow
              </div>
              <div className="space-y-3">
                {metaQualificationWorkflowNodes.slice(0, 4).map((node, index) => (
                  <div key={node.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-teal-300/25 bg-teal-300/10 text-xs text-teal-100">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white">{node.label}</div>
                      <ProgressBar value={index < 2 ? 100 : index === 2 ? 72 : 34} tone={index === 2 ? "amber" : "teal"} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="panel-quiet glow-line p-4 pl-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">No live lead selected</div>
                <div className="text-sm text-[var(--muted-2)]">Lead cards appear after source connection</div>
              </div>
              <Badge tone="neutral">0 intent</Badge>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Budget", 0],
                ["Location", 0],
                ["Urgency", 0]
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                  <ProgressBar value={Number(value)} tone={Number(value) > 85 ? "lime" : "teal"} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel-quiet p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Camera size={16} className="text-[var(--rose)]" />
              Source queue
            </div>
            <div className="space-y-2">
              {[
                { icon: Magnet, label: "Lead Magnet", detail: "connect approved prospect sources" },
                { icon: Camera, label: "Meta Lead Ads", detail: "connect webhook" },
                { icon: MessageCircle, label: "WhatsApp", detail: "connect inbox" }
              ].map((source) => {
                const Icon = source.icon;
                return (
                <div key={source.label} className="rounded-[6px] border border-dashed border-[var(--line)] bg-black/20 p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="text-[var(--teal)]" size={15} />
                    <span className="text-sm text-white">{source.label}</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">{source.detail}</div>
                </div>
                );
              })}
            </div>
          </div>

          <div className="panel-quiet p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <MessageCircle className="mx-auto text-[var(--teal)]" size={18} />
                <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">WhatsApp</div>
              </div>
              <div>
                <Activity className="mx-auto text-[var(--rose)]" size={18} />
                <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">Audit</div>
              </div>
              <div>
                <GitBranch className="mx-auto text-[var(--violet)]" size={18} />
                <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">Flows</div>
              </div>
            </div>
          </div>

          <a
            href="/app"
            className="flex items-center justify-between rounded-[8px] border border-teal-300/30 bg-teal-300/[0.12] px-4 py-3 text-sm font-semibold text-teal-100 hover:bg-teal-300/[0.18]"
          >
            Open workspace
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
