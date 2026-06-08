"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, CheckSquare, Loader2, Search, Settings, Sparkles, Users2, X } from "lucide-react";
import type { CommandSearchResult, CommandSearchResultType } from "@/lib/command-search";

type CommandSearchModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const typeLabels: Record<CommandSearchResultType, string> = {
  route: "Route",
  lead: "Lead",
  conversation: "Conversation",
  team_member: "Team",
  calendar_event: "Calendar",
  task: "Task",
  setting: "Setting",
  action: "Action"
};

function iconForType(type: CommandSearchResultType) {
  if (type === "lead" || type === "conversation" || type === "team_member") return Users2;
  if (type === "calendar_event") return CalendarDays;
  if (type === "task") return CheckSquare;
  if (type === "setting") return Settings;
  if (type === "action") return Sparkles;
  return ArrowRight;
}

export function CommandSearchModal({ open, onOpenChange }: CommandSearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => ({}))) as { results?: CommandSearchResult[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Search failed");
        setResults(payload.results ?? []);
        setActiveIndex(0);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") {
          setResults([]);
          setError("Search is unavailable right now.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const activeResult = useMemo(() => results[activeIndex], [activeIndex, results]);

  function resetSearch() {
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    setError("");
    setLoading(false);
  }

  function close() {
    resetSearch();
    onOpenChange(false);
  }

  function openResult(result?: CommandSearchResult) {
    if (!result) return;
    resetSearch();
    onOpenChange(false);
    router.push(result.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 px-3 pt-[12vh] backdrop-blur-sm" onMouseDown={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-search-title"
        className="w-full max-w-2xl overflow-hidden rounded-[8px] border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 id="command-search-title" className="sr-only">
              Command search
            </h2>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.min(index + 1, Math.max(0, results.length - 1)));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) => Math.max(0, index - 1));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  openResult(activeResult);
                }
              }}
              placeholder="Search leads, conversations, team, calendar, tasks..."
              className="h-10 w-full bg-transparent text-[18px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          <button
            type="button"
            onClick={close}
            className="grid h-8 w-8 place-items-center rounded-[5px] border border-border bg-surface-2 text-muted-foreground hover:text-foreground"
            aria-label="Close command search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {error ? <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">{error}</div> : null}
          {!error && results.length ? (
            <ul className="space-y-1">
              {results.map((result, index) => {
                const Icon = iconForType(result.type);
                const active = index === activeIndex;
                return (
                  <li key={result.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openResult(result)}
                      className={`flex w-full items-center gap-3 rounded-[6px] px-3 py-2.5 text-left ${active ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[5px] border border-border bg-background">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{result.title}</span>
                        <span className="mt-0.5 block truncate font-mono text-[10.5px] text-muted-foreground">{typeLabels[result.type]} - {result.subtitle}</span>
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {!error && !loading && !results.length ? (
            <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
              No matching workspace results.
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-4 py-2 font-mono text-[10.5px] text-muted-foreground">
          <span>ArrowUp / ArrowDown to move</span>
          <span>Enter to open</span>
          <span>Escape to close</span>
        </div>
      </div>
    </div>
  );
}
