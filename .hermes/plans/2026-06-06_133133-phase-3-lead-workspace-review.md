# Phase 3 Lead Workspace Implementation Plan

> For Hermes: Do not implement until this plan is reviewed. Use Leadsy rule: PRESERVE > REFACTOR > REPLACE.

Goal: Make the existing Leads and Inbox surfaces satisfy Phase 3: a sales agent can find a lead, read the conversation, understand qualification, know next action, and continue sales within 30 seconds.

Architecture: Extend the existing unified lead knowledge system in `apps/web/src/lib/lead-knowledge-store.ts` and the existing Lead workspace at `apps/web/src/app/app/leads/page.tsx`. Do not create a new lead store, inbox store, status taxonomy, auth flow, DB schema, or n8n workflow. Inbox should become a conversion queue backed by existing LeadKnowledgeRecord data, not a separate messaging app.

Tech Stack: Next.js App Router, React Server Components, TypeScript, Tailwind, existing shadcn/Lovable-style UI primitives, existing JSON-backed stores as current implementation detail.

---

## Product Review

Product Value Score: 9/10
Engineering Cost: 4/10 if we preserve current lead workspace; 8/10 if we rewrite it.
Risk: 5/10 mainly from the large `leads/page.tsx` file and current duplicate inbox item assembly.
Recommendation: Proceed with targeted Phase 3 consolidation. No rewrite.
Priority: Immediate Phase 3.

## Goal

Improve Phase 3 around:
1. Leads Workspace
2. Lead Detail View
3. Conversation Timeline
4. Inbox Foundation

The first implementation should optimize the 15-second Lead Detail test, not add analytics or automation.

## Existing System Impact

Observed existing systems:
- Unified source: `apps/web/src/lib/lead-knowledge-store.ts`
- Lead list/detail/comms/tasks: `apps/web/src/app/app/leads/page.tsx`
- Inbox shell: `apps/web/src/app/app/communications/page.tsx`
- CRM follow-up/assignment helpers: `apps/web/src/lib/crm-store.ts`
- Existing tests: `scripts/lead-knowledge-store.test.ts`, `scripts/user-facing-surface.test.ts`, `scripts/whatsapp-crm-qualification-v1.test.ts`

Do not replace these. Phase 3 should extract/consolidate around them.

## Risks

1. `leads/page.tsx` is already very large. Adding more UI inline will reduce maintainability.
2. `communications/page.tsx` builds inbox items from WhatsApp, extension, and leads separately. This can create duplicate conversation representations.
3. Lead detail currently puts edit forms and knowledge details ahead of the fastest conversion summary in some paths.
4. Inbox currently behaves partly like a messaging interface. It needs a stronger conversion-workspace orientation.
5. The app has older repo instructions about “Lead Intelligence”; current product doctrine is AI Lead Capture, Qualification & Conversion. Current user doctrine wins.

## Dependencies

No new external dependencies required.
No new schema required.
No n8n migration required.
No auth/RBAC changes required.

Potential internal dependency: extract pure helper functions from `leads/page.tsx` only if needed for reuse by Inbox.

## Alternative Approaches

### A. Rewrite Leads and Inbox from scratch
Reject. Violates PRESERVE > REFACTOR > REPLACE. High risk and likely duplicates stores/statuses.

### B. Build a separate Inbox data model
Reject for Phase 3. Inbox must be a view over lead/conversation state, not a second source of truth.

### C. Targeted Lead workspace refactor + Inbox queue consolidation
Recommended. Preserve existing stores and UI; extract small conversion-focused components/helpers.

## Recommendation

Proceed with C.

The first coding pass should do only this:
1. Add a conversion summary/header to selected lead using existing fields.
2. Reorder Lead Detail so the 15-second answer appears before edit/admin details.
3. Make Inbox list prioritize leads needing reply, human review, then recent activity.
4. Route Inbox items into `/app/leads?contact=<leadId>&tab=comms` wherever a lead record exists.
5. Add/adjust surface tests to prevent duplicated inboxes and ensure Phase 3 copy exists.

