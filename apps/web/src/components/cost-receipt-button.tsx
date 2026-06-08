"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ReceiptText, RefreshCcw, X } from "lucide-react";
import type { CostReceipt } from "@/lib/cost-receipt";

type ReceiptPayload = {
  ok?: boolean;
  receipt?: CostReceipt;
  error?: string;
};

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: value >= 100 ? 0 : 2
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4
  }).format(value);
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "now";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(parsed);
}

function categoryTone(category: string) {
  if (category === "twilio") return "border-primary/35 bg-primary/10 text-primary";
  if (category === "twilio_simulated") return "border-amber-300/35 bg-amber-300/10 text-amber-200";
  if (category === "openrouter") return "border-info/35 bg-info/10 text-info";
  return "border-border bg-surface-2 text-muted-foreground";
}

export function CostReceiptButton() {
  const [receipt, setReceipt] = useState<CostReceipt | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReceipt = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/costs/receipt", {
        method: "GET",
        credentials: "include",
        headers: { accept: "application/json" }
      });
      const payload = (await response.json().catch(() => ({}))) as ReceiptPayload;
      if (!response.ok || !payload.receipt) {
        setError(payload.error || "Cost receipt is unavailable.");
        return;
      }
      setReceipt(payload.receipt);
    } catch {
      setError("Cost receipt is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReceipt();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReceipt]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const label = useMemo(() => {
    if (loading && !receipt) return "Cost";
    return receipt ? formatInr(receipt.summary.totalInr) : "Cost";
  }, [loading, receipt]);

  return (
    <>
      <button
        type="button"
        data-testid="cost-receipt-button"
        aria-label="Open cost receipt"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="hidden h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 font-mono text-[10.5px] text-muted-foreground hover:bg-surface-3 hover:text-foreground sm:inline-flex"
      >
        {loading && !receipt ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <ReceiptText className="h-3 w-3 text-primary" />}
        <span>{label}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-3 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cost-receipt-title"
            data-testid="cost-receipt-modal"
            className="flex max-h-[min(760px,calc(100dvh-2rem))] w-[min(980px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[8px] border border-border bg-surface shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-4 w-4 text-primary" />
                  <h2 id="cost-receipt-title" className="text-lg font-semibold text-foreground">Receipt</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Twilio charges, WhatsApp conversation utilization, and OpenRouter AI usage for this workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadReceipt()}
                  className="grid h-8 w-8 place-items-center rounded-[6px] border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  aria-label="Refresh cost receipt"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-[6px] border border-border bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
                  aria-label="Close cost receipt"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {error ? (
                <div className="rounded-[6px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              ) : null}

              {receipt ? (
                <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-[6px] border border-border bg-background p-3 md:col-span-1">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Burn total</div>
                      <div className="mt-2 text-2xl font-semibold text-foreground">{formatInr(receipt.summary.totalInr)}</div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{formatUsd(receipt.summary.totalUsd)}</div>
                    </div>
                    <div className="rounded-[6px] border border-border bg-background p-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Twilio</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{formatInr(receipt.summary.twilio.totalInr)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {receipt.summary.twilio.billableMessages} real · {receipt.summary.twilio.projectedSimulatorMessages} simulated
                      </div>
                    </div>
                    <div className="rounded-[6px] border border-border bg-background p-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">AI / OpenRouter</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{formatInr(receipt.summary.openrouter.totalInr)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{receipt.summary.openrouter.requests} requests · {receipt.summary.openrouter.totalTokens} tokens</div>
                    </div>
                    <div className="rounded-[6px] border border-border bg-background p-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Conversations</div>
                      <div className="mt-2 text-lg font-semibold text-foreground">{receipt.summary.conversations.trackedConversations}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {receipt.summary.conversations.simulatedMessages} simulator messages · {formatInr(receipt.summary.twilio.projectedSimulatorInr)} projected
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[6px] border border-border">
                    <div className="grid grid-cols-[minmax(130px,0.9fr)_minmax(120px,0.8fr)_minmax(220px,1.8fr)_minmax(90px,0.5fr)_minmax(120px,0.7fr)] gap-3 border-b border-border bg-surface-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground max-lg:hidden">
                      <span>Time</span>
                      <span>Category</span>
                      <span>Item</span>
                      <span>Qty</span>
                      <span className="text-right">Amount</span>
                    </div>
                    <div className="divide-y divide-border">
                      {receipt.lineItems.length ? receipt.lineItems.map((item) => (
                        <div key={item.id} className="grid gap-2 px-3 py-3 text-sm lg:grid-cols-[minmax(130px,0.9fr)_minmax(120px,0.8fr)_minmax(220px,1.8fr)_minmax(90px,0.5fr)_minmax(120px,0.7fr)] lg:gap-3">
                          <div className="font-mono text-[11px] text-muted-foreground">{formatDateTime(item.occurredAt)}</div>
                          <div>
                            <span className={`inline-flex rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px] uppercase ${categoryTone(item.category)}`}>{item.category}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{item.label}</div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.detail}</div>
                            {item.model ? <div className="mt-1 font-mono text-[10px] text-muted-foreground">{item.model}</div> : null}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{item.quantity} {item.unitLabel}</div>
                          <div className="font-mono text-sm text-foreground lg:text-right">
                            <div>{formatInr(item.amountInr)}</div>
                            <div className="text-[10px] text-muted-foreground">{formatUsd(item.amountUsd)}</div>
                          </div>
                        </div>
                      )) : (
                        <div className="p-4 text-sm text-muted-foreground">No billable transactions yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-[6px] border border-border bg-background p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Receipt basis</div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      {receipt.assumptions.map((assumption) => (
                        <div key={assumption} className="rounded-[5px] border border-border bg-surface-2 p-2">{assumption}</div>
                      ))}
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                      Checked {formatDateTime(receipt.checkedAt)} · FX {receipt.fxRateInr} INR/USD ({receipt.fxSource})
                    </div>
                  </div>
                </>
              ) : !error ? (
                <div className="flex min-h-56 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading receipt...
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
