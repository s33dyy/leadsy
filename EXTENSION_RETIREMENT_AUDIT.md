# Extension Retirement Audit

Date: 2026-06-06
Branch: `audit/extension-retirement-twilio`
Repo: `/Users/pratikchoudhuri/Documents/leadsy`

## Executive Recommendation

Retire the browser extension from Leadsy's primary product path.

Do not delete it immediately. Reclassify it as a legacy capture layer for existing users and stop building new product features around it. The primary Leadsy architecture should move to:

```text
Leadsy
|-- Frontend: simple, fast operating UI
|-- Postgres: single source of truth
|-- Next.js APIs: business logic and policy
|-- Twilio: WhatsApp communication transport
`-- n8n: automation after Leadsy records events
```

This better matches Leadsy's current core promise: turn leads into qualified conversations, assignments, and conversions. The browser extension is useful for opportunistic capture, but it is not the core product.

The ordering matters. Leadsy should not become a thin frontend over n8n. n8n should not own leads, messages, assignments, qualification state, user permissions, or customer history.

## Evidence Reviewed

- `graphify-out/GRAPH_REPORT.md`
- `CURRENT_SYSTEM_AUDIT.md`
- `MESSAGE_LIFECYCLE_AUDIT.md`
- `INBOX_STABILIZATION_REPORT.md`
- `BACKEND_AUDIT.md`
- `AUTOMATION_MIGRATION_PLAN.md`
- `DEVELOPER_AUTOMATION_GUIDE.md`
- `apps/extension/README.md`
- `apps/extension/src/*`
- `apps/extension/tests/*`
- `apps/web/src/app/api/extension/*`
- `apps/web/src/components/extension-pairing.tsx`
- `apps/web/src/components/extension-task-board.tsx`

## Current Extension Footprint

Measured locally:

| Area | Count |
| --- | ---: |
| Extension source files | 21 |
| Extension source lines | 3,711 |
| Extension test files | 16 |
| Extension test lines | 2,316 |
| Web extension API route handlers | 15 |
| Web extension API route lines | 1,022 |
| Web extension UI components | 2 |

The extension is not a small helper. It is a second runtime with its own UI, storage, auth, page automation, tests, build process, and browser-specific failure modes.

## Target Product Stack

The product stack should be:

```text
Twilio
-> Next.js webhook API
-> Postgres write
-> Lead record
-> Inbox
-> Qualification
-> Assignment
```

Then automation starts from stored truth:

```text
Postgres event
-> n8n workflow
-> automation action
-> Next.js API
-> Postgres update
```

Rules:

- Postgres owns truth.
- Next.js APIs own business logic.
- Twilio owns WhatsApp transport only.
- n8n owns orchestration only.
- Frontend renders product workflows, not internal architecture.

Avoid this anti-pattern:

```text
Frontend
-> n8n
-> Twilio
-> database
```

That makes n8n the hidden backend. It will create brittle workflow spaghetti and make debugging harder as Leadsy grows.

## Features Only Provided By Extension

These capabilities currently depend on the browser extension:

| Feature | Current owner | Keep? |
| --- | --- | --- |
| Browser page capture | `apps/extension/src/content/page-scope.ts`, `/api/extension/capture` | Legacy only |
| WhatsApp Web conversation sync | `apps/extension/src/content/automation.ts` | Replace with Twilio |
| Instagram/Messenger/generic chat DOM sync | Extension content scripts | Legacy only |
| Extension task execution in browser tabs | `apps/extension/src/background/task-tabs.ts`, task APIs | Legacy only |
| Side panel worker UX | `apps/extension/src/sidepanel/index.ts` | Legacy only |
| Extension token pairing | `/api/extension/tokens`, `extension-pairing.tsx` | Legacy only |
| Extension copilot/reply decision | `/api/extension/copilot`, `/api/extension/reply` | Likely replace with Inbox AI |
| Client-side OpenRouter fallback | `apps/extension/src/core/openrouter.ts` | Retire from primary product |

The extension's unique value is capture from arbitrary browser surfaces. That value is real, but it is not the same as Leadsy's main lead-to-conversion loop.

## Features Duplicated Or Simplified By Twilio

Twilio replaces the extension for the WhatsApp transport path:

| Product need | Extension path | Twilio path |
| --- | --- | --- |
| Inbound message capture | Scrape WhatsApp Web DOM | Receive webhook payload |
| Message identity | Derived extension message IDs | `MessageSid` |
| Sender identity | Parsed from page state | `From`, `WaId`, `ProfileName` |
| Media and voice notes | Browser DOM/media state | `NumMedia`, `MediaUrl0`, `MediaContentType0` |
| Outbound replies | Browser tab automation | Twilio Messages API |
| Delivery tracking | Extension task events | Twilio status callback |
| Dedupe | Custom extension/store logic | Stable Twilio message SID |
| Browser permissions | Required | Not required |
| Chrome store/developer mode | Required | Not required |

The cleaner event shape is:

```json
{
  "messageId": "SM...",
  "from": "whatsapp:+919999999999",
  "to": "whatsapp:+14155238886",
  "timestamp": "2026-06-06T00:00:00.000Z",
  "body": "I want to book a call",
  "media": []
}
```

This is much easier for a Next.js webhook API to validate, normalize, persist to Postgres, and then attach to Leadsy's existing lead knowledge, inbox, qualification, and assignment flows.

Twilio should not own conversation truth. It should provide event payloads, delivery status, media URLs, and outbound delivery.

## Current Extension Maintenance Cost

The extension carries several forms of maintenance cost:

1. Runtime cost: Chrome Manifest V3 background worker, content scripts, side panel, page scope scripts, browser storage, and tab automation.
2. Product cost: `/extension`, `/app/worker`, extension pairing, extension task board, task queue lifecycle, and worker approval semantics.
3. Data cost: extension store plus lead knowledge store plus conversation selectors.
4. QA cost: extension workspace tests, root extension route/store tests, smoke tests, page fixtures, and browser-specific test fixtures.
5. Support cost: extension install flow, developer-mode loading, private build handling, permissions, browser updates, and user setup support.

The current audits show that extension/system/task records previously needed careful filtering so they would not pollute customer conversation surfaces. `MESSAGE_LIFECYCLE_AUDIT.md` and `INBOX_STABILIZATION_REPORT.md` now enforce customer-message-only selectors, but that stabilization exists because the data plane had mixed record types.

## Current Extension Bug Count

Verified current failing test count: 0 in the focused checks below.

Known historical or documented complexity:

- Worker/system records had to be excluded from conversation timelines, inbox previews, and qualification inputs.
- Duplicate visible messages had to be deduped by message ID.
- Non-lead WhatsApp and browser extension inbox items still come from existing stores.
- Current audits describe extension worker risk around split human approval between app API and selected-batch extension execution.

I am not counting those as current open bugs unless a failing test or unresolved issue exists. They are architectural risk and maintenance drag.

## Current Extension Test Failures

Commands run:

```text
npm --workspace @leadsy/extension test
npm run test:extension-store
npm run test:extension-drafts
npm run test:extension-approval
npm run test:extension-download
npm run test:crm-truth-stabilization
```

Results:

```text
@leadsy/extension: 15 test files passed, 62 tests passed
Root focused scripts: all completed with exit code 0
```

Conclusion: the case for retirement is not "the extension is broken today." The case is "the extension is the wrong center of gravity for the product."

## Migration Impact

### Product Impact

Primary user flow changes from worker/extension operation to Inbox operation:

```text
Lead arrives
-> Leadsy normalizes source
-> Next.js API writes to Postgres
-> Qualification runs
-> Owner or team sees inbox thread
-> AI drafts or suggests next action
-> Human approves where needed
-> Twilio sends WhatsApp message
-> Status callbacks update the same thread
```

### Data Impact

Add or map provider metadata on conversation messages:

```text
provider: twilio
providerMessageId: MessageSid
providerConversationId: From/To pair or Leadsy conversation ID
from: Twilio From
to: Twilio To
waId: WaId
profileName: ProfileName
deliveryStatus: queued | sent | delivered | read | failed
media: MediaUrl and content type references
```

Leadsy should keep using the existing customer-message selectors:

- `conversationMessages(messages)`
- `buildLeadBackedInboxItems(leads)`
- qualification inputs from customer messages only

### API Impact

Recommended new API surfaces:

```text
POST /api/twilio/whatsapp/webhook
POST /api/twilio/whatsapp/status
POST /api/leads/:leadId/messages/draft
POST /api/leads/:leadId/messages/send
```

The Twilio webhook should normalize inbound payloads into Postgres-backed Leadsy records through the same business rules used by Meta WhatsApp webhooks. If local JSON stores remain during transition, the API boundary should still be designed as if Postgres is the canonical target.

### UI Impact

Primary surfaces should become only:

- Dashboard: New, Qualified, Assigned, Needs Reply, Won, Lost
- Leads: lead list and lead detail
- Inbox: WhatsApp, Instagram, Messenger, Email
- Automations: Qualification, Assignment, Follow-Up
- Settings: Twilio, Meta, OpenRouter, n8n, Users

Extension surfaces should move to:

- Legacy settings
- Existing-user support
- Hidden or secondary navigation

Surfaces to remove from the primary product:

- Workers
- Knowledge Center
- Intelligence Hub
- Research Center
- Agent Evaluation
- Worker Status

Those are internal architecture concepts leaking into the customer experience. Customers buy qualified leads, booked appointments, and sales conversations, not worker dashboards.

### N8n Impact

n8n should coordinate workflows after Leadsy stores the event. It should not become the source of truth for leads, messages, tasks, or permissions.

Recommended n8n role:

- receive "message received" or "lead qualified" event after Leadsy ingestion
- trigger qualification refresh
- schedule follow-up reminders
- notify assignment owner
- request draft generation
- call Leadsy APIs to record outcomes

Leadsy remains the system of record.

## Next 100 Development Hours

Recommended priority:

| Feature | Priority |
| --- | ---: |
| Assignment Engine | 10/10 |
| Follow-up Engine | 10/10 |
| Twilio Integration | 9/10 |
| Inbox Completion | 9/10 |
| n8n Automation | 8/10 |
| Analytics | 4/10 |
| Browser Extension | 2/10 |
| Fancy Dashboards | 1/10 |

The product sentence should stay simple:

> Leadsy captures leads, qualifies them, assigns them, tracks conversations, and automates follow-ups.

## Decision Test

If the extension disappeared tomorrow, would Leadsy still deliver its core promise?

Answer: yes, if Leadsy's core promise is:

```text
Lead
-> Conversation
-> Qualification
-> Assignment
-> Conversion
```

Answer: no, if Leadsy's core promise is:

```text
Browser capture from arbitrary websites and social pages
```

The roadmap, audits, and product identity point to the first promise, not the second.

## Recommended Retirement Plan

### Phase 0: Freeze

- Stop adding new extension features.
- Keep extension tests running.
- Preserve existing extension APIs.
- Mark extension as "Legacy Capture" in internal docs.

### Phase 1: Twilio Ingestion

- Add Twilio WhatsApp inbound webhook in Next.js.
- Normalize Twilio payloads through Leadsy business logic.
- Persist inbound message records to Postgres as source of truth.
- Store `MessageSid` as provider message ID.
- Add duplicate delivery test using the same selector contract.

### Phase 2: Twilio Outbound

- Add server-side Twilio send adapter.
- Add status callback handling.
- Move WhatsApp sends out of extension tab automation.
- Keep human approval before sends unless explicitly changed.
- Persist outbound send attempts, provider message IDs, and delivery status before n8n sees follow-up automation state.

### Phase 3: Inbox First

- Make Inbox the primary operating surface.
- Route qualification and assignment from inbox events.
- Ensure all WhatsApp/Twilio records link to leads and conversations.

### Phase 4: Hide Extension

- Move `/extension` and `/app/worker` out of primary navigation.
- Keep token and task APIs for existing users.
- Add a migration notice for extension users.

### Phase 5: Remove Or Archive

Only after Twilio paths are production-proven:

- archive extension package
- remove extension routes from active product nav
- keep migration docs
- delete only when no active customer depends on it

## Stash Status

Requested action: create a stash for extension logic.

Actual repo state before this audit:

- No modified tracked extension files were present.
- Existing untracked planning docs were already in the working tree and were not touched.
- Because there were no extension changes to stash, no meaningful `git stash` entry was created.

Recommended if code retirement begins:

```bash
git stash push -m "legacy extension capture layer before twilio migration" -- apps/extension apps/web/src/app/api/extension apps/web/src/components/extension-pairing.tsx apps/web/src/components/extension-task-board.tsx
```

Run that only after there are actual extension retirement edits to preserve.

## Final Recommendation

Leadsy should become Postgres + Next.js APIs + Inbox + Qualification + Assignment first, with Twilio as the WhatsApp transport and n8n as the automation layer.

Keep the browser extension alive as a legacy capture layer, but stop treating it as the main worker, messaging, or product automation surface. This reduces product complexity, removes browser-state fragility from WhatsApp tracking, and aligns engineering effort with the part of Leadsy that customers actually buy: turning inbound leads into qualified conversations and conversions.
