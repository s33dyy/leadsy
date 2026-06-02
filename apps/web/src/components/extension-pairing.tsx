"use client";

import { useState } from "react";
import { CheckCircle2, Clipboard, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { Badge, EmptyState } from "./ui";

type TokenRecord = {
  id: string;
  label: string;
  tokenPreview: string;
  createdAt: string;
  lastUsedAt?: string;
};

export function ExtensionPairing({ initialTokens }: { initialTokens: TokenRecord[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("Chrome worker");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function createToken() {
    setLoading(true);
    setNotice("");
    const response = await fetch("/api/extension/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label })
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setNotice(payload.message ?? payload.error ?? "Could not create token.");
      return;
    }
    setToken(payload.token);
    setTokens((current) => [payload.record, ...current]);
    setNotice("Token created. Add it in the extension side panel.");
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setNotice("Token copied.");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
      <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound size={17} className="text-[var(--teal)]" />
          Extension pairing
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2 text-xs uppercase text-[var(--muted)]">
            Worker label
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="h-10 rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm normal-case text-white outline-none focus:border-teal-300/45"
            />
          </label>
          <button
            type="button"
            onClick={createToken}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] px-3 text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Create worker token
          </button>
          {token ? (
            <div className="rounded-[8px] border border-teal-300/25 bg-teal-300/[0.08] p-3">
              <div className="mono break-all text-xs leading-6 text-teal-50">{token}</div>
              <button
                type="button"
                onClick={copyToken}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-[6px] border border-teal-300/30 bg-black/20 px-3 text-xs text-teal-100"
              >
                <Clipboard size={14} />
                Copy
              </button>
            </div>
          ) : null}
          {notice ? <p className="text-sm leading-6 text-[var(--muted-2)]">{notice}</p> : null}
        </div>
      </section>

      <section className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Paired workers</div>
          <Badge tone="teal">{tokens.length} active</Badge>
        </div>
        {tokens.length ? (
          <div className="grid gap-3">
            {tokens.map((item) => (
              <article key={item.id} className="rounded-[8px] border border-[var(--line)] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <CheckCircle2 size={16} className="text-[var(--teal)]" />
                    {item.label}
                  </div>
                  <span className="mono text-xs text-[var(--muted)]">{item.tokenPreview}</span>
                </div>
                <div className="mono mt-2 text-[10px] uppercase text-[var(--muted)]">
                  created {new Date(item.createdAt).toLocaleString("en-IN")}
                  {item.lastUsedAt ? ` · last used ${new Date(item.lastUsedAt).toLocaleString("en-IN")}` : ""}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={KeyRound} title="No paired workers" detail="Create a token, then paste it into the extension side panel." />
        )}
      </section>
    </div>
  );
}
