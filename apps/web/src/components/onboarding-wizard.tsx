"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Clipboard, Download, ExternalLink, KeyRound, Loader2, Upload } from "lucide-react";
import type { SessionUser } from "@leadsy/security";
import { ProgressBar } from "@/components/ui";
import { useToast } from "@/components/toast-provider";

type OnboardingProfile = Record<string, string>;

const steps = [
  "About You",
  "About Your Business",
  "Your Target Customer",
  "Integration Verification",
  "Completion Score"
];

const targetQuestions = [
  "What company size do you typically sell to?",
  "What is your average deal size?",
  "What is your typical sales cycle?"
];

function onboardingDismissedKey(userId: string) {
  return `leadsy:onboarding-dismissed:${userId}`;
}

function onboardingDismissedCookie() {
  return "leadsy_onboarding_dismissed=true";
}

function onboardingDismissed(userId: string) {
  if (typeof window === "undefined") return false;
  return (
    document.cookie.includes(onboardingDismissedCookie()) ||
    window.localStorage.getItem(onboardingDismissedKey(userId)) === "true"
  );
}

function textFromProfile(profile: Record<string, unknown> | undefined, key: string) {
  const value = profile?.[key];
  return typeof value === "string" ? value : "";
}

function workspaceConfigurationFromProfile(profile: OnboardingProfile) {
  return {
    businessName: profile.businessName,
    industry: profile.industry,
    teamSize: profile.teamSize,
    whatsappNumber: profile.whatsappNumber,
    countryCode: profile.whatsappNumber.trim().startsWith("+") ? "" : "+91",
    whatsappTransport: "leadsy_managed_twilio",
    leadSources: profile.leadSources,
    assignmentPreferences: profile.assignmentPreferences,
    followUpPreferences: profile.followUpPreferences
  };
}

