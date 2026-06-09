"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Loader2, RefreshCw, Upload } from "lucide-react";
import type { SessionUser } from "@leadsy/security";
import { ProgressBar } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

type OnboardingProfile = Record<string, string>;
type OptionGroupKey =
  | "role"
  | "industry"
  | "teamSize"
  | "leadSources"
  | "assignmentPreferences"
  | "followUpPreferences"
  | "services"
  | "markets"
  | "targetQuestion0"
  | "targetQuestion1"
  | "targetQuestion2";
type OptionGroups = Record<OptionGroupKey, string[]>;
type OnboardingSenderState = {
  assignedPhoneNumber?: string;
  status?: string;
  statusReason?: string;
};

const steps = [
  "About You",
  "About Your Business",
  "Your Target Customer",
  "Completion Score"
];

const targetFields = [
  { key: "targetQuestion0", label: "Customer segment" },
  { key: "targetQuestion2", label: "Sales cycle" }
] as const;

const defaultOptions: OptionGroups = {
  role: ["Founder", "Sales Manager", "Marketing Manager", "Operations Manager", "Admissions Lead", "Customer Support Lead"],
  industry: ["Real Estate", "Education", "Healthcare", "Local Services", "Retail", "Hospitality", "SaaS", "Financial Services"],
  teamSize: ["1-5", "6-15", "16-50", "51-100", "100+"],
  leadSources: ["WhatsApp Ads", "Website", "Instagram", "Facebook", "Google Business Profile", "Manual Imports", "Referrals"],
  assignmentPreferences: ["Unassigned queue", "Round robin", "Source-based routing", "Manager assigns manually", "Assign to current owner"],
  followUpPreferences: ["Reply within 5 minutes", "Same-day follow-up", "Reminder after 24 hours", "Escalate hot leads", "Create task after missed reply"],
  services: ["Lead qualification", "WhatsApp follow-up", "Appointment booking", "Sales handoff", "Site visit coordination", "Customer support triage"],
  markets: ["Local city", "Statewide", "Pan-India", "International", "Tier 1 cities", "Tier 2 cities"],
  targetQuestion0: ["Consumers", "Small businesses", "Mid-market", "Enterprise", "Parents/students"],
  targetQuestion1: ["Under ₹10k", "₹10k-₹50k", "₹50k-₹2L", "₹2L+"],
  targetQuestion2: ["Same day", "1-7 days", "2-4 weeks", "1-3 months"]
};

function splitOptions(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinOptions(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].join(", ");
}

const chipClass = "rounded-[999px] border px-3 py-1.5 text-xs transition";

function MultiSelectField({
  keyName,
  label,
  value,
  options,
  error,
  customValue,
  wide = true,
  onToggle,
  onCustomChange,
  onAdd
}: {
  keyName: OptionGroupKey;
  label: string;
  value?: string;
  options: string[];
  error?: string;
  customValue?: string;
  wide?: boolean;
  onToggle: (key: OptionGroupKey, option: string) => void;
  onCustomChange: (key: OptionGroupKey, value: string) => void;
  onAdd: (key: OptionGroupKey) => void;
}) {
  const selected = splitOptions(value ?? "");
  return (
    <div className={wide ? "block md:col-span-2" : "block"}>
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">{label}</span>
        {error ? <span className="text-xs text-rose-200">{error}</span> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(keyName, option)}
              className={`${chipClass} ${active ? "border-teal-300/40 bg-teal-300/[0.16] text-teal-50" : "border-[var(--line)] bg-white/[0.04] text-[var(--muted-2)] hover:text-white"}`}
            >
              {option}
            </button>
          );
        })}
        <div className="flex min-w-[190px] flex-1 items-center gap-2">
          <input
            value={customValue ?? ""}
            onChange={(event) => onCustomChange(keyName, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd(keyName);
              }
            }}
            placeholder="Add custom"
            className="h-8 min-w-0 flex-1 rounded-[6px] border border-[var(--line)] bg-black/20 px-2 text-xs text-white placeholder:text-[var(--muted)]"
          />
          <button type="button" onClick={() => onAdd(keyName)} className="h-8 rounded-[6px] border border-[var(--line)] px-2 text-xs text-[var(--muted-2)] hover:text-white">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

async function fetchOnboardingOptions(profile: OnboardingProfile) {
  const response = await fetch("/api/onboarding/options", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(profile)
  });
  const payload = (await response.json().catch(() => ({}))) as { options?: Partial<OptionGroups> };
  return response.ok ? payload.options : undefined;
}

function textFromProfile(profile: Record<string, unknown> | undefined, key: string) {
  const value = profile?.[key];
  return typeof value === "string" ? value : "";
}

