# Inbox Stabilization Report — Phase 4.5

Scope: `/app/communications` must preview real customer communication only. No system-event previews, no worker-task previews, and no duplicated previews.

## Rules Enforced

- No duplicate messages.
- No duplicated previews.
- No system-event previews.
- No worker-task previews.
- Inbox lead links must point back to the existing Lead Detail Workspace.
- Inbox previews must come from stored customer message records.

## Implementation

Added `apps/web/src/lib/inbox-stabilization.ts`.

`buildLeadBackedInboxItems(leads)` now:

- consumes `conversationMessages(lead.messages)` only
- dedupes visible messages by message ID
- sorts messages by `sentAt` and ID
- derives preview from the latest customer conversation message
- derives unread state from real lead CRM status
- links back to `/app/leads?contact=<leadId>&tab=comms`

Updated `/app/communications` to use this helper instead of inline mapping over `lead.messages`.

## Message Ordering

Lead-backed inbox items use sorted conversation messages:

1. `sentAt` ascending
2. message ID as deterministic tie-breaker
3. inbox item sort uses lead CRM urgency, then latest message timestamp

## Lead Linking

Every lead-backed inbox item includes:

- `leadId`
- `href: /app/leads?contact=<leadId>&tab=comms`

This preserves the existing Lead Detail Workspace as the source of truth.

## Deduplication

Duplicate visible messages are removed by message ID inside `dedupeMessages` before preview and message-list generation.

Duplicate webhook deliveries are covered by `scripts/crm-truth-stabilization.test.ts`.

## Needs Reply Logic

Existing logic is preserved:

- `crmStatus === "needs_reply"` => unread count 1 and high urgency
- `crmStatus === "human_review"` => important flag

No new assignment, follow-up automation, or autonomous reply behavior was added.

## Unread Logic

Unread state is still derived from existing CRM status, not from fabricated counts.

## Stabilization Test Evidence

`scripts/crm-truth-stabilization.test.ts` verifies:

- inbound WhatsApp customer message appears in Inbox
- system/worker event does not appear in Inbox preview or message list
- duplicate webhook deliveries produce one visible customer preview/message

## Remaining Notes

- Non-lead WhatsApp and browser extension inbox items still come from their existing stores. Phase 4.5 did not migrate or rewrite those stores.
- The stabilized lead-backed inbox path is now the canonical CRM truth path for lead-linked communications.
