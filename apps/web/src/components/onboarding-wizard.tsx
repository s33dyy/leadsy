"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Loader2, Upload } from "lucide-react";
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

function textFromProfile(profile: Record<string, unknown> | undefined, key: string) {
  const value = profile?.[key];
  return typeof value === "string" ? value : "";
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
  const [visible, setVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>({
    fullName: textFromProfile(initialProfile, "fullName") || session.name,
    role: textFromProfile(initialProfile, "role"),
    phone: textFromProfile(initialProfile, "phone"),
    businessName: textFromProfile(initialProfile, "businessName"),
    industry: textFromProfile(initialProfile, "industry"),
    services: textFromProfile(initialProfile, "services"),
    markets: textFromProfile(initialProfile, "markets"),
    website: textFromProfile(initialProfile, "website"),
    targetQuestion0: textFromProfile(initialProfile, "targetQuestion0"),
    targetQuestion1: textFromProfile(initialProfile, "targetQuestion1"),
    targetQuestion2: textFromProfile(initialProfile, "targetQuestion2")
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const requiredKeys = ["fullName", "role", "phone", "businessName", "industry", "services", "markets", "website", "targetQuestion0", "targetQuestion1", "targetQuestion2"];
  const completedFields = requiredKeys.filter((key) => profile[key]?.trim()).length;
  const completionScore = Math.round(((completedFields + (hasMetaConnection ? 1 : 0)) / (requiredKeys.length + 1)) * 100);

  const integrationItems = useMemo(
    () => [
      { label: "Browser Extension", status: "warning", href: "/extension", detail: "Install and pair the extension for browser conversations." },
      { label: "Meta (Facebook/Instagram)", status: hasMetaConnection ? "connected" : "missing", href: "/app/connect", detail: hasMetaConnection ? "Meta authorization is connected." : "Connect Meta messaging from Integrations." },
      { label: "WhatsApp", status: hasMetaConnection ? "connected" : "missing", href: "/app/connect", detail: hasMetaConnection ? "WhatsApp assets can be verified in Integrations." : "Connect or verify WhatsApp assets." },
      { label: "OpenRouter / AI", status: "warning", href: "/app/connect?panel=settings", detail: "Configured by environment; verify before worker runs." }
    ],
    [hasMetaConnection]
  );

  if (!visible) return null;

  function updateField(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }

  function validateStep() {
    const nextErrors: Record<string, string> = {};
    const keysByStep: Record<number, string[]> = {
      0: ["fullName", "role", "phone"],
      1: ["businessName", "industry", "services", "markets", "website"],
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
        body: JSON.stringify({ profile, complete })
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
        setVisible(false);
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
  const textareaClass = "mt-2 min-h-24 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-[var(--muted)]";

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 p-0 backdrop-blur-md md:p-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="mx-auto flex h-full max-w-4xl flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)] shadow-2xl md:rounded-[8px]">
        <div className="border-b border-[var(--line)] p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mono text-[11px] uppercase text-[var(--teal)]">Step {step + 1} of {steps.length}</div>
              <h2 id="onboarding-title" className="mt-2 text-xl font-semibold text-white">{steps[step]}</h2>
            </div>
            <div className="w-40">
              <ProgressBar value={((step + 1) / steps.length) * 100} />
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
                ["services", "Services/products offered"],
                ["markets", "Geography / target markets"],
                ["website", "Business website URL"]
              ].map(([key, label]) => (
                <label key={key} className={key === "services" || key === "markets" ? "block md:col-span-2" : "block"}>
                  <span className="mono text-[10px] uppercase text-[var(--muted)]">{label}</span>
                  {key === "services" || key === "markets" ? (
                    <textarea value={profile[key]} onChange={(event) => updateField(key, event.target.value)} aria-invalid={Boolean(fieldErrors[key])} className={textareaClass} />
                  ) : (
                    <input value={profile[key]} onChange={(event) => updateField(key, event.target.value)} aria-invalid={Boolean(fieldErrors[key])} className={inputClass} />
                  )}
                  {fieldErrors[key] ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors[key]}</span> : null}
                </label>
              ))}
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
                <div key={item.label} className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="flex items-start gap-3">
                    {item.status === "connected" ? <CheckCircle2 size={18} className="text-lime-200" /> : <CircleAlert size={18} className={item.status === "warning" ? "text-amber-200" : "text-rose-200"} />}
                    <div>
                      <div className="text-sm font-medium text-white">{item.label}</div>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted-2)]">{item.detail}</p>
                    </div>
                  </div>
                  <Link href={item.href} className="inline-flex h-9 items-center rounded-[6px] border border-[var(--line)] px-3 text-sm text-[var(--muted-2)] hover:text-white">
                    {item.status === "connected" ? "Review" : "Connect"}
                  </Link>
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
