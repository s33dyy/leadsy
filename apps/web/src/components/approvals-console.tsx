"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Filter, Inbox, Pencil, Search, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui";

export type ApprovalConsoleItem = {
  id: string;
  kind: "Draft" | "Task" | "Research" | "Outreach" | "Note";
  priority: "P0" | "P1" | "P2";
  subject: string;
  preview: string;
  worker: string;
  leadName: string;
  createdAt: string;
  href: string;
};

type ApprovalKindFilter = "All" | ApprovalConsoleItem["kind"];
type ApprovalGroupBy = "Kind" | "Priority" | "Worker" | "Lead";

const kindFilters: ApprovalKindFilter[] = ["All", "Research", "Task", "Note", "Draft", "Outreach"];
const groupOptions: ApprovalGroupBy[] = ["Kind", "Priority", "Worker", "Lead"];

function matchesApproval(item: ApprovalConsoleItem, query: string) {
  if (!query.trim()) return true;
  const haystack = [item.kind, item.priority, item.subject, item.preview, item.worker, item.leadName].join(" ").toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function groupKey(item: ApprovalConsoleItem, groupBy: ApprovalGroupBy) {
  if (groupBy === "Priority") return item.priority;
  if (groupBy === "Worker") return item.worker;
  if (groupBy === "Lead") return item.leadName;
  return item.kind;
}

export function ApprovalsConsole({ approvals }: { approvals: ApprovalConsoleItem[] }) {
  const approvalSearchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedKind, setSelectedKind] = useState<ApprovalKindFilter>("All");
  const [groupBy, setGroupBy] = useState<ApprovalGroupBy>("Kind");
  const [selectedId, setSelectedId] = useState(approvals[0]?.id ?? "");

  useEffect(() => {
    function handleApprovalsShortcut(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
      }
      event.preventDefault();
      approvalSearchRef.current?.focus();
    }

    window.addEventListener("keydown", handleApprovalsShortcut);
    return () => window.removeEventListener("keydown", handleApprovalsShortcut);
  }, []);

  const filtered = useMemo(
    () =>
      approvals
        .filter((item) => selectedKind === "All" || item.kind === selectedKind)
        .filter((item) => matchesApproval(item, query)),
    [approvals, query, selectedKind]
  );
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0];
  const grouped = useMemo(() => {
    const groups = filtered.reduce<Record<string, ApprovalConsoleItem[]>>((acc, item) => {
      (acc[groupKey(item, groupBy)] ||= []).push(item);
      return acc;
    }, {});
    return Object.entries(groups).sort(([left], [right]) => left.localeCompare(right));
  }, [filtered, groupBy]);

  return (
    <div className="grid h-full min-h-0 grid-cols-12 gap-px bg-border">
      <section className="col-span-12 flex min-h-0 flex-col bg-background xl:col-span-7">
        <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
          {kindFilters.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setSelectedKind(kind)}
              className={`h-7 rounded-[5px] px-2.5 text-[12px] ${selectedKind === kind ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}
            >
              {kind === "Task" ? "Tasks" : kind === "Draft" ? "Drafts" : kind === "Research" ? "Research" : kind}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                ref={approvalSearchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search approvals..."
                className="w-44 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex h-7 items-center gap-1 rounded-[5px] border border-border bg-surface-2 px-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as ApprovalGroupBy)} className="bg-transparent text-[12px] outline-none">
                {groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-3 text-[12px]">
          <span className="text-muted-foreground">{filtered.length} pending - grouped by {groupBy.toLowerCase()}</span>
          <Link href="/app/team" className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
            <Check className="h-3 w-3" /> Review queue
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {grouped.length ? grouped.map(([group, items]) => (
            <section key={group}>
              <div className="sticky top-0 z-10 flex h-8 items-center gap-2 border-y border-border bg-surface px-3">
                <span className="text-[12px] font-medium">{group}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{items.length}</span>
              </div>
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li key={item.id} className={`flex items-start gap-3 px-3 py-3 hover:bg-surface-2 ${selected?.id === item.id ? "bg-surface-2" : ""}`}>
                    <button type="button" onClick={() => setSelectedId(item.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[10.5px] ${item.priority === "P0" ? "text-destructive" : item.priority === "P1" ? "text-warning" : "text-muted-foreground"}`}>
                          {item.priority}
                        </span>
                        <span className="caption">{item.kind}</span>
                        <span className="font-mono text-[10.5px] text-muted-foreground">- {item.worker}</span>
                        <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{item.createdAt}</span>
                      </div>
                      <div className="mt-1 text-[12.5px] font-medium">{item.subject}</div>
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">{item.preview}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-[12.5px] text-muted-foreground">
              <Inbox className="h-5 w-5" />
              No approvals match this view.
            </div>
          )}
        </div>
      </section>

      <aside className="col-span-12 min-h-0 overflow-y-auto bg-background xl:col-span-5">
        {selected ? (
          <>
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-2">
                <Badge tone={selected.priority === "P0" ? "rose" : selected.priority === "P1" ? "amber" : "neutral"}>{selected.priority}</Badge>
                <span className="caption">{selected.kind}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] text-primary">
                  <Sparkles className="h-3 w-3" /> {selected.worker}
                </span>
              </div>
              <h1 className="mt-2 text-[16px] font-medium tracking-tight">{selected.subject}</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                For <span className="text-foreground">{selected.leadName}</span> - {selected.createdAt} ago
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <button type="button" className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
                  <Check className="h-3 w-3" /> Approve
                </button>
                <button type="button" className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-destructive/20 bg-destructive/10 px-2.5 text-[12px] text-destructive hover:bg-destructive/20">
                  <X className="h-3 w-3" /> Reject
                </button>
                <Link href={selected.href} className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                  <Pencil className="h-3 w-3" /> Edit
                </Link>
                <Link href="/app/team-chat" className="inline-flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2.5 text-[12px] hover:bg-surface-3">
                  <ArrowUpRight className="h-3 w-3" /> Discuss
                </Link>
              </div>
            </div>

            <div className="p-5">
              <div className="caption">Proposed content</div>
              <div className="mt-2 rounded-[6px] border border-border bg-surface-2 p-4 text-[13px] leading-relaxed">{selected.preview}</div>
              <div className="mt-5 caption">Audit</div>
              <ul className="mt-2 space-y-1.5 font-mono text-[10.5px] text-muted-foreground">
                <li>queued - {selected.worker}</li>
                <li>pending - human approval required</li>
                <li>route - Leadsy-native approval queue</li>
              </ul>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
