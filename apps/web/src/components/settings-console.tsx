"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Bot, Check, FlaskConical, Plus, Save, X } from "lucide-react";
import { Badge } from "@/components/ui";
import type {
  AiWorkspaceSettings,
  AiWorkspaceTask,
  NotificationEventKey,
  NotificationPreferences,
  OperatorKnowledgeProfile,
  WorkspaceBusinessSettings
} from "@/lib/user-settings-store";

type SettingsSection = "profile" | "workspace" | "ai" | "notifications";

type SettingsConsoleProps = {
  activeSection: SettingsSection;
  profile: OperatorKnowledgeProfile;
  workspace: WorkspaceBusinessSettings;
  ai: AiWorkspaceSettings;
  notifications: NotificationPreferences;
  emailConfigured: boolean;
};

const aiTasks: AiWorkspaceTask[] = [
  "qualification-reply",
  "message-draft",
  "calendar-reply",
  "lead-research-planner",
  "lead-dossier",
  "onboarding-options"
];

const notificationEventLabels: Record<NotificationEventKey, string> = {
  newInboundLead: "New inbound lead",
  needsReply: "Needs reply",
  assignedToMe: "Assigned to me",
  aiEscalation: "AI escalation",
  humanReviewNeeded: "Human review needed",
  taskDue: "Task due",
  taskOverdue: "Task overdue",
  calendarMeeting: "Calendar meeting",
  deliveryFailed: "Delivery failed",
  aiBudgetThreshold: "AI budget threshold",
  systemHealthWarning: "System health warning"
};

const aiTaskLabels: Record<AiWorkspaceTask, string> = {
  "qualification-reply": "Qualification replies",
  "message-draft": "Assisted drafts",
  "calendar-reply": "Calendar replies",
  "lead-research-planner": "Lead research planning",
  "lead-dossier": "Lead summaries",
  "onboarding-options": "Onboarding answer options"
};

function costTierLabel(value: string) {
  if (value === "free") return "Lowest cost";
  if (value === "paid") return "Balanced";
  if (value === "premium") return "Best quality";
  return "Leadsy selected";
}

function addListValue(values: string[], value: string) {
  const clean = value.trim();
  if (!clean) return values;
  if (values.some((item) => item.toLowerCase() === clean.toLowerCase())) return values;
  return [...values, clean];
}

function removeListValue(values: string[], value: string) {
  return values.filter((item) => item !== value);
}

