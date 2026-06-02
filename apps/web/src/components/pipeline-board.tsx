"use client";

import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import { accounts, deals, formatCurrency, type Deal, type DealStage } from "@leadsy/domain";
import { Badge, EmptyState, ProgressBar } from "./ui";

const stages: Array<{ id: DealStage; label: string }> = [
  { id: "qualified", label: "Qualified" },
  { id: "discovery", label: "Discovery" },
  { id: "technical-win", label: "Technical Win" },
  { id: "proposal", label: "Proposal" },
  { id: "commit", label: "Commit" }
];

export function PipelineBoard() {
  const [items, setItems] = useState<Deal[]>(deals);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byStage = useMemo(
    () =>
      stages.map((stage) => ({
        ...stage,
        deals: items.filter((deal) => deal.stage === stage.id)
      })),
    [items]
  );

  function moveDeal(stage: DealStage) {
    if (!draggingId) return;
    setItems((current) => current.map((deal) => (deal.id === draggingId ? { ...deal, stage } : deal)));
    setDraggingId(null);
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={GripVertical}
        title="No deals in pipeline"
        detail="The pipeline is empty. Create or import real opportunities to use the drag-and-drop pipeline."
      />
    );
  }

  return (
    <div className="scrollbar-dark overflow-x-auto pb-2">
      <div className="grid min-w-[1040px] grid-cols-5 gap-3">
        {byStage.map((stage) => (
          <section
            key={stage.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => moveDeal(stage.id)}
            className="min-h-[430px] rounded-[8px] border border-[var(--line)] bg-black/20 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{stage.label}</div>
                <div className="mono text-[11px] text-[var(--muted)]">{stage.deals.length} deals</div>
              </div>
              <Badge tone="neutral">{stage.deals.reduce((sum, deal) => sum + deal.value, 0) ? formatCurrency(stage.deals.reduce((sum, deal) => sum + deal.value, 0)) : "$0"}</Badge>
            </div>

            <div className="space-y-3">
              {stage.deals.map((deal) => {
                const account = accounts.find((candidate) => candidate.id === deal.accountId);
                return (
                  <article
                    key={deal.id}
                    draggable
                    onDragStart={() => setDraggingId(deal.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={`cursor-grab rounded-[8px] border border-[var(--line)] bg-[var(--surface-2)] p-3 shadow-lg shadow-black/15 active:cursor-grabbing ${
                      draggingId === deal.id ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-white">{deal.name}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{account?.name}</div>
                      </div>
                      <GripVertical size={15} className="text-[var(--muted)]" />
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-[var(--muted-2)]">{formatCurrency(deal.value)}</span>
                      <Badge tone={deal.risk === "high" ? "rose" : deal.risk === "medium" ? "amber" : "teal"}>
                        {deal.forecast}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={deal.probability} tone={deal.risk === "high" ? "rose" : "teal"} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--muted-2)]">{deal.nextStep}</p>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