export function OnboardingWizard({
  session,
  hasMetaConnection
}: {
  session: SessionUser;
  hasMetaConnection: boolean;
}) {
  const { toast } = useToast();
  const initialProfile = session.onboardingProfile ?? {};
  const [visible, setVisible] = useState(() => {
    return !onboardingDismissed(session.id);
  });
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>({
    fullName: textFromProfile(initialProfile, "fullName") || session.name,
    role: textFromProfile(initialProfile, "role"),
    phone: textFromProfile(initialProfile, "phone"),
    businessName: textFromProfile(initialProfile, "businessName"),
    industry: textFromProfile(initialProfile, "industry"),
    teamSize: textFromProfile(initialProfile, "teamSize"),
    whatsappNumber: textFromProfile(initialProfile, "whatsappNumber"),
    leadSources: textFromProfile(initialProfile, "leadSources"),
    assignmentPreferences: textFromProfile(initialProfile, "assignmentPreferences"),
    followUpPreferences: textFromProfile(initialProfile, "followUpPreferences"),
    services: textFromProfile(initialProfile, "services"),
    markets: textFromProfile(initialProfile, "markets"),
    website: textFromProfile(initialProfile, "website"),
    targetQuestion0: textFromProfile(initialProfile, "targetQuestion0"),
    targetQuestion1: textFromProfile(initialProfile, "targetQuestion1"),
    targetQuestion2: textFromProfile(initialProfile, "targetQuestion2")
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [extensionLabel, setExtensionLabel] = useState("Chrome worker");
  const [extensionToken, setExtensionToken] = useState("");
  const [extensionNotice, setExtensionNotice] = useState("");
  const [extensionLoading, setExtensionLoading] = useState(false);

  const requiredKeys = [
    "fullName",
    "role",
    "phone",
    "businessName",
    "industry",
    "teamSize",
    "whatsappNumber",
    "leadSources",
    "assignmentPreferences",
    "followUpPreferences",
    "services",
    "markets",
    "website",
    "targetQuestion0",
    "targetQuestion1",
    "targetQuestion2"
  ];
  const completedFields = requiredKeys.filter((key) => profile[key]?.trim()).length;
  const completionScore = Math.round(((completedFields + (hasMetaConnection ? 1 : 0)) / (requiredKeys.length + 1)) * 100);

  const integrationItems = useMemo(
    () => [
      {
        id: "extension",
        label: "Browser Extension",
        status: "warning",
        detail: "Generate a worker token, download the extension zip, then load it in Chrome."
      },
      {
        id: "meta",
        label: "Meta (Facebook/Instagram)",
        status: hasMetaConnection ? "connected" : "optional",
        detail: hasMetaConnection ? "Meta authorization is connected." : "Optional during onboarding. Connect now or skip and configure it from Profile Settings."
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        status: hasMetaConnection ? "connected" : "optional",
        detail: hasMetaConnection ? "WhatsApp assets can be verified in Integrations." : "WhatsApp readiness is handled through the Meta connection when those assets are ready."
      },
      {
        id: "openrouter",
        label: "OpenRouter / AI",
        status: "connected",
        detail: "Leadsy handles AI routing with the configured OpenRouter API keys. No user action is needed here."
      }
    ],
    [hasMetaConnection]
  );

  if (!visible) return null;

  function dismissWizard() {
    window.localStorage.setItem(onboardingDismissedKey(session.id), "true");
    document.cookie = `${onboardingDismissedCookie()}; path=/; max-age=2592000; SameSite=Lax`;
    setVisible(false);
  }

  function updateField(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateStep() {
    const nextErrors: Record<string, string> = {};
    const keysByStep: Record<number, string[]> = {
      0: ["fullName", "role", "phone"],
      1: ["businessName", "industry", "teamSize", "whatsappNumber", "leadSources", "assignmentPreferences", "followUpPreferences", "services", "markets", "website"],
      2: ["targetQuestion0", "targetQuestion1", "targetQuestion2"]
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
      if (response.status === 401) {
        toast({ title: "Onboarding session expired", detail: "Refresh the page, then continue setup.", tone: "error" });
        return false;
      }
      if (!response.ok) {
        toast({ title: "Onboarding was not saved", detail: "Check your connection and try again.", tone: "error" });
        return false;
      }
      if (complete) {
        toast({ title: "Onboarding complete", detail: "Your profile context is ready for Leadsy workers.", tone: "success" });
        dismissWizard();
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function createExtensionToken() {
    setExtensionLoading(true);
    setExtensionNotice("");
    try {
      const response = await fetch("/api/extension/tokens", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: extensionLabel.trim() || "Chrome worker" })
      });
      const payload = (await response.json().catch(() => ({}))) as { token?: unknown; message?: unknown; error?: unknown };
      if (response.status === 401) {
        toast({ title: "Extension token was not created", detail: "Refresh the page, then create the token again.", tone: "error" });
        return;
      }
      if (!response.ok || typeof payload.token !== "string") {
        const detail = typeof payload.message === "string" ? payload.message : typeof payload.error === "string" ? payload.error : "Try again from the extension settings panel.";
        toast({ title: "Extension token was not created", detail, tone: "error" });
        return;
      }
      setExtensionToken(payload.token);
      setExtensionNotice("Token created. Copy it into the extension side panel after installation.");
      toast({ title: "Extension token created", detail: "Copy it now. It is shown only in this setup step.", tone: "success" });
    } finally {
      setExtensionLoading(false);
    }
  }

  async function copyExtensionToken() {
    if (!extensionToken) return;
    try {
      await navigator.clipboard.writeText(extensionToken);
      setExtensionNotice("Token copied.");
    } catch {
      setExtensionNotice("Copy unavailable. Select the token text and copy it manually.");
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
  const textareaClass = "mt-2 min-h-24 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)]";
  const secondaryButtonClass = "inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--line)] px-3 text-sm text-[var(--muted-2)] hover:text-white";

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
                onClick={dismissWizard}
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
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Job title / Role</span>
                <input value={profile.role} onChange={(event) => updateField("role", event.target.value)} aria-invalid={Boolean(fieldErrors.role)} className={inputClass} />
                {fieldErrors.role ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.role}</span> : null}
              </label>
              <label className="block">
                <span className="mono text-[10px] uppercase text-[var(--muted)]">Phone number</span>
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
              {[
                ["businessName", "Business name"],
                ["industry", "Industry"],
                ["teamSize", "Team size"],
                ["whatsappNumber", "WhatsApp number"],
                ["leadSources", "Lead sources"],
                ["assignmentPreferences", "Assignment preferences"],
                ["followUpPreferences", "Follow-up preferences"],
                ["services", "Services/products offered"],
                ["markets", "Geography / target markets"],
                ["website", "Business website URL"]
              ].map(([key, label]) => (
                <label key={key} className={key === "services" || key === "markets" || key === "leadSources" || key === "assignmentPreferences" || key === "followUpPreferences" ? "block md:col-span-2" : "block"}>
                  <span className="mono text-[10px] uppercase text-[var(--muted)]">{label}</span>
                  {key === "services" || key === "markets" || key === "leadSources" || key === "assignmentPreferences" || key === "followUpPreferences" ? (
                    <textarea value={profile[key]} onChange={(event) => updateField(key, event.target.value)} aria-invalid={Boolean(fieldErrors[key])} className={textareaClass} />
                  ) : (
                    <input value={profile[key]} onChange={(event) => updateField(key, event.target.value)} aria-invalid={Boolean(fieldErrors[key])} className={inputClass} />
                  )}
                  {fieldErrors[key] ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors[key]}</span> : null}
                </label>
              ))}
              <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-4 md:col-span-2">
                <div className="mono text-[10px] uppercase text-[var(--muted)]">WhatsApp transport</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
                  Leadsy manages Twilio internally for WhatsApp messaging. Your team only needs to provide the business WhatsApp number and lead-source preferences.
                </p>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm leading-6 text-[var(--muted-2)]">
                Leadsy uses these qualifying answers as business context for worker research, summaries, and task drafting.
              </p>
              {targetQuestions.map((question, index) => {
                const key = `targetQuestion${index}`;
                return (
                  <label key={question} className="block">
                    <span className="mono text-[10px] uppercase text-[var(--muted)]">{question}</span>
                    <textarea value={profile[key]} onChange={(event) => updateField(key, event.target.value)} aria-invalid={Boolean(fieldErrors[key])} className={textareaClass} />
                    {fieldErrors[key] ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors[key]}</span> : null}
                  </label>
                );
              })}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-3">
              {integrationItems.map((item) => (
                <div key={item.label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {item.status === "connected" ? <CheckCircle2 size={18} className="text-lime-200" /> : <CircleAlert size={18} className="text-amber-200" />}
                      <div>
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
                      </div>
                    </div>
                    {item.id === "extension" ? (
                      <a href="/downloads/leadsy-extension.zip" download className={secondaryButtonClass}>
                        <Download size={15} />
                        Download zip
                      </a>
                    ) : null}
                    {item.id === "meta" || item.id === "whatsapp" ? (
                      <Link href="/app/connect" target="_blank" rel="noreferrer" className={secondaryButtonClass}>
                        <ExternalLink size={15} />
                        {hasMetaConnection ? "Review" : "Connect"}
                      </Link>
                    ) : null}
                    {item.id === "openrouter" ? (
                      <span className="mono rounded-[6px] border border-lime-300/25 bg-lime-300/[0.08] px-3 py-2 text-[10px] uppercase text-lime-100">
                        Managed
                      </span>
                    ) : null}
                  </div>

                  {item.id === "extension" ? (
                    <details className="mt-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-white">Generate token and install extension</summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <KeyRound size={16} className="text-[var(--teal)]" />
                            Worker token
                          </div>
                          <label className="mt-3 block">
                            <span className="mono text-[10px] uppercase text-[var(--muted)]">Token label</span>
                            <input value={extensionLabel} onChange={(event) => setExtensionLabel(event.target.value)} className={inputClass} />
                          </label>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={extensionLoading}
                              onClick={createExtensionToken}
                              className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {extensionLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                              Generate token
                            </button>
                            {extensionToken ? (
                              <button type="button" onClick={copyExtensionToken} className={secondaryButtonClass}>
                                <Clipboard size={15} />
                                Copy token
                              </button>
                            ) : null}
                          </div>
                          {extensionToken ? <div className="mono mt-3 break-all rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] p-3 text-xs leading-6 text-teal-50">{extensionToken}</div> : null}
                          {extensionNotice ? <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">{extensionNotice}</p> : null}
                        </div>
                        <ol className="grid gap-2 text-sm leading-6 text-[var(--muted-2)]">
                          <li><span className="text-white">1.</span> Download <span className="mono text-white">leadsy-extension.zip</span> and unzip it.</li>
                          <li><span className="text-white">2.</span> Open <span className="mono text-white">chrome://extensions</span> and enable Developer mode.</li>
                          <li><span className="text-white">3.</span> Click Load unpacked and select the unzipped Leadsy extension folder.</li>
                          <li><span className="text-white">4.</span> Open the extension side panel, paste the Leadsy URL and generated token, then save.</li>
                        </ol>
                      </div>
                    </details>
                  ) : null}

                  {item.id === "meta" ? (
                    <details className="mt-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-white">Meta connection steps</summary>
                      <ol className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted-2)]">
                        <li><span className="text-white">1.</span> Click Connect to open the existing Meta setup flow.</li>
                        <li><span className="text-white">2.</span> Choose the Facebook, Instagram, and WhatsApp business assets you want Leadsy to read inbound leads from.</li>
                        <li><span className="text-white">3.</span> Return to onboarding when Meta confirms authorization.</li>
                        <li><span className="text-white">Skip.</span> You can press Next now and configure Meta later from <Link href="/settings" target="_blank" rel="noreferrer" className="text-teal-100 underline underline-offset-4">Profile Settings</Link>.</li>
                      </ol>
                    </details>
                  ) : null}

                  {item.id === "whatsapp" ? (
                    <details className="mt-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-white">WhatsApp readiness</summary>
                      <ol className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted-2)]">
                        <li><span className="text-white">1.</span> Connect Meta first; WhatsApp assets are verified inside that flow.</li>
                        <li><span className="text-white">2.</span> If the WhatsApp Business asset is not ready, skip onboarding and finish the connection from Profile Settings later.</li>
                        <li><span className="text-white">3.</span> Leadsy will still require human approval before any outreach task is sent.</li>
                      </ol>
                    </details>
                  ) : null}

                  {item.id === "openrouter" ? (
                    <details className="mt-3 rounded-[8px] border border-[var(--line)] bg-black/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-white">AI configuration</summary>
                      <p className="mt-3 text-sm leading-6 text-[var(--muted-2)]">
                        Leadsy already handles OpenRouter provider routing from the configured environment keys. There is no API key to paste during onboarding, and routine worker tasks keep using the cheapest configured models.
                      </p>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-5">
              <div>
                <div className="text-4xl font-semibold text-white">{completionScore}%</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-2)]">Your profile completion score is based on business context and integration readiness.</p>
              </div>
              <ProgressBar value={completionScore} tone={completionScore >= 70 ? "lime" : "amber"} />
              <div className="rounded-[8px] border border-amber-300/25 bg-amber-300/[0.08] p-3 text-sm leading-6 text-amber-50">
                Skipped integrations stay visible in notifications until resolved. Outreach remains human-approved.
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
            <button
              type="button"
              disabled={saving}
              onClick={finishSetup}
              className="inline-flex h-10 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-4 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Finish Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
