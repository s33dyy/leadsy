"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, LogIn, Mail, UserPlus } from "lucide-react";

export type AuthMode = "login" | "signup" | "forgot";

type LoginFormProps = {
  nextPath?: string;
  initialMode?: AuthMode;
};

type FieldErrors = {
  emailOrPhone?: string;
  password?: string;
  recoveryEmail?: string;
};

export function LoginForm({ nextPath, initialMode = "login" }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const googleHref = `/api/auth/google${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;

  const tabClass = useMemo(
    () => (active: boolean) =>
      `h-10 flex-1 rounded-[6px] border text-sm font-medium ${
        active
          ? "border-teal-300/35 bg-teal-300/[0.12] text-teal-100"
          : "border-transparent bg-white/[0.03] text-[var(--muted-2)] hover:border-[var(--line)] hover:text-white"
      }`,
    []
  );

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setFieldErrors({});
  }

  function validateLogin() {
    const nextErrors: FieldErrors = {};
    if (emailOrPhone.trim().length < 5) {
      nextErrors.emailOrPhone = "Enter a phone or email with at least 5 characters.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateRecovery() {
    const nextErrors: FieldErrors = {};
    if (recoveryEmail.trim().length < 5 || !recoveryEmail.includes("@")) {
      nextErrors.recoveryEmail = "Enter the email connected to your Leadsy workspace.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    setNotice("");
    setError("");

    if (mode === "forgot") {
      event.preventDefault();
      if (!validateRecovery()) return;
      setNotice("Password reset is not automated yet. Use Google sign-in or ask your workspace owner to issue a new password.");
      return;
    }

    if (!validateLogin()) {
      event.preventDefault();
      return;
    }

    setLoading(true);
  }

  if (mode === "signup") {
    return (
      <div className="space-y-4">
        <div className="flex rounded-[8px] border border-[var(--line)] bg-black/20 p-1">
          <button type="button" data-testid="auth-tab-login" className={tabClass(false)} onClick={() => selectMode("login")}>
            Log in
          </button>
          <button type="button" data-testid="auth-tab-signup" className={tabClass(true)} onClick={() => selectMode("signup")}>
            Sign up
          </button>
        </div>

        <Link
          href={googleHref}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
        >
          <UserPlus size={16} />
          Create workspace with Google
        </Link>

        <div className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--muted-2)]">
          Google signup uses the existing Leadsy auth flow, verifies your email, and creates or opens your workspace without adding another password surface.
        </div>

        <button
          type="button"
          onClick={() => selectMode("login")}
          className="inline-flex w-full items-center justify-center gap-2 text-sm text-[var(--muted-2)] hover:text-white"
        >
          <ArrowLeft size={14} />
          I already have a password
        </button>
      </div>
    );
  }

  return (
    <form action="/api/auth/login/form" method="post" onSubmit={submit} noValidate className="space-y-4">
      <input type="hidden" name="next" value={nextPath ?? ""} />
      <div className="flex rounded-[8px] border border-[var(--line)] bg-black/20 p-1">
        <button type="button" data-testid="auth-tab-login" className={tabClass(mode === "login")} onClick={() => selectMode("login")}>
          Log in
        </button>
        <button type="button" data-testid="auth-tab-signup" className={tabClass(false)} onClick={() => selectMode("signup")}>
          Sign up
        </button>
      </div>

      {mode === "forgot" ? (
        <>
          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">Workspace email</span>
            <input
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.recoveryEmail)}
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
              placeholder="vibhor@example.com"
            />
            {fieldErrors.recoveryEmail ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.recoveryEmail}</span> : null}
          </label>

          {notice ? <p className="rounded-[6px] border border-teal-300/25 bg-teal-300/10 px-3 py-2 text-sm text-teal-100">{notice}</p> : null}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
          >
            <Mail size={16} />
            Get recovery guidance
          </button>

          <button type="button" onClick={() => selectMode("login")} className="inline-flex w-full items-center justify-center gap-2 text-sm text-[var(--muted-2)] hover:text-white">
            <ArrowLeft size={14} />
            Back to login
          </button>
        </>
      ) : (
        <>
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
              aria-invalid={Boolean(fieldErrors.emailOrPhone)}
              minLength={5}
              autoComplete="username"
              className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
              placeholder="vibhor@example.com"
            />
            {fieldErrors.emailOrPhone ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.emailOrPhone}</span> : null}
          </label>

          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">Password</span>
            <input
              value={password}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              type="password"
              autoComplete="current-password"
              className="mt-2 h-11 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
              placeholder="Your password"
            />
            {fieldErrors.password ? <span className="mt-2 block text-xs text-rose-200">{fieldErrors.password}</span> : null}
          </label>

          {error ? <p className="rounded-[6px] border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? "Checking..." : "Log in"}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-[var(--muted-2)]">
            <Link href="/forgot-password" className="hover:text-white" onClick={() => selectMode("forgot")}>
              Forgot password?
            </Link>
          </div>
        </>
      )}
    </form>
  );
}