async function patchJson<T>(url: string, body: unknown, key: string): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "settings_save_failed");
  return payload[key] as T;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block min-w-0">
      <span className="caption">{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClass = "h-10 w-full rounded-[6px] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";
const textAreaClass = "min-h-24 w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none focus:border-primary";
const chipButtonClass = "inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-2.5 text-xs text-foreground hover:border-primary/70";

function MultiValueEditor({
  label,
  values,
  onChange,
  addLabel,
  placeholder
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addDraft() {
    const next = addListValue(values, draft);
    onChange(next);
    setDraft("");
  }

  return (
    <Field label={label}>
      <div className="rounded-[8px] border border-border bg-background p-3">
        <div className="flex min-h-9 flex-wrap gap-2">
          {values.length ? values.map((value) => (
            <button
              key={value}
              type="button"
              className={chipButtonClass}
              onClick={() => onChange(removeListValue(values, value))}
              title={`Remove ${value}`}
            >
              {value}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )) : (
            <div className="flex h-8 items-center text-xs text-muted-foreground">No items yet.</div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className={`${inputClass} h-9`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraft();
              }
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={!draft.trim()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-surface-2 px-3 text-xs font-medium hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        </div>
      </div>
    </Field>
  );
}


export function SettingsConsole({
  activeSection,
  profile,
  workspace,
  ai,
  notifications,
  emailConfigured
}: SettingsConsoleProps) {
  if (activeSection === "profile") return <ProfileSettings initial={profile} />;
  if (activeSection === "workspace") return <WorkspaceSettings initial={workspace} />;
  if (activeSection === "ai") return <AiSettings initial={ai} />;
  return <NotificationSettings initial={notifications} emailConfigured={emailConfigured} />;
}

function SaveButton({ pending, label = "Save" }: { pending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
      {pending ? "Saved" : label}
    </button>
  );
}

function StatusLine({ status }: { status: string }) {
  return <div className="min-h-5 text-xs text-muted-foreground">{status}</div>;
}

function ProfileSettings({ initial }: { initial: OperatorKnowledgeProfile }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const saved = await patchJson<OperatorKnowledgeProfile>("/api/settings/profile", form, "profile");
      setForm(saved);
      setStatus("Operator profile saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setTimeout(() => setPending(false), 500);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <section className="rounded-[8px] border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Operator knowledge base</h2>
            <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">Context AI agents use when drafting replies, handoffs, and calendar proposals.</p>
          </div>
          <SaveButton pending={pending} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Role title"><input className={inputClass} value={form.roleTitle} onChange={(event) => setForm({ ...form, roleTitle: event.target.value })} /></Field>
          <Field label="Seniority"><input className={inputClass} value={form.seniority} onChange={(event) => setForm({ ...form, seniority: event.target.value })} /></Field>
          <Field label="Timezone"><input className={inputClass} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></Field>
          <Field label="Working hours"><input className={inputClass} value={form.workingHours} onChange={(event) => setForm({ ...form, workingHours: event.target.value })} /></Field>
          <MultiValueEditor label="Languages" values={form.languages} onChange={(languages) => setForm({ ...form, languages })} addLabel="Add language" placeholder="English, Hindi, Bengali..." />
          <MultiValueEditor label="Expertise" values={form.expertise} onChange={(expertise) => setForm({ ...form, expertise })} addLabel="Add expertise" placeholder="Distributor sales, pricing..." />
          <MultiValueEditor label="Markets" values={form.markets} onChange={(markets) => setForm({ ...form, markets })} addLabel="Add market" placeholder="India, Mumbai, Tier 2 retail..." />
          <MultiValueEditor label="Services handled" values={form.servicesHandled} onChange={(servicesHandled) => setForm({ ...form, servicesHandled })} addLabel="Add service" placeholder="Retail onboarding, sampling..." />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Communication style"><textarea className={textAreaClass} value={form.communicationStyle} onChange={(event) => setForm({ ...form, communicationStyle: event.target.value })} /></Field>
          <Field label="Escalation preferences"><textarea className={textAreaClass} value={form.escalationPreferences} onChange={(event) => setForm({ ...form, escalationPreferences: event.target.value })} /></Field>
          <MultiValueEditor label="Restricted claims" values={form.restrictedClaims} onChange={(restrictedClaims) => setForm({ ...form, restrictedClaims })} addLabel="Add restriction" placeholder="Do not promise discounts..." />
          <Field label="Operator notes"><textarea className={textAreaClass} value={form.knowledgeBase} onChange={(event) => setForm({ ...form, knowledgeBase: event.target.value })} /></Field>
        </div>
        <div className="mt-4"><StatusLine status={status} /></div>
      </section>
    </form>
  );
}

function WorkspaceSettings({ initial }: { initial: WorkspaceBusinessSettings }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const saved = await patchJson<WorkspaceBusinessSettings>("/api/settings/workspace", form, "workspace");
      setForm(saved);
      setStatus("Workspace settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save workspace settings.");
    } finally {
      setTimeout(() => setPending(false), 500);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <section className="rounded-[8px] border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Business operations</h2>
            <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">Tenant-level context for qualification, assignment, follow-up, and calendar behavior.</p>
          </div>
          <SaveButton pending={pending} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Business name"><input className={inputClass} value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></Field>
          <Field label="Industry"><input className={inputClass} value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></Field>
          <Field label="Website"><input className={inputClass} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></Field>
          <Field label="Currency"><input className={inputClass} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></Field>
          <Field label="Timezone"><input className={inputClass} value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></Field>
          <Field label="Assignment defaults"><textarea className={textAreaClass} value={form.assignmentDefaults} onChange={(event) => setForm({ ...form, assignmentDefaults: event.target.value })} /></Field>
          <MultiValueEditor label="Markets" values={form.markets} onChange={(markets) => setForm({ ...form, markets })} addLabel="Add market" placeholder="India, West Bengal, distributors..." />
          <MultiValueEditor label="Services" values={form.services} onChange={(services) => setForm({ ...form, services })} addLabel="Add service" placeholder="Bulk orders, retail sampling..." />
          <MultiValueEditor label="Lead sources" values={form.leadSources} onChange={(leadSources) => setForm({ ...form, leadSources })} addLabel="Add source" placeholder="WhatsApp, website, events..." />
          <MultiValueEditor label="Pipeline stages" values={form.pipelineStages} onChange={(pipelineStages) => setForm({ ...form, pipelineStages })} addLabel="Add stage" placeholder="sample_requested, proposal_sent..." />
          <MultiValueEditor label="Qualification fields" values={form.qualificationFields} onChange={(qualificationFields) => setForm({ ...form, qualificationFields })} addLabel="Add field" placeholder="budget, timeline, authority..." />
          <MultiValueEditor label="Follow-up rules" values={form.followUpRules} onChange={(followUpRules) => setForm({ ...form, followUpRules })} addLabel="Add rule" placeholder="Follow up warm leads in 24 hours..." />
          <Field label="Calendar defaults"><textarea className={textAreaClass} value={form.calendarDefaults} onChange={(event) => setForm({ ...form, calendarDefaults: event.target.value })} /></Field>
        </div>
        <div className="mt-4"><StatusLine status={status} /></div>
      </section>
    </form>
  );
}

function AiSettings({ initial }: { initial: AiWorkspaceSettings }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [testTask, setTestTask] = useState<AiWorkspaceTask>("qualification-reply");
  const [testPrompt, setTestPrompt] = useState("Lead asks: I need help booking an appointment this week.");
  const [testOutput, setTestOutput] = useState("");

  const taskRows = useMemo(() => aiTasks.map((task) => ({ task, route: form.taskRouting[task], prompt: form.promptTemplates[task] })), [form]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const saved = await patchJson<AiWorkspaceSettings>("/api/settings/ai", {
        ...form,
        providerMode: form.remoteAiEnabled ? "openrouter" : "deterministic"
      }, "ai");
      setForm(saved);
      setStatus("AI settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save AI settings.");
    } finally {
      setTimeout(() => setPending(false), 500);
    }
  }

  async function runTest() {
    setTestOutput("Running test...");
    const response = await fetch("/api/settings/ai/test", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ task: testTask, prompt: testPrompt })
    });
    const payload = (await response.json().catch(() => ({}))) as { result?: { provider: string; model: string; costTier: string; output: string }; error?: string };
    if (!response.ok || !payload.result) {
      setTestOutput(payload.error || "AI test failed.");
      return;
    }
    setTestOutput(`${costTierLabel(payload.result.costTier)} route\n${payload.result.output}`);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <section className="rounded-[8px] border border-border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Advanced AI Lab</h2>
            <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">Reply behavior, cost guardrails, safety rules, and test replies.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={form.remoteAiEnabled ? "teal" : "neutral"}>{form.remoteAiEnabled ? "AI replies on" : "AI replies off"}</Badge>
            <SaveButton pending={pending} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Field label="Cost policy">
            <select className={inputClass} value={form.costMode} onChange={(event) => setForm({ ...form, costMode: event.target.value as AiWorkspaceSettings["costMode"] })}>
              <option value="free">Lowest cost</option>
              <option value="paid">Balanced</option>
              <option value="premium">Best quality</option>
            </select>
          </Field>
          <Field label="Monthly budget INR"><input type="number" className={inputClass} value={form.monthlyBudgetInr} onChange={(event) => setForm({ ...form, monthlyBudgetInr: Number(event.target.value) })} /></Field>
          <Field label="Human review threshold"><input type="number" min="0" max="1" step="0.05" className={inputClass} value={form.humanReviewThreshold} onChange={(event) => setForm({ ...form, humanReviewThreshold: Number(event.target.value) })} /></Field>
          <Field label="AI replies">
            <label className="flex h-10 items-center gap-2 rounded-[6px] border border-border bg-background px-3 text-sm">
              <input type="checkbox" checked={form.remoteAiEnabled} onChange={(event) => setForm({ ...form, remoteAiEnabled: event.target.checked })} />
              Enable contextual AI replies
            </label>
          </Field>
          <Field label="Temperature"><input type="number" min="0" max="2" step="0.1" className={inputClass} value={form.temperature} onChange={(event) => setForm({ ...form, temperature: Number(event.target.value) })} /></Field>
          <Field label="Max tokens"><input type="number" min="64" max="8000" className={inputClass} value={form.maxTokens} onChange={(event) => setForm({ ...form, maxTokens: Number(event.target.value) })} /></Field>
          <Field label="Response style"><input className={inputClass} value={form.responseStyle} onChange={(event) => setForm({ ...form, responseStyle: event.target.value })} /></Field>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <MultiValueEditor label="Escalation keywords" values={form.escalationKeywords} onChange={(escalationKeywords) => setForm({ ...form, escalationKeywords })} addLabel="Add keyword" placeholder="refund, angry, legal..." />
          <MultiValueEditor label="Blocked topics" values={form.blockedTopics} onChange={(blockedTopics) => setForm({ ...form, blockedTopics })} addLabel="Add topic" placeholder="Legal advice, medical claims..." />
        </div>

        <div className="mt-6">
          <div className="caption">Reply behavior templates</div>
          <div className="mt-3 space-y-3">
            {taskRows.map(({ task, route, prompt }) => (
              <div key={task} className="grid gap-3 rounded-[8px] border border-border p-3 lg:grid-cols-[220px_1fr]">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={route.enabled}
                    onChange={(event) => setForm({ ...form, taskRouting: { ...form.taskRouting, [task]: { ...route, enabled: event.target.checked } } })}
                  />
                  {aiTaskLabels[task]}
                </label>
                <textarea className="min-h-16 rounded-[6px] border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" value={prompt} onChange={(event) => setForm({ ...form, promptTemplates: { ...form.promptTemplates, [task]: event.target.value } })} />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4"><StatusLine status={status} /></div>
      </section>

      <section className="rounded-[8px] border border-border bg-background p-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <FlaskConical className="h-4 w-4 text-primary" />
          Test console
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr_auto]">
          <select className={inputClass} value={testTask} onChange={(event) => setTestTask(event.target.value as AiWorkspaceTask)}>
            {aiTasks.map((task) => <option key={task} value={task}>{aiTaskLabels[task]}</option>)}
          </select>
          <input className={inputClass} value={testPrompt} onChange={(event) => setTestPrompt(event.target.value)} />
          <button type="button" onClick={runTest} className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-border bg-surface-2 px-3 text-sm hover:bg-surface-3">
            <Bot className="h-4 w-4" /> Run test
          </button>
        </div>
        <pre className="mt-4 min-h-24 whitespace-pre-wrap rounded-[8px] border border-border bg-black/20 p-3 text-xs leading-5 text-muted-foreground">{testOutput || "Run a safe test without sending a message."}</pre>
      </section>
    </form>
  );
}

function NotificationSettings({ initial, emailConfigured }: { initial: NotificationPreferences; emailConfigured: boolean }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const eventKeys = Object.keys(notificationEventLabels) as NotificationEventKey[];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const saved = await patchJson<NotificationPreferences>("/api/settings/notifications", form, "notifications");
      setForm(saved);
      setStatus("Notification preferences saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save notification preferences.");
    } finally {
      setTimeout(() => setPending(false), 500);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5">
      <section className="rounded-[8px] border border-border bg-background p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Notification preferences</h2>
            <p className="mt-1 text-[12.5px] leading-6 text-muted-foreground">Control what reaches the top bar, notification center, toast stack, and optional email.</p>
          </div>
          <SaveButton pending={pending} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {(["inApp", "toast", "badge", "email"] as const).map((channel) => (
            <label key={channel} className="flex h-10 items-center gap-2 rounded-[6px] border border-border bg-background px-3 text-sm">
              <input
                type="checkbox"
                checked={form.channels[channel]}
                disabled={channel === "email" && !emailConfigured}
                onChange={(event) => setForm({ ...form, channels: { ...form.channels, [channel]: event.target.checked } })}
              />
              {channel === "inApp" ? "In-app" : channel}
            </label>
          ))}
        </div>
        {!emailConfigured ? <p className="mt-2 text-xs text-muted-foreground">Email is disabled until SMTP, Resend, or Postmark is configured in deployment.</p> : null}

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <Field label="Quiet hours">
            <label className="flex h-10 items-center gap-2 rounded-[6px] border border-border bg-background px-3 text-sm">
              <input type="checkbox" checked={form.quietHours.enabled} onChange={(event) => setForm({ ...form, quietHours: { ...form.quietHours, enabled: event.target.checked } })} />
              Enabled
            </label>
          </Field>
          <Field label="Start"><input className={inputClass} value={form.quietHours.start} onChange={(event) => setForm({ ...form, quietHours: { ...form.quietHours, start: event.target.value } })} /></Field>
          <Field label="End"><input className={inputClass} value={form.quietHours.end} onChange={(event) => setForm({ ...form, quietHours: { ...form.quietHours, end: event.target.value } })} /></Field>
          <Field label="Timezone"><input className={inputClass} value={form.quietHours.timezone} onChange={(event) => setForm({ ...form, quietHours: { ...form.quietHours, timezone: event.target.value } })} /></Field>
          <Field label="Digest">
            <select className={inputClass} value={form.digestFrequency} onChange={(event) => setForm({ ...form, digestFrequency: event.target.value as NotificationPreferences["digestFrequency"] })}>
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label="Priority threshold">
            <select className={inputClass} value={form.priorityThreshold} onChange={(event) => setForm({ ...form, priorityThreshold: event.target.value as NotificationPreferences["priorityThreshold"] })}>
              <option value="all">All</option>
              <option value="medium">Medium+</option>
              <option value="high">High only</option>
            </select>
          </Field>
          <Field label="Role routing">
            <select className={inputClass} value={form.roleRouting} onChange={(event) => setForm({ ...form, roleRouting: event.target.value as NotificationPreferences["roleRouting"] })}>
              <option value="all">All roles</option>
              <option value="owner">Owner</option>
              <option value="manager">Managers</option>
            </select>
          </Field>
          <Field label="Lead ownership">
            <label className="flex h-10 items-center gap-2 rounded-[6px] border border-border bg-background px-3 text-sm">
              <input type="checkbox" checked={form.notifyOnlyMyLeads} onChange={(event) => setForm({ ...form, notifyOnlyMyLeads: event.target.checked })} />
              Only my leads
            </label>
          </Field>
        </div>

        <div className="mt-6">
          <div className="caption">Event categories</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {eventKeys.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-[6px] border border-border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.events[key]}
                  onChange={(event) => setForm({ ...form, events: { ...form.events, [key]: event.target.checked } })}
                />
                {notificationEventLabels[key]}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4"><StatusLine status={status} /></div>
      </section>
    </form>
  );
}
