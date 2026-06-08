"use client";

import { useState } from "react";
import { Loader2, Send, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/toast-provider";

type InboxReplyComposerProps = {
  leadId?: string;
  to?: string;
  channel: string;
  transportMode?: "twilio" | "simulator";
  senderStatus?: string;
  senderStatusReason?: string;
  senderNumber?: string;
};

function sendBlockedReason(props: InboxReplyComposerProps) {
  if (props.channel !== "WhatsApp") return `${props.channel} replies are not wired to Twilio yet.`;
  if (!props.leadId || !props.to) return "This conversation needs a linked lead with a WhatsApp phone number before replying.";
  if (props.transportMode === "simulator") return "";
  if (props.senderStatus !== "approved") return props.senderStatusReason || "The workspace WhatsApp sender is not approved yet.";
  return "";
}

export function InboxReplyComposer(props: InboxReplyComposerProps) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const blockedReason = sendBlockedReason(props);

  async function sendReply() {
    if (blockedReason || !props.to || !props.leadId || !body.trim()) return;
    setSending(true);
    try {
      const response = await fetch("/api/whatsapp/messages", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId: props.leadId,
          to: props.to,
          body: body.trim()
        })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; deliveryStatus?: string; transportMode?: string };
      if (!response.ok) {
        toast({ title: "Reply was not sent", detail: payload.error || "Check sender status and try again.", tone: "error" });
        return;
      }
      setBody("");
      toast({
        title: payload.transportMode === "simulator" ? "Simulated reply saved" : "Reply queued",
        detail: `Delivery status: ${payload.deliveryStatus || "queued"}.`,
        tone: "success"
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-[6px] border border-border bg-surface-2 p-2.5">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        disabled={Boolean(blockedReason) || sending}
        placeholder={blockedReason || `Reply on ${props.channel}...`}
        className="h-20 w-full resize-none rounded-[5px] border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <ShieldAlert className="h-3 w-3" />
          <span className="truncate font-mono text-[10.5px]">
            {props.transportMode === "simulator"
              ? "Simulation mode: no external WhatsApp delivery"
              : props.senderNumber
                ? `Sending from ${props.senderNumber}`
                : props.senderStatus
                  ? `Sender status: ${props.senderStatus}`
                  : "Sender status pending"}
          </span>
        </div>
        <button
          type="button"
          disabled={Boolean(blockedReason) || !body.trim() || sending}
          onClick={sendReply}
          className="inline-flex h-7 items-center gap-1.5 rounded-[5px] bg-primary px-2.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Send
        </button>
      </div>
    </div>
  );
}