---

## Implementation Tasks

### Task 1: Add Phase 3 surface tests first

Objective: Lock the product constraints before UI edits.

Files:
- Modify: `scripts/user-facing-surface.test.ts`

Assertions to add:
- Leads page includes `Lead → Conversation → Qualification → Action` or equivalent conversion-first copy.
- Leads page prioritizes fields: current status, last conversation, qualification, next action, owner/follow-up.
- Inbox page links lead-backed conversations to `/app/leads?contact=` rather than creating an isolated inbox detail.
- Inbox page includes conversion workspace language, not generic messaging-only language.

Run:
`npm run test:user-facing-surface`
Expected: initially fail until UI updates are made.

### Task 2: Extract conversion summary helper only if necessary

Objective: Avoid duplicating next-action/status logic between lead detail and inbox.

Preferred first move: keep helper functions local if only used in `leads/page.tsx`.
Extract only if both Leads and Inbox need them.

Potential files:
- Create only if justified: `apps/web/src/lib/lead-conversion-view.ts`
- Modify: `apps/web/src/app/app/leads/page.tsx`
- Modify: `apps/web/src/app/app/communications/page.tsx`

Do not introduce a new store.

### Task 3: Create selected lead conversion summary inside existing workspace

Objective: A user opening a lead understands what matters in under 15 seconds.

Modify:
- `apps/web/src/app/app/leads/page.tsx`

Add/adjust within `LeadRecordWorkspace` before tabs or at the top of the selected lead area:
- Lead identity
- Product pipeline status
- Last message preview/time
- Qualification summary
- Next action
- Assignee/owner
- Follow-up count/status

Use existing data:
- `contactLabel(lead)`
- `crmStage(lead)`
- `latestMessage(lead)`
- `lead.summary`
- `nextAction(lead)`
- `lead.assigneeName`
- `crmFollowUps.length`

Do not add charts, reports, or new metrics.

### Task 4: Reorder Lead Details tab for conversion first

Objective: Details tab should support the golden rule, not bury conversion info below edit/admin controls.

Modify:
- `apps/web/src/app/app/leads/page.tsx`

Change order:
1. Qualification summary / captured answers
2. Next action
3. Contact identity
4. Owner/source/status
5. Knowledge facts
6. Edit lead collapsed section
7. Archive/exclude controls

Keep edit capabilities but keep them secondary.

### Task 5: Make Inbox a conversion queue

Objective: Inbox answers: what does the lead want, are they qualified, who owns them, what happens next?

Modify:
- `apps/web/src/app/app/communications/page.tsx`

Minimum changes:
- Sort items by conversion urgency:
  1. `needs_reply`
  2. `human_review`
  3. ad-originated lead conversations
  4. most recent activity
- Prefer lead-backed `leadItems` over raw WhatsApp/extension duplicates when a matching lead exists.
- Ensure lead-backed items route to `/app/leads?contact=<id>&tab=comms`.
- In active panel, show qualification/next action/owner if `contextLead` exists.

Do not build full send/reply system here.

### Task 6: Validate

Run:
- `npm run test:user-facing-surface`
- `npm run test:lead-knowledge`
- `npm run test:whatsapp-crm-v1`
- `npm run typecheck`
- `npm run lint`

If those pass, run:
- `npm run build`

Expected: all pass.

## Non-goals

- No Analytics overhaul
- No Team redesign
- No n8n migration
- No workflow migration
- No new auth system
- No new database schema
- No duplicate Inbox model
- No generic CRM expansion

## Acceptance Criteria

A first-time sales agent can, within 30 seconds:
1. Find a lead from the Leads list or Inbox queue.
2. Open the conversation timeline.
3. Understand the qualification state.
4. See the next action.
5. Identify owner/follow-up status.
6. Continue sales through channel handoff/manual log.

If this fails, Phase 3 is not complete.