function workspaceConfigurationFromProfile(profile: OnboardingProfile) {
  const leadMode = profile.leadMode === "b2c" ? "b2c" : "b2b";
  return {
    leadMode,
    businessName: profile.businessName,
    website: profile.website,
    industry: profile.industry,
    teamSize: profile.teamSize,
    services: profile.services,
    businessPhone: profile.phone,
    whatsappTransport: "leadsy_assigned_twilio",
    whatsappAssignment: "leadsy_assigned",
    leadSources: profile.leadSources,
    assignmentPreferences: profile.assignmentPreferences,
    followUpPreferences: profile.followUpPreferences
  };
}

function senderStatusLabel(status?: string) {
  switch (status) {
    case "approved":
      return "Approved";
    case "number_reserved":
      return "Number reserved";
    case "pending_verification":
    case "sender_registration_pending":
      return "Approval pending";
    case "failed":
      return "Needs review";
    case "disabled":
      return "Disabled";
    default:
      return "Pending";
  }
}

export function OnboardingWizard({ session }: { session: SessionUser }) {
  const { toast } = useToast();
  const router = useRouter();
  const initialProfile = session.onboardingProfile ?? {};
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>({
    fullName: textFromProfile(initialProfile, "fullName") || session.name,
    role: textFromProfile(initialProfile, "role"),
    phone: textFromProfile(initialProfile, "phone"),
    businessName: textFromProfile(initialProfile, "businessName"),
    industry: textFromProfile(initialProfile, "industry"),
    teamSize: textFromProfile(initialProfile, "teamSize"),
    leadSources: textFromProfile(initialProfile, "leadSources"),
    assignmentPreferences: textFromProfile(initialProfile, "assignmentPreferences"),
    followUpPreferences: textFromProfile(initialProfile, "followUpPreferences"),
    services: textFromProfile(initialProfile, "services"),
    leadMode: textFromProfile(initialProfile, "leadMode") || "b2b",
    markets: textFromProfile(initialProfile, "markets"),
    website: textFromProfile(initialProfile, "website"),
    targetQuestion0: textFromProfile(initialProfile, "targetQuestion0"),
    targetQuestion1: textFromProfile(initialProfile, "targetQuestion1"),
    targetQuestion2: textFromProfile(initialProfile, "targetQuestion2")
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<OptionGroups>(defaultOptions);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [customOptions, setCustomOptions] = useState<Record<string, string>>({});
  const [completionSender, setCompletionSender] = useState<OnboardingSenderState | undefined>();
  const [setupCompleted, setSetupCompleted] = useState(false);

  const requiredKeys = [
    "fullName",
    "role",
    "businessName",
    "industry",
    "teamSize",
    "leadSources",
    "assignmentPreferences",
    "followUpPreferences",
    "targetQuestion0",
    "targetQuestion2"
  ];
  const completedFields = requiredKeys.filter((key) => profile[key]?.trim()).length;
  const completionScore = Math.round((completedFields / requiredKeys.length) * 100);

  function skipWizardForNow() {
    setVisible(false);
  }

  function openWorkspace() {
    setVisible(false);
    router.refresh();
  }

  function updateField(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function toggleOption(key: OptionGroupKey, option: string) {
    const current = splitOptions(profile[key] ?? "");
    updateField(key, current.includes(option) ? joinOptions(current.filter((item) => item !== option)) : joinOptions([...current, option]));
  }

  function addCustomOption(key: OptionGroupKey) {
    const value = customOptions[key]?.trim();
    if (!value) return;
    setOptions((current) => ({ ...current, [key]: [...new Set([...current[key], value])] }));
    updateField(key, joinOptions([...splitOptions(profile[key] ?? ""), value]));
    setCustomOptions((current) => ({ ...current, [key]: "" }));
  }

  async function refreshOptions() {
    setOptionsLoading(true);
    try {
      const nextOptions = await fetchOnboardingOptions(profile);
      if (nextOptions) {
        setOptions((current) => ({ ...current, ...nextOptions }));
      }
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    void fetchOnboardingOptions(profile).then((nextOptions) => {
      if (!cancelled && nextOptions) {
        setOptions((current) => ({ ...current, ...nextOptions }));
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  function validateStep() {
    const nextErrors: Record<string, string> = {};
    const keysByStep: Record<number, string[]> = {
      0: ["fullName", "role"],
      1: ["businessName", "industry", "teamSize", "leadSources", "assignmentPreferences", "followUpPreferences"],
      2: ["targetQuestion0", "targetQuestion2"]
    };
    for (const key of keysByStep[step] ?? []) {
      if (!profile[key]?.trim()) nextErrors[key] = "Required for first-login setup.";
    }
    if (profile.website && !/^https?:\/\/.+\..+/.test(profile.website)) {
      nextErrors.website = "Enter a full URL, including https://.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveProgress(complete = false) {
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            ...profile,
            workspaceConfiguration: workspaceConfigurationFromProfile(profile)
          },
          complete
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sender?: OnboardingSenderState;
        user?: { onboardingCompletedAt?: string };
      };
      if (response.status === 401) {
        toast({ title: "Onboarding session expired", detail: "Refresh the page, then continue setup.", tone: "error" });
        return false;
      }
      if (!response.ok) {
        toast({ title: "Onboarding was not saved", detail: "Check your connection and try again.", tone: "error" });
        return false;
      }
      if (complete) {
        if (!payload.user?.onboardingCompletedAt) {
          toast({
            title: "Onboarding was not completed",
            detail: "Leadsy saved your answers but did not receive completion confirmation. Try again.",
            tone: "error"
          });
          return false;
        }
        setCompletionSender(payload.sender);
        setSetupCompleted(true);
        toast({
          title: "Onboarding complete",
          detail: payload.sender?.assignedPhoneNumber
            ? "Your Leadsy number is assigned. WhatsApp approval status is tracked separately."
            : "Leadsy is preparing your workspace WhatsApp number.",
          tone: "success"
        });
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    if (!validateStep()) return;
    if (!(await saveProgress(false))) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function finishSetup() {
    if (!(await saveProgress(true))) return;
  }

  const inputClass = "mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]";
  const secondaryButtonClass = "inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--line)] px-3 text-sm text-[var(--muted-2)] hover:text-white";
  const multiSelectHandlers = {
    onToggle: toggleOption,
    onCustomChange: (key: OptionGroupKey, value: string) => setCustomOptions((current) => ({ ...current, [key]: value })),
    onAdd: addCustomOption
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 p-0 backdrop-blur-md md:p-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-2xl md:rounded-[8px]">
        <div className="border-b border-[var(--line)] p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mono text-[11px] uppercase text-[var(--teal)]">Step {step + 1} of {steps.length}</div>
              <h2 id="onboarding-title" className="mt-2 text-xl font-semibold text-white">{steps[step]}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={skipWizardForNow}
                className="h-8 rounded-[5px] border border-[var(--line)] bg-white/[0.03] px-2.5 text-[12px] text-[var(--muted-2)] hover:bg-white/[0.06] hover:text-white"
              >
                Skip for now
              </button>
              <div className="w-40">
                <ProgressBar value={((step + 1) / steps.length) * 100} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {step === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Full name</span>
                <input value={profile.fullName} onChange={(event) => updateField("fullName", event.target.value)} aria-invalid={Boolean(fieldErrors.fullName)} className={inputClass} />
                {fieldErrors.fullName ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.fullName}</span> : null}
              </label>
              <MultiSelectField
                keyName="role"
                label="Job title / Role"
                value={profile.role}
                options={options.role}
                error={fieldErrors.role}
                customValue={customOptions.role}
                wide={false}
                {...multiSelectHandlers}
              />
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Business phone (optional)</span>
                <input value={profile.phone} onChange={(event) => updateField("phone", event.target.value)} aria-invalid={Boolean(fieldErrors.phone)} className={inputClass} />
                {fieldErrors.phone ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.phone}</span> : null}
              </label>
              <div className="rounded-[8px] border border-dashed border-[var(--line)] bg-white/[0.03] p-4">
                <Upload size={18} className="text-[var(--teal)]" />
                <div className="mt-3 text-sm font-medium text-white">Profile photo upload</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">Optional. Photo upload storage will use the existing asset path when enabled.</p>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center justify-between gap-3">
                <p className="text-sm leading-6 text-[var(--muted-2)]">Leadsy suggests compact profile choices from your business context.</p>
                <button type="button" disabled={optionsLoading} onClick={refreshOptions} className={secondaryButtonClass}>
                  {optionsLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Refresh AI options
                </button>
              </div>
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Business name</span>
                <input value={profile.businessName} onChange={(event) => updateField("businessName", event.target.value)} aria-invalid={Boolean(fieldErrors.businessName)} className={inputClass} />
                {fieldErrors.businessName ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.businessName}</span> : null}
              </label>
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Website URL (optional)</span>
                <input value={profile.website} onChange={(event) => updateField("website", event.target.value)} aria-invalid={Boolean(fieldErrors.website)} placeholder="https://example.com" className={inputClass} />
                {fieldErrors.website ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.website}</span> : null}
              </label>
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Lead mode</span>
                <select value={profile.leadMode} onChange={(event) => updateField("leadMode", event.target.value)} className={inputClass}>
                  <option value="b2b">B2B leads</option>
                  <option value="b2c">B2C / student leads</option>
                </select>
              </label>
              <MultiSelectField
                keyName="industry"
                label="Industry"
                value={profile.industry}
                options={options.industry}
                error={fieldErrors.industry}
                customValue={customOptions.industry}
                wide={false}
                {...multiSelectHandlers}
              />
              <MultiSelectField
                keyName="teamSize"
                label="Team size"
                value={profile.teamSize}
                options={options.teamSize}
                error={fieldErrors.teamSize}
                customValue={customOptions.teamSize}
                wide={false}
                {...multiSelectHandlers}
              />
              <MultiSelectField
                keyName="leadSources"
                label="Lead sources"
                value={profile.leadSources}
                options={options.leadSources}
                error={fieldErrors.leadSources}
                customValue={customOptions.leadSources}
                {...multiSelectHandlers}
              />
              <MultiSelectField
                keyName="services"
                label="Services offered"
                value={profile.services}
                options={options.services}
                error={fieldErrors.services}
                customValue={customOptions.services}
                {...multiSelectHandlers}
              />
              <MultiSelectField
                keyName="assignmentPreferences"
                label="Assignment preferences"
                value={profile.assignmentPreferences}
                options={options.assignmentPreferences}
                error={fieldErrors.assignmentPreferences}
                customValue={customOptions.assignmentPreferences}
                {...multiSelectHandlers}
              />
              <MultiSelectField
                keyName="followUpPreferences"
                label="Follow-up preferences"
                value={profile.followUpPreferences}
                options={options.followUpPreferences}
                error={fieldErrors.followUpPreferences}
                customValue={customOptions.followUpPreferences}
                {...multiSelectHandlers}
              />
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4 md:col-span-2">
                <div className="mono text-[10px] uppercase text-[var(--muted)]">WhatsApp transport</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
                  Leadsy assigns a dedicated WhatsApp lead number and manages Twilio internally. Advertise that assigned number once provisioning is approved.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--muted-2)]">
                {profile.leadMode === "b2c"
                  ? "Leadsy uses these answers as student and consumer context for qualification, summaries, and handoff tasks."
                  : "Leadsy uses these qualifying answers as business context for worker research, summaries, and task drafting."}
              </p>
              {targetFields.map(({ key, label }) => {
                return (
                  <MultiSelectField
                    key={key}
                    keyName={key}
                    label={label}
                    value={profile[key]}
                    options={options[key]}
                    error={fieldErrors[key]}
                    customValue={customOptions[key]}
                    {...multiSelectHandlers}
                  />
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <div className="text-4xl font-semibold text-white">{completionScore}%</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">Your profile completion score is based on the business context Leadsy uses for qualification, assignment, and follow-up tasks.</p>
              </div>
              <ProgressBar value={completionScore} tone={completionScore >= 70 ? "lime" : "amber"} />
              <div className="rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] p-4 text-sm leading-6 text-teal-50">
                <div className="flex items-start gap-3">
                  {completionSender?.assignedPhoneNumber ? <CheckCircle2 size={18} className="mt-0.5 text-lime-200" /> : <CircleAlert size={18} className="mt-0.5 text-amber-200" />}
                  <div>
                    <div className="font-semibold text-white">
                      {completionSender?.assignedPhoneNumber
                        ? `Your WhatsApp Number is: ${completionSender.assignedPhoneNumber}`
                        : "Your WhatsApp Number is being prepared"}
                    </div>
                    <p className="mt-1 text-[var(--muted-2)]">
                      {completionSender?.assignedPhoneNumber
                        ? `WhatsApp approval status: ${senderStatusLabel(completionSender.status)}. Leads who message this number will appear in Inbox once the sender is approved.`
                        : completionSender?.statusReason || "Leadsy is checking Twilio India number availability and WhatsApp sender approval."}
                    </p>
                    {completionSender?.assignedPhoneNumber && completionSender.statusReason ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">{completionSender.statusReason}</p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--muted-2)]">
                Humans remain accountable for replies. Leadsy tracks inbound and outbound WhatsApp conversations in Inbox without autonomous outreach.
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] p-4">
          <button
            type="button"
            disabled={step === 0 || saving}
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-[var(--line)] px-3 text-sm text-[var(--muted-2)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowLeft size={15} />
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={nextStep}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Next
            </button>
          ) : (
            setupCompleted ? (
              <button
                type="button"
                onClick={openWorkspace}
                className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
              >
                <CheckCircle2 size={15} />
                Open Workspace
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={finishSetup}
                className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Finish Setup
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
