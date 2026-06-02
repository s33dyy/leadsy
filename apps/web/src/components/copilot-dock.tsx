"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, CheckCircle2, Command, Loader2, Send, X } from "lucide-react";

type CopilotMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ label: string; command: string }>;
};

export function CopilotDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("Summarize the highest-priority account and next action");
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      role: "assistant",
      content:
        "I am watching lead velocity, routing SLA, account intent, and deal risk. Ask for a forecast, account brief, sequence, workflow, or smart segment."
    }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt || loading) return;

    setMessages((current) => [...current, { role: "user", content: prompt }]);
    setInput("");
    setLoading(true);
    const response = await fetch("/api/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const payload = await response.json();
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: payload.answer ?? "I could not produce an answer for that request.",
        actions: payload.actions ?? []
      }
    ]);
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open revenue copilot"
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-[8px] border border-teal-300/35 bg-teal-300/[0.14] px-4 text-sm font-medium text-teal-100 shadow-2xl shadow-black/40 hover:bg-teal-300/20"
      >
        <Command size={16} />
        Copilot
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/[0.46] backdrop-blur-sm">
          <div className="absolute bottom-5 right-5 top-5 flex w-[min(520px,calc(100vw-40px))] flex-col overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[rgba(10,14,18,0.96)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-teal-300/[0.12] text-teal-200">
                  <Bot size={17} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Revenue Copilot</div>
                  <div className="mono text-[11px] text-[var(--muted)]">tenant-aware · audited · tool-ready</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close revenue copilot"
                className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--muted)] hover:bg-white/[0.06] hover:text-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="scrollbar-dark flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-[8px] border p-3 ${
                    message.role === "user"
                      ? "ml-8 border-sky-300/20 bg-sky-300/[0.08] text-sky-50"
                      : "mr-8 border-[var(--line)] bg-white/[0.035] text-[var(--muted-2)]"
                  }`}
                >
                  <p className="text-sm leading-6">{message.content}</p>
                  {message.actions?.length ? (
                    <div className="mt-3 grid gap-2">
                      {message.actions.map((action) => (
                        <button
                          type="button"
                          key={action.command}
                          className="flex items-center justify-between rounded-[6px] border border-[var(--line)] bg-black/20 px-3 py-2 text-left text-xs text-[var(--muted-2)] hover:border-teal-300/35 hover:text-white"
                          onClick={() =>
                            setMessages((current) => [
                              ...current,
                              {
                                role: "assistant",
                                content: `Queued action: ${action.label}. Command: ${action.command}.`
                              }
                            ])
                          }
                        >
                          {action.label}
                          <CheckCircle2 size={14} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {loading ? (
                <div className="mr-8 flex items-center gap-2 rounded-[8px] border border-[var(--line)] bg-white/[0.035] p-3 text-sm text-[var(--muted-2)]">
                  <Loader2 size={16} className="animate-spin text-[var(--teal)]" />
                  Reasoning across revenue context
                </div>
              ) : null}
            </div>

            <form onSubmit={submit} className="border-t border-[var(--line)] p-3">
              <div className="flex gap-2 rounded-[8px] border border-[var(--line)] bg-black/30 p-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-[var(--muted)]"
                  placeholder="Ask about accounts, deals, workflows, segments..."
                />
                <button
                  type="submit"
                  aria-label="Send copilot prompt"
                  className="flex h-9 w-9 items-center justify-center rounded-[6px] bg-teal-300/[0.16] text-teal-100 hover:bg-teal-300/[0.24]"
                >
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
