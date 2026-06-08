"use client";

import { useState } from "react";
import { Bot, Loader2, Radio, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui";
import type { TeamMember, TeamMemberType } from "@/lib/teamspace-store";

type TeamspaceConsoleProps = {
  initialMembers: TeamMember[];
  pipelineStageOptions: string[];
};

const memberTypeLabels: Record<TeamMemberType, string> = {
  human: "Human team member",
  ai_agent_full: "Full AI agent",
  ai_agent_assisted: "User-handled AI agent"
};

function badgeToneForMember(member: TeamMember) {
  if (member.type === "human") return "neutral" as const;
  return member.autoReplyEnabled ? "teal" as const : "amber" as const;
}

function defaultStagesForType(type: TeamMemberType, options: string[]) {
  const preferred = type === "ai_agent_full" ? ["new", "collecting"] : ["qualified"];
  const selected = preferred.filter((stage) => options.includes(stage));
  return selected.length ? selected : options.slice(0, 1);
}

export function TeamspaceConsole({ initialMembers, pipelineStageOptions }: TeamspaceConsoleProps) {
  const stageOptions = pipelineStageOptions.length ? pipelineStageOptions : ["new", "collecting", "qualified", "meeting", "won"];
  const [members, setMembers] = useState(initialMembers);
  const [type, setType] = useState<TeamMemberType>("ai_agent_full");
  const [name, setName] = useState("Qualification AI");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [selectedPipelineStages, setSelectedPipelineStages] = useState<string[]>(defaultStagesForType("ai_agent_full", stageOptions));
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [notice, setNotice] = useState("");
  const [credentialsNotice, setCredentialsNotice] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  async function refreshMembers() {
    const response = await fetch("/api/team/members", { credentials: "include" });
    const payload = (await response.json().catch(() => ({}))) as { members?: TeamMember[] };
    if (response.ok && payload.members) setMembers(payload.members);
  }

  function toggleStage(stage: string) {
    setSelectedPipelineStages((current) => {
      if (current.includes(stage)) return current.filter((candidate) => candidate !== stage);
      return [...current, stage];
    });
  }

  async function createMember() {
    setPendingAction("create");
    setNotice("");
    setCredentialsNotice("");
    try {
      const response = await fetch("/api/team/members", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          emailOrPhone: emailOrPhone || undefined,
          pipelineStages: selectedPipelineStages,
          autoReplyEnabled: type !== "human" ? autoReplyEnabled : false,
          escalationKeywords: ["human", "manager", "refund", "legal", "stop"],
          behaviorInstructions: type === "human" ? undefined : "Qualify early-stage leads, keep replies concise, and stop after handoff."
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; member?: TeamMember; credentials?: { login: string; temporaryPassword: string } };
      if (!response.ok || !payload.member) {
        setNotice(payload.error || "Could not create team member.");
        return;
      }
      setMembers((current) => [...current, payload.member!]);
      setNotice(`${payload.member.name} added to Teamspace with ${payload.member.senderMode === "workspace" ? "the workspace sender" : payload.member.simulatorPhoneNumber ?? "a simulator sender"}.`);
      if (payload.credentials) {
        setCredentialsNotice(`Login: ${payload.credentials.login} · Temporary password: ${payload.credentials.temporaryPassword}`);
      }
    } finally {
      setPendingAction("");
    }
  }

  async function toggleAutoReply(member: TeamMember) {
    setPendingAction(member.id);
    setNotice("");
    try {
      const response = await fetch(`/api/team/members/${member.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ autoReplyEnabled: !member.autoReplyEnabled })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; member?: TeamMember };
      if (!response.ok || !payload.member) {
        setNotice(payload.error || "Could not update auto-reply.");
        return;
      }
      setMembers((current) => current.map((candidate) => (candidate.id === payload.member!.id ? payload.member! : candidate)));
      setNotice(`${payload.member.name} auto-reply is ${payload.member.autoReplyEnabled ? "on" : "off"}.`);
    } finally {
      setPendingAction("");
    }
  }

  async function provisionSender(member: TeamMember) {
    setPendingAction(`sender:${member.id}`);
    setNotice("");
    try {
      const response = await fetch(`/api/team/members/${member.id}/provision-sender`, {
        method: "POST",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error || "Could not repair sender.");
        return;
      }
      await refreshMembers();
      setNotice(`${member.name} sender identity repaired.`);
    } finally {
      setPendingAction("");
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-[8px] border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserPlus className="h-4 w-4 text-primary" />
          Create team member
        </div>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="caption">Member type</span>
            <select
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as TeamMemberType;
                setType(nextType);
                setName(nextType === "human" ? "Sales Owner" : nextType === "ai_agent_assisted" ? "Assisted Sales AI" : "Qualification AI");
                setAutoReplyEnabled(nextType === "ai_agent_full");
                setSelectedPipelineStages(defaultStagesForType(nextType, stageOptions));
              }}
              className="h-10 rounded-[6px] border border-border bg-background px-3 outline-none focus:border-primary"
            >
              {Object.entries(memberTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="caption">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 rounded-[6px] border border-border bg-background px-3 outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="caption">Email or phone</span>
            <input
              value={emailOrPhone}
              onChange={(event) => setEmailOrPhone(event.target.value)}
              placeholder={type === "human" ? "sales@company.com" : "optional"}
              className="h-10 rounded-[6px] border border-border bg-background px-3 outline-none focus:border-primary"
            />
          </label>
          <div className="grid gap-1.5 text-sm">
            <span className="caption">Pipeline stages</span>
            <div className="flex flex-wrap gap-2 rounded-[8px] border border-border bg-background p-2">
              {stageOptions.map((stage) => {
                const active = selectedPipelineStages.includes(stage);
                return (
                  <button
                    key={stage}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleStage(stage)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      active ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>
          </div>
          {type !== "human" ? (
            <label className="flex items-center justify-between gap-3 rounded-[8px] border border-border bg-background p-3 text-sm">
              <span>Auto replies</span>
              <input type="checkbox" checked={autoReplyEnabled} onChange={(event) => setAutoReplyEnabled(event.target.checked)} />
            </label>
          ) : null}
          <button
            type="button"
            onClick={createMember}
            disabled={pendingAction === "create"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pendingAction === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add member
          </button>
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          {credentialsNotice ? <p className="rounded-[6px] border border-primary/25 bg-primary/10 p-2 font-mono text-xs text-primary">{credentialsNotice}</p> : null}
        </div>
      </section>

      <section className="rounded-[8px] border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          Teamspace members
        </div>
        <div className="mt-4 grid gap-3">
          {members.length ? (
            members.map((member) => (
              <div key={member.id} className="rounded-[8px] border border-border bg-background/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{member.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{memberTypeLabels[member.type]} · {member.role}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={badgeToneForMember(member)}>{member.autoReplyEnabled ? "auto-reply on" : "auto-reply off"}</Badge>
                    <Badge tone={member.senderMode === "workspace" || member.senderMode === "simulator" ? "teal" : "neutral"}>
                      {member.senderMode === "workspace" ? "workspace sender" : member.senderMode === "simulator" ? "simulator sender" : "no sender"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {member.senderMode === "workspace"
                    ? member.workspaceSenderLabel || "Account owner WhatsApp"
                    : member.simulatorPhoneNumber
                      ? `${member.simulatorPhoneNumber} · ${member.simulatorSenderHandle}`
                      : "No sender identity"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {member.pipelineStages.map((stage) => (
                    <span key={stage} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                      {stage}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {member.type !== "human" ? (
                    <button
                      type="button"
                      onClick={() => toggleAutoReply(member)}
                      disabled={pendingAction === member.id}
                      className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border px-3 text-sm text-foreground disabled:opacity-60"
                    >
                      {pendingAction === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                      Toggle auto-reply
                    </button>
                  ) : null}
                  {member.senderMode === "none" ? (
                    <button
                      type="button"
                      onClick={() => provisionSender(member)}
                      disabled={pendingAction === `sender:${member.id}`}
                      className="inline-flex h-9 items-center gap-2 rounded-[6px] border border-border px-3 text-sm text-foreground disabled:opacity-60"
                    >
                      {pendingAction === `sender:${member.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                      Repair sender
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[8px] border border-border bg-background/50 p-4 text-sm text-muted-foreground">
              No team members yet. Create a qualification AI and a sales owner to activate routing.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
