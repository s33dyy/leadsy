"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export type LeadSummaryMessage = {
  id: string;
  label: string;
  body: string;
  meta?: string;
};

export type LeadSummaryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  summary?: string;
  nextAction?: string;
  owner?: string;
  qualification?: string;
  messages?: LeadSummaryMessage[];
  internalNotes?: LeadSummaryMessage[];
  calendarEvents?: LeadSummaryMessage[];
  missingFields?: string[];
  facts?: string[];
  triggerClassName?: string;
};

type LeadSummaryActionProps = Omit<LeadSummaryModalProps, "open" | "onOpenChange">;

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

export function LeadSummaryAction(props: LeadSummaryActionProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleSummaryShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "s") return;
      if (isEditableShortcutTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", handleSummaryShortcut);
    return () => window.removeEventListener("keydown", handleSummaryShortcut);
  }, []);

  return <LeadSummaryModal {...props} open={open} onOpenChange={setOpen} />;
}

export function LeadSummaryModal({
  open,
  onOpenChange,
  title,
  subtitle,
  summary,
  nextAction,
  owner,
  qualification,
  messages = [],
  internalNotes = [],
  calendarEvents = [],
  missingFields = [],
  facts = [],
  triggerClassName
}: LeadSummaryModalProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={triggerClassName ?? "inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2 text-[12px]"}
      >
        <Sparkles className="h-3 w-3 text-primary" /> Summarize
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Lead summary">
          <div className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-[8px] border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border p-4">
              <div>
                <div className="caption">Scoped summary</div>
                <h2 className="mt-1 text-lg font-semibold">{title}</h2>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
              <button
                type="button"
                aria-label="Close summary"
                onClick={() => onOpenChange(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(86vh-80px)] overflow-y-auto p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCell label="Owner" value={owner || "Unassigned"} />
                <SummaryCell label="Qualification" value={qualification || "Not collected"} />
                <SummaryCell label="Next action" value={nextAction || "Continue qualification."} />
              </div>

              <section className="mt-4 rounded-[8px] border border-border bg-surface p-3">
                <div className="caption">Brief</div>
                <p className="mt-2 text-sm leading-6">{summary || "No saved summary yet. Review the recent messages and qualification fields before replying."}</p>
              </section>

              <SummaryList title="Recent conversation" empty="No recent channel messages." items={messages} />
              <SummaryList title="Internal notes" empty="No internal handoff notes yet." items={internalNotes} />
              <SummaryList title="Calendar" empty="No linked calendar proposals." items={calendarEvents} />

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SummaryStringList title="Missing fields" empty="No missing qualification fields detected." items={missingFields} />
                <SummaryStringList title="Known facts" empty="No CRM facts saved yet." items={facts.slice(0, 8)} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] border border-border bg-surface p-3">
      <div className="caption">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function SummaryList({ title, empty, items }: { title: string; empty: string; items: LeadSummaryMessage[] }) {
  return (
    <section className="mt-4 rounded-[8px] border border-border bg-surface p-3">
      <div className="caption">{title}</div>
      {items.length ? (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-[6px] border border-border bg-background p-2">
              <div className="font-mono text-[10px] text-muted-foreground">{item.label}{item.meta ? ` - ${item.meta}` : ""}</div>
              <p className="mt-1 text-sm leading-6">{item.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function SummaryStringList({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  return (
    <section className="rounded-[8px] border border-border bg-surface p-3">
      <div className="caption">{title}</div>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
