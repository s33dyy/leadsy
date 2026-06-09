# Leadsy UI Redesign Plan

Date: 2026-06-06
Status: Plan only. No UI refactor has started.

## Objective

Evolve the existing Leadsy frontend into an operator-focused lead capture, qualification, CRM, conversation, assignment, follow-up, and conversion experience.

The redesign must preserve existing routes, integrations, backend APIs, and deployment behavior while changing product emphasis away from workers, knowledge, and intelligence as primary concepts.

## Design References

Use:

- Attio for dense CRM records, saved views, and field editing
- HubSpot for pipeline clarity, source attribution, and campaign operations
- Close CRM for inbox, calling/message context, and sales follow-up focus
- Linear for compact navigation, command quality, and status clarity

Avoid:

- Generic dashboard cards
- Empty decorative panels
- Excessive whitespace
- Marketing-page layout inside the app
- Product copy that presents Leadsy as a knowledge system or prospect research platform

## Target Information Architecture

Primary navigation:

```text
Dashboard
Leads
Inbox
Automations
Team
Analytics
Settings
```

Recommended route mapping:

| Target nav | Existing base | Route plan |
| --- | --- | --- |
| Dashboard | `/app` | Keep route, update metrics and drilldowns |
| Leads | `/app/leads` | Rename CRM emphasis to Leads, make primary workspace |
| Inbox | `/app/communications` | Keep route, add `/app/inbox` alias later |
| Automations | `/app/worker`, `/app/tasks`, workflow APIs | Add `/app/automations`; keep workers as subview |
| Team | Assignment rules and auth users | Add `/app/team` |
| Analytics | Dashboard and health data | Add `/app/analytics` |
| Settings | `/app/settings` | Keep route, reorganize sections |

Supporting routes:

- `/app/approvals` becomes Automations or Inbox approval queue.
- `/app/integrations` remains available from Settings and quick actions.
- `/app/connect` remains onboarding/integration setup.
- `/app/magnet` remains archived or hidden unless explicitly reintroduced.
- `/app/worker` remains available as Extension Worker or Automation Worker detail, not primary navigation.

## Product Language Changes

Replace primary labels:

| Current emphasis | New emphasis |
| --- | --- |
| CRM | Leads |
| Communications | Inbox |
| Workers | Automations or Extension Worker |
| Knowledge | Lead Context, Insights, Notes, History |
| Intelligence | AI Qualification |
| Research | Enrichment or Supporting Context |
| Lead Magnet | Capture Source or archived module |

Do not remove knowledge, worker, extension, or research capabilities. Reduce their prominence and place them inside the conversion workflow.

## App Shell Plan

Primary files:

- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/app/app/page.tsx`
- `apps/web/src/app/app/leads/page.tsx`
- `apps/web/src/app/app/communications/page.tsx`
- `apps/web/src/app/app/settings/page.tsx`

Changes to plan:

- Replace current primary nav with Dashboard, Leads, Inbox, Automations, Team, Analytics, Settings.
- Keep old route support through redirects, aliases, or secondary links.
- Replace hardcoded shell counters with live counts or remove the counters until real data is available.
- Connect global search to lead and inbox search or make it visually scoped until implemented.
- Connect "New" action to manual lead creation or a source menu.
- Keep Integrations accessible but not primary.

Acceptance criteria:

- Existing authenticated layout still loads.
- Old preserved routes still work or redirect safely.
- Navigation matches target product workflow.
- No existing Meta, WhatsApp, extension, auth, or Railway routes are removed.

## Dashboard Plan

Dashboard should answer: "What needs operator attention right now?"

Required metrics:

- New Leads
- Qualified Leads
- Interested Leads
- Won Leads
- Lost Leads
- Active Conversations
- Pending Follow-Ups
- Team Activity

Required visuals:

- Lead Funnel
- Source Breakdown
- Team Performance
- Conversion Trends

Drilldown rules:

- Clicking New Leads opens Leads filtered by status = New.
- Clicking Qualified Leads opens Leads filtered by status = Qualified.
- Clicking Active Conversations opens Inbox filtered by open conversations.
- Clicking Pending Follow-Ups opens Automations or Tasks filtered by due/open follow-ups.
- Clicking Source Breakdown segments opens Leads filtered by source.
- Clicking Team Performance opens Team filtered by member.

Current gaps to fix:

- Dashboard cards contain hardcoded deltas and static values.
- Charts need real record links.
- Infrastructure status should move to Settings or an admin-only health panel.

## Leads Plan

Leads becomes the primary screen.

Required pipeline columns:

- New
- Qualified
- Interested
- Contacted
- Won
- Lost

Each lead card or row must show:

- Name
- Company
- Source
- Owner
- Status
- Last Activity

Required tools:

- Search
- Filters
- Bulk actions
- Saved views
- Status changes
- Owner assignment
- Source filter
- Last activity filter

Existing data to reuse:

- `LeadKnowledgeLead.contact`
- `LeadKnowledgeLead.leadSource`
- `LeadKnowledgeLead.campaignId`
- `LeadKnowledgeLead.assigneeName`
- `LeadKnowledgeLead.crmStatus`
- `LeadKnowledgeLead.qualificationStage`
- `LeadKnowledgeLead.summary`
- `LeadKnowledgeLead.nextAction`
- `LeadKnowledgeLead.messages`
- `LeadKnowledgeLead.activities`

Status mapping should be introduced before a visual kanban rewrite:

| Product status | Current source |
| --- | --- |
| New | `crmStatus = new_lead` |
| Qualified | `qualificationStage = qualified` |
| Interested | `crmStatus = interested` |
| Contacted | outbound communication, `needs_reply`, or review state |
| Won | new explicit product status |
| Lost | new explicit product status |

Open product decision:

- Keep `needs_reply` and `human_review` as operational flags instead of top-level pipeline statuses.

## Lead Detail Plan

Required header:

- Lead Name
- Company
- Phone
- Source
- Owner
- Status

Required tabs:

- Overview
- Conversation
- Qualification
- Tasks
- Notes
- Activity
- Timeline

Mapping to existing system:

| Tab | Existing base | Missing |
| --- | --- | --- |
| Overview | contact, summary, next action, facts | stronger field editing and source/owner/status summary |
| Conversation | messages and communications | full channel timeline and compose controls |
| Qualification | qualification fields and profile | score, reason, missing fields, AI question flow |
| Tasks | follow-up tasks and extension tasks | due sequence grouping and completion flow |
| Notes | facts/manual notes | structured notes with author/time |
| Activity | lead activities | consistent audit/activity model |
| Timeline | messages, edits, assignments, tasks | merged chronological view |

## Inbox Plan

Inbox should be a unified communication hub for WhatsApp, Instagram, Messenger, and Email.

Required layout:

- Left conversation list with search, channel filters, status filters, and owner filters
- Center conversation timeline
- Right lead context panel with summary, qualification, owner, status, tasks, and notes

Required actions:

- Assign Owner
- Add Internal Note
- Use Suggested Reply
- Send or queue reply
- Mark follow-up needed
- Link or merge lead record

Current gaps to fix:

- Search/filter/pin/star/summarize controls are not fully wired.
- Composer behavior is not a complete send/queue workflow.
- AI summary and suggested replies need real state and clear loading/error handling.
- Communication must always drill into the lead record.

## Automations Plan

Automations should be a no-code workflow surface, not a worker-first product area.

Primary views:

- Workflow catalog
- Active workflows
- Workflow execution history
- Follow-up sequences
- Approval queue
- Extension worker status

Initial workflows:

- Lead Created -> Assign Owner -> Send WhatsApp -> Start Qualification
- Lead Interested -> Notify Agent -> Create Task
- Follow-Up Due -> Queue Message -> Notify Owner
- Inbound Message Received -> Update Qualification -> Suggest Reply
- Meta Lead Received -> Normalize Lead -> Start Qualification

Existing base:

- `packages/workflows/src/automation-catalog.ts`
- `packages/workflows/n8n/leadsy-automation-router.json`
- `apps/web/src/app/api/automation/agent/route.ts`
- infrastructure automation APIs

UI rule:

- Show workers as supporting execution infrastructure inside Automations, not as a primary product pillar.

## Team Plan

Team should support conversion operations.

Required roles:

- Admin
- Manager
- Agent

Required features:

- User list
- Role display and management
- Lead Assignment
- Round Robin
- Source-Based Routing
- Workload Distribution
- Rule audit history

Existing base:

- Runtime auth users and roles
- Prisma user roles
- Assignment rule store and API

Example routing UI:

```text
Meta Leads -> Agent A
Google Leads -> Agent B
High Budget Leads -> Manager Review
No Owner After 15 Minutes -> Round Robin
```

## Analytics Plan

Analytics should measure conversion operations.

Required reports:

- Lead Volume
- Source Performance
- Qualification Rate
- Conversion Rate
- Team Performance
- Pipeline Value
- Response Times
- Follow-Up Effectiveness

Drilldown rule:

- Every chart segment must link to filtered records.

Initial data sources:

- Lead knowledge store for early metrics
- CRM follow-up tasks
- Communication records
- Prisma models once migration begins
- Automation execution metadata once implemented

## Settings Plan

Settings should organize setup and governance:

- Workspace profile
- Sources and integrations
- AI qualification rules
- Team routing rules
- Messaging and approvals
- Automations and n8n connection
- Extension configuration
- Infrastructure health
- Billing or cost controls if needed

Reduce top-level visibility of infrastructure and worker settings unless the user is Admin.

## Frontend Stability Fixes To Include

The redesign should address these known unstable or hardcoded surfaces:

- Static AppShell counts
- Hardcoded Dashboard deltas
- Static worker statistics
- Auth preview/demo copy that overemphasizes intelligence
- Global quick search, New, filter, and command actions that are not wired
- Communications search/filter/pin/star/summarize controls
- Approvals filters, bulk selection, and reject behavior
- CRM composer and archive behavior
- Settings sections that expose infrastructure before product setup

The detailed frontend audit lives in `docs/leadsy-frontend-audit.md`.

## Verification Plan

Before each UI phase is considered complete, run:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:preserved-integrations
npm run test:global-components
npm run test:ux-rules
npm run test:user-facing-surface
```

For route changes, also run or add tests around:

- Authenticated app shell navigation
- Lead list filters and status mapping
- Lead detail tabs
- Inbox channel filters
- Assignment rule UI
- Follow-up task UI
- Dashboard chart drilldowns

