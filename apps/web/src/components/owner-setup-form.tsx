"use client";

import { useState } from "react";
import { Building2, Loader2, ShieldCheck } from "lucide-react";

type FormState = {
  name: string;
  emailOrPhone: string;
  password: string;
};

const emptyForm: FormState = {
  name: "",
  emailOrPhone: "",
  password: ""
};

export function OwnerSetupForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setLoading(false);
      setError(response.status === 409 ? "Owner account already exists. Please log in." : "Could not create owner account.");
      return;
    }

    const payload = (await response.json()) as { redirectTo: string };
    window.location.assign(payload.redirectTo);
  }

  return (
    <form action="/api/auth/setup/form" method="post" onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck size={17} className="text-[var(--teal)]" />
        Create agency owner
      </div>

      <label className="block">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">Your name</span>
        <input
          value={form.name}
          name="name"
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
          minLength={2}
          autoComplete="name"
          className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
          placeholder="Pratik Choudhuri"
        />
      </label>

      <label className="block">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">Phone or email</span>
        <input
          value={form.emailOrPhone}
          name="emailOrPhone"
          onChange={(event) => setForm((current) => ({ ...current, emailOrPhone: event.target.value }))}
          required
          minLength={5}
          autoComplete="username"
          className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
          placeholder="owner@example.com"
        />
      </label>

      <label className="block">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">Password</span>
        <input
          value={form.password}
          name="password"
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
          placeholder="Minimum 8 characters"
        />
      </label>

      {error ? <p className="text-sm text-rose-200">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
        Create owner account
      </button>
    </form>
  );
}
