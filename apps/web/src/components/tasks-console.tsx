"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Filter, MoreHorizontal, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";

export type TaskConsoleRow = {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  owner: string;
  ownerInitials: string;
  due: string;
  source: "AI" | "Human";
  approval: "Pending" | "Approved" | "None";
  href: string;
};

type TaskGroupBy = "Status" | "Priority" | "Owner";

const groupOptions: TaskGroupBy[] = ["Status", "Priority", "Owner"];

function priorityClass(priority: TaskConsoleRow["priority"]) {
  if (priority === "Urgent") return "bg-destructive";
  if (priority === "High") return "bg-warning";
  if (priority === "Medium") return "bg-info";
  return "bg-muted-foreground/50";
}

function matchesTask(row: TaskConsoleRow, query: string) {
  if (!query.trim()) return true;
  const haystack = [row.id, row.title, row.typeLabel, row.status, row.priority, row.owner, row.due, row.source, row.approval].join(" ").toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function groupKey(row: TaskConsoleRow, groupBy: TaskGroupBy) {
  if (groupBy === "Priority") return row.priority;
  if (groupBy === "Owner") return row.owner;
  return row.status;
}

export function TasksConsole({ rows }: { rows: TaskConsoleRow[] }) {
  const taskSearchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [groupBy, setGroupBy] = useState<TaskGroupBy>("Status");

  useEffect(() => {
    function handleTasksShortcut(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable) return;
      }
      event.preventDefault();
      taskSearchRef.current?.focus();
    }

    window.addEventListener("keydown", handleTasksShortcut);
    return () => window.removeEventListener("keydown", handleTasksShortcut);
  }, []);

  const filteredRows = useMemo(() => rows.filter((row) => matchesTask(row, query)), [query, rows]);
  const groups = useMemo(() => {
    const grouped = filteredRows.reduce<Record<string, TaskConsoleRow[]>>((acc, row) => {
      (acc[groupKey(row, groupBy)] ||= []).push(row);
      return acc;
    }, {});
    return Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right));
  }, [filteredRows, groupBy]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <span className="caption">Group by</span>
          {groupOptions.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setGroupBy(group)}
              className={`h-7 rounded-[5px] px-2 text-[12px] ${groupBy === group ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}
            >
              {group}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex h-7 items-center gap-1.5 rounded-[5px] border border-border bg-surface-2 px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              ref={taskSearchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter tasks..."
              className="w-40 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <span className="grid h-7 w-7 place-items-center rounded-[5px] border border-border bg-surface-2" title={`Grouping by ${groupBy}`}>
            <Filter className="h-3 w-3" />
          </span>
          <Link href="/app/leads?tab=tasks" className="h-7 rounded-[5px] bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90">
            + Task
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length ? (
          groups.map(([groupName, items]) => (
            <section key={groupName}>
              <div className="sticky top-0 z-10 flex h-8 items-center gap-2 border-y border-border bg-surface px-3">
                <span className="text-[12px] font-medium">{groupName}</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">{items.length}</span>
                <MoreHorizontal className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <ul>
                {items.map((task) => (
                  <li key={task.id} className="grid grid-cols-12 items-center gap-3 border-b border-border/70 px-3 py-2 hover:bg-surface-2">
                    <div className="col-span-12 flex min-w-0 items-center gap-2 md:col-span-6">
                      <input type="checkbox" aria-label={`Complete ${task.title}`} className="h-3.5 w-3.5 accent-primary" defaultChecked={task.status === "Done" || task.status === "Sent"} />
                      <span className="font-mono text-[10.5px] text-muted-foreground">{task.id.slice(0, 10)}</span>
                      <span className={`dot ${priorityClass(task.priority)}`} title={task.priority} />
                      <span className="rounded-[3px] bg-surface-3 px-1.5 font-mono text-[10px] text-muted-foreground">{task.typeLabel}</span>
                      <Link href={task.href} className="truncate text-[12.5px] hover:text-primary">
                        {task.title}
                      </Link>
                      {task.source === "AI" ? (
                        <span className="inline-flex items-center gap-1 rounded-[3px] bg-primary/10 px-1.5 font-mono text-[10px] text-primary">
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                      ) : null}
                      {task.approval === "Pending" ? <Badge tone="amber">approval</Badge> : null}
                    </div>
                    <div className="col-span-4 text-[11.5px] text-muted-foreground md:col-span-2">{task.status}</div>
                    <div className="col-span-4 flex items-center gap-1.5 text-[11.5px] md:col-span-2">
                      <div className="grid h-5 w-5 place-items-center rounded-full bg-surface-3 font-mono text-[10px]">{task.ownerInitials}</div>
                      <span className="truncate text-muted-foreground">{task.owner}</span>
                    </div>
                    <div className="col-span-4 text-right font-mono text-[10.5px] text-muted-foreground md:col-span-2">{task.due}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-[12.5px] text-muted-foreground">
            <Sparkles className="h-5 w-5" />
            No human tasks match this view.
          </div>
        )}
      </div>
    </div>
  );
}
