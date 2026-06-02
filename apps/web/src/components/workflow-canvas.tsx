"use client";

import { useState } from "react";
import { CheckCircle2, GitBranch, Loader2, Play, Zap } from "lucide-react";
import { metaQualificationWorkflowNodes } from "@leadsy/domain";
import { Badge } from "./ui";

type RunResult = {
  id: string;
  status: string;
  steps: Array<{ id: string; label: string; output: string }>;
};

const nodeTone = {
  trigger: "teal",
  condition: "amber",
  ai: "violet",
  enrichment: "sky",
  crm: "lime",
  message: "rose",
  routing: "amber"
} as const;

export function WorkflowCanvas() {
  const [run, setRun] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function execute() {
    setLoading(true);
    const response = await fetch("/api/workflows/run", { method: "POST" });
    setRun(await response.json());
    setLoading(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <div className="relative min-h-[520px] overflow-hidden rounded-[8px] border border-[var(--line)] bg-black/20 p-5">
        <div className="absolute left-10 right-10 top-[110px] h-1 route-rail opacity-60" />
        <div className="grid gap-5 md:grid-cols-5">
          {metaQualificationWorkflowNodes.map((node, index) => (
            <div
              key={node.id}
              className="relative z-10 min-h-[184px] rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-2)] p-4 shadow-xl shadow-black/20"
            >
              <div className="flex items-center justify-between">
                <Badge tone={nodeTone[node.type]}>{node.type}</Badge>
                <span className="mono text-[11px] text-[var(--muted)]">{index + 1}</span>
              </div>
              <div className="mt-5 text-base font-semibold text-white">{node.label}</div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{node.description}</p>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between border-t border-[var(--line)] pt-3">
                <span className="mono text-[11px] text-[var(--muted)]">{node.status}</span>
                <Zap size={15} className="text-[var(--teal)]" />
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={execute}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Run workflow
        </button>
      </div>

      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <GitBranch size={17} className="text-[var(--teal)]" />
          Execution log
        </div>
        <div className="mt-4 space-y-3">
          {run ? (
            run.steps.map((step) => (
              <div key={step.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2 size={15} className="text-[var(--teal)]" />
                  {step.label}
                </div>
                <div className="mt-2 text-xs leading-5 text-[var(--muted-2)]">{step.output}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4 text-sm leading-6 text-[var(--muted-2)]">
              Workflow run results will appear here with step outputs and audit events.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
