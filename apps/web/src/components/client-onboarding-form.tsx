"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Target } from "lucide-react";
import type { AgencyClient } from "@leadsy/domain";
import { Badge, EmptyState } from "./ui";

type ClientOnboardingFormProps = {
  client: AgencyClient | null;
};

type FormState = {
  targetAudience: string;
  primaryOffer: string;
  leadLocation: string;
  monthlyLeadGoal: string;
};

export function ClientOnboardingForm({ client }: ClientOnboardingFormProps) {
  const [form, setForm] = useState<FormState>({
    targetAudience: client?.targetAudience ?? "",
    primaryOffer: client?.primaryOffer ?? "",
    leadLocation: client?.leadLocation ?? client?.city ?? "",
    monthlyLeadGoal: client?.monthlyLeadGoal ? String(client.monthlyLeadGoal) : "30"
  });
  const [savedClient, setSavedClient] = useState(client);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!client) {
    return (
      <EmptyState
        icon={Target}
        title="Client not found"
        detail="Your login is valid, but the client workspace could not be found. Ask the agency owner to check the workspace."
      />
    );
  }

  const activeClient = client;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch(`/api/clients/${encodeURIComponent(activeClient.id)}/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        monthlyLeadGoal: Number(form.monthlyLeadGoal)
      })
    });

    if (!response.ok) {
      setLoading(false);
      setError("Could not save onboarding. Please check the fields.");
      return;
    }

    const payload = (await response.json()) as { client: AgencyClient };
    setSavedClient(payload.client);
    setLoading(false);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
      <form onSubmit={submit} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Target size={17} className="text-[var(--teal)]" />
          Lead targeting
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">Who should we find as leads?</span>
            <textarea
              value={form.targetAudience}
              onChange={(event) => setForm((current) => ({ ...current, targetAudience: event.target.value }))}
              required
              minLength={5}
              rows={4}
              placeholder="Local businesses in Barasat that need Instagram reels, content strategy, and social media marketing"
              className="mt-2 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 py-3 text-sm text-white placeholder:text-[var(--muted)]"
            />
          </label>

          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">What service should we sell first?</span>
            <input
              value={form.primaryOffer}
              onChange={(event) => setForm((current) => ({ ...current, primaryOffer: event.target.value }))}
              required
              minLength={3}
              placeholder="Monthly content marketing package"
              className="mt-2 h-10 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mono text-[10px] uppercase text-[var(--muted)]">Lead location</span>
              <input
                value={form.leadLocation}
                onChange={(event) => setForm((current) => ({ ...current, leadLocation: event.target.value }))}
                required
                minLength={2}
                placeholder="Barasat"
                className="mt-2 h-10 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
              />
            </label>

            <label className="block">
              <span className="mono text-[10px] uppercase text-[var(--muted)]">Monthly lead goal</span>
              <input
                value={form.monthlyLeadGoal}
                onChange={(event) => setForm((current) => ({ ...current, monthlyLeadGoal: event.target.value }))}
                required
                min={1}
                max={100000}
                type="number"
                className="mt-2 h-10 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
              />
            </label>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Save targeting
        </button>
      </form>

      <div className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold text-white">{activeClient.name}</div>
            <div className="mt-1 text-sm text-[var(--muted-2)]">
              {activeClient.businessType ?? activeClient.vertical} · {activeClient.city}
            </div>
          </div>
          <Badge tone={savedClient?.onboardingCompletedAt ? "teal" : "amber"}>
            {savedClient?.onboardingCompletedAt ? "complete" : "pending"}
          </Badge>
        </div>

        <div className="mt-5 space-y-3">
          {[
            ["Target leads", savedClient?.targetAudience ?? "Not set"],
            ["Primary offer", savedClient?.primaryOffer ?? "Not set"],
            ["Lead location", savedClient?.leadLocation ?? activeClient.city],
            ["Monthly goal", savedClient?.monthlyLeadGoal ? `${savedClient.monthlyLeadGoal} leads` : "Not set"]
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
              <div className="mono text-[10px] uppercase text-[var(--muted)]">{label}</div>
              <div className="mt-2 text-sm leading-6 text-white">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
