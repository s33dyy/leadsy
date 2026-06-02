"use client";

import { useState } from "react";
import { Building2, CheckCircle2, Clipboard, KeyRound, Loader2, Plus, RefreshCw } from "lucide-react";
import { formatInr, type AgencyClient } from "@leadsy/domain";
import { Badge, EmptyState, ProgressBar } from "./ui";

type ClientWorkspaceManagerProps = {
  initialClients: AgencyClient[];
};

type FormState = {
  name: string;
  city: string;
  businessType: string;
};

const emptyForm: FormState = {
  name: "",
  city: "",
  businessType: ""
};

export function ClientWorkspaceManager({ initialClients }: ClientWorkspaceManagerProps) {
  const [clients, setClients] = useState(initialClients);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [regeneratingClientId, setRegeneratingClientId] = useState("");
  const [copiedClientId, setCopiedClientId] = useState("");
  const [error, setError] = useState("");

  async function createClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setLoading(false);
      setError("Could not create client. Check all fields and try again.");
      return;
    }

    const payload = (await response.json()) as { client: AgencyClient };
    setClients((current) => [...current, payload.client]);
    setForm(emptyForm);
    setLoading(false);
  }

  async function regenerateInvite(clientId: string) {
    setRegeneratingClientId(clientId);
    setError("");

    const response = await fetch(`/api/clients/${encodeURIComponent(clientId)}/invite`, {
      method: "POST"
    });

    if (!response.ok) {
      setRegeneratingClientId("");
      setError(response.status === 409 ? "Registered clients cannot receive a new invite code." : "Could not regenerate invite.");
      return;
    }

    const payload = (await response.json()) as { client: AgencyClient };
    setClients((current) => current.map((client) => (client.id === payload.client.id ? payload.client : client)));
    setRegeneratingClientId("");
  }

  async function copyInvite(clientId: string, inviteCode?: string) {
    if (!inviteCode) {
      return;
    }

    await navigator.clipboard.writeText(inviteCode);
    setCopiedClientId(clientId);
    window.setTimeout(() => setCopiedClientId(""), 1400);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
      <form onSubmit={createClient} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Plus size={17} className="text-[var(--teal)]" />
          Add client workspace
        </div>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">Client name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              minLength={2}
              placeholder="Vibhoar Das"
              className="mt-2 h-10 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
            />
          </label>
          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">City</span>
            <input
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              required
              minLength={2}
              placeholder="Barasat"
              className="mt-2 h-10 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
            />
          </label>
          <label className="block">
            <span className="mono text-[10px] uppercase text-[var(--muted)]">Business type</span>
            <input
              value={form.businessType}
              onChange={(event) => setForm((current) => ({ ...current, businessType: event.target.value }))}
              required
              minLength={2}
              placeholder="Content Marketing"
              className="mt-2 h-10 w-full rounded-[6px] border border-[var(--line)] bg-white/[0.04] px-3 text-sm text-white placeholder:text-[var(--muted)]"
            />
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[6px] border border-teal-300/30 bg-teal-300/[0.12] text-sm font-medium text-teal-100 hover:bg-teal-300/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
          Create client
        </button>
      </form>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Client workspaces</div>
          <Badge tone="teal">{clients.length} workspaces</Badge>
        </div>
        {clients.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((client) => (
              <article key={client.id} className="rounded-[8px] border border-[var(--line)] bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-teal-300/10 text-teal-100">
                    <Building2 size={18} />
                  </div>
                  <Badge tone={client.status === "healthy" ? "teal" : client.status === "watch" ? "amber" : "rose"}>
                    {client.status}
                  </Badge>
                </div>
                <div className="mt-5 text-lg font-semibold text-white">{client.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  {client.businessType ?? client.vertical} · {client.city} · {client.plan}
                </div>
                <div className="mt-4 rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="mono text-[10px] uppercase text-[var(--muted)]">Target leads</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--muted-2)]">
                    {client.targetAudience ?? "Client has not completed targeting yet."}
                  </div>
                </div>
                <div className="mt-4 rounded-[6px] border border-[var(--line)] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">Client login</div>
                    <Badge tone={client.clientRegisteredAt ? "teal" : "amber"}>
                      {client.clientRegisteredAt ? "registered" : "invite"}
                    </Badge>
                  </div>
                  {client.clientRegisteredAt ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-teal-100">
                      <CheckCircle2 size={16} />
                      Client can log in with phone/email and password.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-[6px] border border-amber-300/25 bg-amber-300/10 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <KeyRound size={15} className="text-amber-100" />
                          <span className="mono text-sm font-semibold tracking-[0.08em] text-amber-100">
                            {client.inviteCode ?? "GENERATING"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyInvite(client.id, client.inviteCode)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-amber-300/20 bg-black/20 text-amber-100 hover:bg-amber-300/10"
                          aria-label="Copy invite code"
                          title="Copy invite code"
                        >
                          <Clipboard size={14} />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <a
                          href="/client/register"
                          className="inline-flex h-9 items-center justify-center rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-sm text-[var(--muted-2)] hover:text-white"
                        >
                          Registration page
                        </a>
                        <button
                          type="button"
                          onClick={() => regenerateInvite(client.id)}
                          disabled={regeneratingClientId === client.id}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-[6px] border border-[var(--line)] bg-white/[0.03] px-3 text-sm text-[var(--muted-2)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {regeneratingClientId === client.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          Regenerate
                        </button>
                      </div>
                      {copiedClientId === client.id ? <div className="mt-2 text-xs text-teal-200">Invite copied.</div> : null}
                    </>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div>
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">Spend</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatInr(client.monthlyAdSpend)}</div>
                  </div>
                  <div>
                    <div className="mono text-[10px] uppercase text-[var(--muted)]">CPL</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatInr(client.costPerLead)}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                    <span>Qualified</span>
                    <span>{client.qualificationRate}%</span>
                  </div>
                  <ProgressBar value={client.qualificationRate} tone="teal" />
                </div>
                <div className="mt-3">
                  <div className="mb-2 flex justify-between text-xs text-[var(--muted-2)]">
                    <span>Booking</span>
                    <span>{client.bookingRate}%</span>
                  </div>
                  <ProgressBar value={client.bookingRate * 5} tone="lime" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            detail="Create the first real client workspace using the form on this page."
          />
        )}
      </div>
    </div>
  );
}
