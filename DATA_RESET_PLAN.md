# DATA RESET PLAN

Generated for the Twilio CRM transformation on 2026-06-06.

## Status

Reset has **not** been executed.

A pre-reset snapshot was exported successfully:

`backups/pre-twilio-reset/pre-twilio-reset-2026-06-06T12-11-57-358Z-6c908f1e`

The `backups/` directory is ignored by git so local customer/session data is not committed.

## Current Stores

| Store | Current counts | Classification | Reset behavior |
| --- | ---: | --- | --- |
| `data/app/auth.json` | 3 users, 44 sessions | MUST PRESERVE | Back up only. Keep users and sessions. |
| `data/app/lead-knowledge.json` | 30 leads, 37 conversations, 48 messages | SAFE TO DELETE AFTER BACKUP | Clear lead records, conversations, messages, and historical qualification fields. |
| `data/app/extension.json` | 5 tokens, 39 tasks, 45 task events | MIXED | Preserve tokens. Clear captured conversations, messages, events, approvals, tasks, and task events. |
| `data/app/lead-magnet.json` | 2 briefs, 39 brief history records, 92 generated leads, 84 runs, 2 drafts, 168 agent runs, 6 search sessions | MIXED | Preserve briefs, brief history, and owner search memory. Clear generated leads, runs, drafts, agent runs, and search sessions. |
| `data/app/lead-crm.json` | 0 assignment rules, 0 follow-up tasks, 0 qualification profiles; file currently absent locally | MIXED | Preserve qualification profiles if present. Clear assignment rules and follow-up tasks. |
| `data/app/agency-clients.json` | 1 record | MUST PRESERVE | Back up only. Keep agency/client configuration. |
| `data/postgres/` | Local Postgres data directory | MUST PRESERVE | Not modified by the JSON CRM reset. Use a separate `pg_dump`/restore plan before any database reset. |
| `data/redis/` | Local Redis data directory | MUST PRESERVE | Not modified by the JSON CRM reset. Use a separate Redis dump plan before any Redis reset. |
| `.env.local` | Local secrets/config | MUST PRESERVE | Not backed up or committed. Never print secrets. |

## Lead Records

SAFE TO DELETE AFTER BACKUP:

- Legacy lead knowledge records in `data/app/lead-knowledge.json`.
- Generated lead magnet leads in `data/app/lead-magnet.json`.
- Stale assignment rules and follow-up tasks in `data/app/lead-crm.json`.

MUST PRESERVE:

- Authentication users and sessions.
- Agency/client configuration.
- Business briefs and owner search memory.
- Twilio, Meta, Railway, and app secrets in env only.

## Conversations And Messages

SAFE TO DELETE AFTER BACKUP:

- Lead knowledge conversations.
- Lead knowledge messages.
- Extension captured conversations.
- Extension captured messages.
- Extension sync/monitor events.

Rule after reset:

Leadsy should start with no legacy test conversations, no demo leads, no fake qualification history, and no stale extension records.

## Extension Data

MUST PRESERVE:

- Extension pairing tokens in `extension.json`.
- Extension APIs and extension package code.

SAFE TO DELETE AFTER BACKUP:

- Extension captured conversations.
- Extension captured messages.
- Extension monitor/sync events.
- Extension worker tasks.
- Extension task events and approval-state task records.

Product positioning after reset:

The extension becomes the **Legacy Capture Layer** and is no longer the primary product surface.

## Approvals And Tasks

SAFE TO DELETE AFTER BACKUP:

- Extension tasks with approval states such as `draft`, `awaiting_approval`, or `awaiting_send_approval`.
- Extension task event history.
- CRM follow-up tasks.

MUST PRESERVE:

- Human approval guardrail as a product rule.
- Users, roles, and future task ownership configuration.

## Backup Commands

Create a fresh snapshot:

```bash
npm run data:backup:pre-twilio-reset
```

This command writes JSON store copies and a manifest to:

`backups/pre-twilio-reset/<generated-run-id>/`

## Reset Command

The reset command creates a fresh backup first, then resets only after explicit confirmation:

```bash
CONFIRM_RESET=RESET_TWILIO_CRM npm run data:reset:twilio-crm
```

The command clears CRM lead/conversation/message/task history and preserves authentication, extension tokens, lead magnet briefs, owner search memory, qualification profile configuration, and agency/client configuration.

## Validation

Focused reset regression:

```bash
npm run test:pre-twilio-reset
```

Full project verification remains:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```
