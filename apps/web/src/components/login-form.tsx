"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, LogIn, UserPlus } from "lucide-react";

type LoginFormProps = {
  nextPath?: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const googleHref = `/api/auth/google${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ emailOrPhone, password, next: nextPath })
    });

    if (!response.ok) {
      setLoading(false);
      if (response.status === 428) {
        setError("Create your workspace with Google first.");
        return;
      }
      setError(response.status === 401 ? "Wrong user ID or password." : "Could not log in. Please try again.");
      return;
    }

    const payload = (await response.json()) as { redirectTo: string };
    window.location.assign(payload.redirectTo);
  }

  return (
    <form action="/api/auth/login/form" method="post" onSubmit={submit} className="space-y-4">
      <input type="hidden" name="next" value={nextPath ?? ""} />
      <Link
        href={googleHref}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.05] text-sm font-medium text-white hover:border-[var(--line-strong)] hover:bg-white/[0.08]"
      >
        <UserPlus size={16} />
        Continue with Google
      </Link>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="mono text-[10px] uppercase text-[var(--muted)]">or password</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>

      <label className="block">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">Phone or email</span>
        <input
          value={emailOrPhone}
          name="emailOrPhone"
          onChange={(event) => setEmailOrPhone(event.target.value)}
          required
          minLength={5}
          autoComplete="username"
          className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
          placeholder="vibhoar@example.com"
        />
      </label>

      <label className="block">
        <span className="mono text-[10px] uppercase text-[var(--muted)]">Password</span>
        <input
          value={password}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          autoComplete="current-password"
          className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
          placeholder="Your password"
        />
      </label>

      {error ? <p className="text-sm text-rose-200">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        Log in
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-[var(--muted-2)]">
        <Link href="/extension" className="hover:text-white">
          Download extension
        </Link>
      </div>
    </form>
  );
}
