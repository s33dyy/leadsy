"use client";

import { useState } from "react";
import { KeyRound, Loader2, UserPlus } from "lucide-react";

type FormState = {
  inviteCode: string;
  name: string;
  emailOrPhone: string;
  password: string;
};

const emptyForm: FormState = {
  inviteCode: "",
  name: "",
  emailOrPhone: "",
  password: ""
};

export function ClientRegistrationForm() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/client/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setLoading(false);
      if (response.status === 404) {
        setError("Invite code not found. Check the code from your agency owner.");
      } else if (response.status === 409) {
        setError("This invite is already used, or this phone/email already has an account.");
      } else {
        setError("Could not create client login. Please try again.");
      }
      return;
    }

    const payload = (await response.json()) as { redirectTo: string };
    window.location.assign(payload.redirectTo);
  }

  return (
    <form action="/api/client/register/form" method="post" onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <KeyRound size={17} className="text-[var(--teal)]" />
        Register client access
      </div>

      <label className="block">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">Invite code</span>
        <input
          value={form.inviteCode}
          name="inviteCode"
          onChange={(event) => setForm((current) => ({ ...current, inviteCode: event.target.value.toUpperCase() }))}
          required
          minLength={6}
          autoComplete="one-time-code"
          className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm uppercase tracking-[0.08em] text-white placeholder:tracking-normal placeholder:text-[var(--muted)]"
          placeholder="VIBH-7K2Q"
        />
      </label>

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
          placeholder="Vibhoar Das"
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
          placeholder="+91..."
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
        {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
        Create client login
      </button>
    </form>
  );
}
