"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Link2, Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/components/toast-provider";

type RelatedLeadOption = {
  id: string;
  label: string;
  detail?: string;
};

type ManualLeadTeamMember = {
  id: string;
  name: string;
  type: "human" | "ai_agent_full" | "ai_agent_assisted";
  senderMode?: string;
  autoReplyEnabled?: boolean;
};

type ManualLeadIntakeProps = {
  relatedLeads: RelatedLeadOption[];
  teamMembers?: ManualLeadTeamMember[];
  endpoint?: string;
  buttonLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

const channelOptions = [
  ["manual", "Manual"],
  ["whatsapp", "WhatsApp"],
  ["email", "Email"],
  ["call", "Call Notes"]
];

function FieldLabel({ children }: { children: string }) {
  return <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{children}</span>;
}

export function ManualLeadIntake({
  relatedLeads,
  teamMembers = [],
  endpoint = "/api/leads/manual",
  buttonLabel = "Add Lead",
  open,
  onOpenChange,
  hideTrigger = false
}: ManualLeadIntakeProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const modalOpen = open ?? internalOpen;
  const defaultAssigneeId =
    teamMembers.find((member) => member.name.toLowerCase() === "qualification ai")?.id ??
    teamMembers.find((member) => member.type.startsWith("ai_agent"))?.id ??
    teamMembers[0]?.id ??
    "";

  const setOpen = useCallback((nextOpen: boolean) => {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, setOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const hasMinimum = ["displayName", "phone", "email", "handle", "body"].some((name) => String(formData.get(name) ?? "").trim());
    if (!hasMinimum) {
      setError("Add a name, phone, email, handle, or note before saving this lead.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as { href?: string; message?: string; aiAction?: { action?: string } };
      if (!response.ok) {
        throw new Error(payload.message || "The manual lead was not saved. Check the required fields and try again.");
      }
      const aiDetail =
        payload.aiAction?.action === "sent"
          ? "AI owner sent the first WhatsApp message."
          : payload.aiAction?.action === "drafted_for_review"
            ? "Assisted AI drafted the first message for review."
            : "Manual intake was saved to the CRM.";
      toast({ title: "Lead added", detail: aiDetail, tone: "success" });
      formRef.current?.reset();
      setOpen(false);
      router.push(payload.href || "/app/leads?notice=manual-lead-added");
      router.refresh();
    } catch (submitError) {
      const detail = submitError instanceof Error ? submitError.message : "The manual lead was not saved. Try again.";
      setError(detail);
      toast({ title: "Lead was not added", detail, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-xs font-medium text-teal-100 hover:border-teal-200 hover:bg-teal-300/[0.18]"
        >
          <Plus size={15} />
          {buttonLabel}
        </button>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[75] bg-black/70 p-0 backdrop-blur-md md:p-6" role="dialog" aria-modal="true" aria-labelledby="manual-lead-title">
          <div className="mx-auto flex h-full max-w-5xl flex-col overflow-hidden border border-[var(--line-strong)] bg-[var(--panel)] shadow-2xl md:h-[min(820px,calc(100vh-3rem))] md:rounded-[10px]">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] p-5">
              <div>
                <div className="mono text-[11px] uppercase text-[var(--teal)]">AI guided manual lead intake</div>
                <h2 id="manual-lead-title" className="mt-2 text-2xl font-semibold text-white">
                  Add Lead
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-2)]">
                  All questions are skippable. Leadsy stores answers as knowledge facts for operators and workers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] text-[var(--muted-2)] hover:text-white"
                aria-label="Close Add Lead"
              >
                <X size={16} />
              </button>
            </div>

            <form ref={formRef} action={endpoint} method="post" onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {error ? (
                  <div className="mb-4 rounded-[8px] border border-rose-300/25 bg-rose-300/[0.08] px-3 py-2 text-sm leading-6 text-rose-100">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[0.58fr_0.42fr]">
                  <section className="grid gap-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Bot size={16} className="text-[var(--teal)]" />
                      Core lead details
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2">
                        <FieldLabel>Full name</FieldLabel>
                        <input name="displayName" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Company</FieldLabel>
                        <input name="company" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Phone</FieldLabel>
                        <input name="phone" inputMode="tel" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Email</FieldLabel>
                        <input name="email" type="email" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Handle</FieldLabel>
                        <input name="handle" placeholder="@lead-handle" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-[var(--muted)]" />
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Channel / source</FieldLabel>
                        <select name="channel" defaultValue="manual" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none">
                          {channelOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2">
                        <FieldLabel>Status</FieldLabel>
                        <select name="leadStatus" defaultValue="lead" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none">
                          <option value="lead">Active lead</option>
                          <option value="excluded">Track only</option>
                        </select>
                      </label>
                      <label className="grid gap-2 md:col-span-2">
                        <FieldLabel>Owner</FieldLabel>
                        <select
                          name="assigneeId"
                          defaultValue={defaultAssigneeId}
                          className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none"
                        >
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name} · {member.type === "human" ? "Human" : member.type === "ai_agent_full" ? "Full AI" : "Assisted AI"}
                              {member.senderMode ? ` · ${member.senderMode}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="grid gap-2">
                      <FieldLabel>Profile URL</FieldLabel>
                      <input name="profileUrl" type="url" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none" />
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel>Initial notes</FieldLabel>
                      <textarea
                        name="body"
                        rows={5}
                        placeholder="What do we know about this lead?"
                        className="resize-y rounded-[6px] border border-[var(--line)] bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[var(--muted)]"
                      />
                    </label>
                  </section>

                  <section className="grid gap-3 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Link2 size={16} className="text-[var(--teal)]" />
                      Template-first AI questions
                    </div>
                    <div className="rounded-[8px] border border-teal-300/20 bg-teal-300/[0.07] p-3">
                      <div className="mono text-[10px] uppercase text-teal-100">Question type: MCQ</div>
                      <label className="mt-2 grid gap-2">
                        <FieldLabel>Urgency</FieldLabel>
                        <select name="urgency" defaultValue="" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none">
                          <option value="">Skip this question</option>
                          <option value="Immediate">Immediate</option>
                          <option value="This month">This month</option>
                          <option value="This quarter">This quarter</option>
                          <option value="Exploring">Exploring</option>
                        </select>
                      </label>
                    </div>
                    <div className="rounded-[8px] border border-sky-300/20 bg-sky-300/[0.06] p-3">
                      <div className="mono text-[10px] uppercase text-sky-100">Question type: Number</div>
                      <label className="mt-2 grid gap-2">
                        <FieldLabel>Estimated budget</FieldLabel>
                        <input name="estimatedBudget" type="number" min="0" inputMode="numeric" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none" />
                      </label>
                    </div>
                    <label className="grid gap-2">
                      <FieldLabel>Priority</FieldLabel>
                      <select name="priority" defaultValue="" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none">
                        <option value="">Skip this question</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel>Related lead</FieldLabel>
                      <select name="relatedLead" defaultValue="" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none">
                        <option value="">Skip this question</option>
                        {relatedLeads.map((lead) => (
                          <option key={lead.id} value={`${lead.label} (${lead.id})`}>
                            {lead.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel>Additional emails</FieldLabel>
                      <textarea
                        name="additionalEmails"
                        rows={3}
                        placeholder="One email per line, optional"
                        className="resize-y rounded-[6px] border border-[var(--line)] bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-[var(--muted)]"
                      />
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel>Source detail</FieldLabel>
                      <input name="sourceDetail" placeholder="Referral, event, import, or offline context" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-[var(--muted)]" />
                    </label>
                    <label className="grid gap-2">
                      <FieldLabel>Next action</FieldLabel>
                      <input name="nextAction" placeholder="Optional operator follow-up" className="h-10 rounded-[6px] border border-[var(--line)] bg-black/30 px-3 text-sm text-white outline-none placeholder:text-[var(--muted)]" />
                    </label>
                    <input type="hidden" name="direction" value="note" />
                    <input type="hidden" name="sendInitialAiMessage" value="true" />
                  </section>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] p-4">
                <p className="text-sm leading-6 text-[var(--muted-2)]">
                  Saving creates a manual note and updates this lead&apos;s knowledge base.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-sm font-medium text-[var(--muted-2)] hover:text-white"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.14] px-4 text-sm font-medium text-teal-50 hover:bg-teal-300/[0.2] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    Save lead
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
