# ChatGPT Context - Leadsy Current Product State

## What Leadsy Is

Leadsy is an AI lead intelligence and operations platform for agencies, Indian SMBs, real estate teams, and revenue operators.

The current product is not a generic CRM and should not be described as a fully mature sales automation suite. It is a dark, operator-focused web workspace for:

- ingesting leads from Meta, WhatsApp, browser extension capture, and manual entry
- linking messages and conversations to lead knowledge records
- reviewing a lead detail workspace
- seeing customer conversation history separately from internal/system events
- deterministic qualification scoring from traceable customer conversation inputs
- generating and approving human-operated outreach tasks
- viewing worker/automation infrastructure state without fake metrics
- checking n8n infrastructure health and workflow metadata

Human approval is a product guardrail. Leadsy should not autonomously send messages.

## Current Frozen Version

- Date: 2026-06-06
- Product commit: `bdefede4acdee86f92ba8837509aa55cf38960d2`
- Main branch at freeze time: `bdefede4acdee86f92ba8837509aa55cf38960d2`
- Web Railway deployment: `74df3aa4-5b7d-4573-8101-c516ddc6d114`
- Web deployment status: `SUCCESS`
- n8n Railway deployment: `47eb448c-a4c2-4866-b9e3-115bc21861af`
- n8n deployment status: `SUCCESS`

## Stack

- Monorepo with npm workspaces
- Web app: Next.js App Router, React, TypeScript, Tailwind CSS
- Data plane: local JSON store in current production/runtime, plus PostgreSQL and Redis-ready project structure
- Domain packages: `packages/domain`, `packages/ai`, `packages/security`, `packages/events`, `packages/workflows`, `packages/observability`, `packages/config`, `packages/db`
- Deployment: Railway
- Web Railway service watches `/apps/web/**`
- n8n is a separate Railway Docker-image service using `docker.n8n.io/n8nio/n8n:stable`

## Current Production Counts

From `https://leadsy.up.railway.app/api/health` at freeze time:

- Lead records: 971
- Active leads: 970
- Excluded leads: 1
- Needs reply: 290
- WhatsApp conversations: 130
- Lead knowledge conversations: 130
- Lead knowledge messages: 722
- Meta-sourced lead records: 1
- Extension-sourced lead records: 54
- Manual-sourced lead records: 74
- Extension tasks: 147 total, 10 visible, 6 active
- Pending approvals: 1
- CRM follow-up tasks: 0
- Assignment rules: 0
- Assignee workload: 969 unassigned, 2 assigned to Meta sales owner

## Implemented Product Areas

### Authentication And Workspace

Implemented:

- owner/admin/client-ish auth model
- password and Google auth routes
- onboarding surface
- app shell with global sidebar
- protected `/app/*` workspace routes

Current caveat:

- Local test verification encountered a hydration warning when onboarding was skipped mid-render. This was not part of the production fix and should be investigated separately if onboarding becomes the next focus.

### Leads Workspace

Implemented:

- `/app/leads`
- lead list
- lead search and filters
- selected lead detail workspace
- lead context fields
- conversation tab
- qualification tab
- tasks tab
- notes tab
- timeline tab
- action panel
- manual lead creation
- manual communication logging
- lead-level exclude/restore
- conversation/message knowledge exclusion controls

Recent critical UI fix:

- The lead detail workspace previously collapsed at normal desktop widths because a three-column `xl` subgrid was used inside a constrained pane.
- Fixed in commit `bdefede4acdee86f92ba8837509aa55cf38960d2`.
- The Knowledge rail now waits until `2xl`.
- The lead detail subgrid becomes three columns only at `min-[2200px]`.
- Action/task text has `min-w-0` and word wrapping guards.

### Conversation Truth Contract

Implemented:

- `conversationMessages`
- `internalNotes`
- `systemEvents`

Rules:

- Conversation timeline must show customer conversation messages only.
- Inbox previews must use real customer conversation messages only.
- Qualification inputs must use customer conversation messages only.
- Worker events, task events, audit events, sync events, and internal notes must not be treated as customer conversation.

This was added during Phase 4.5 because the app had previously shown outbound worker/system records as if they were customer conversation history.

### Inbox

Implemented:

- `/app/communications`
- lead-backed inbox items
- customer-message-only preview generation
- ID dedupe
- preview links back to the Lead Detail Workspace

Rules:

- no worker task previews
- no system-event previews
- no fake conversation preview text

### Qualification Engine

Implemented:

- deterministic qualification engine
- score range 0-100
- intent labels
- missing field panel
- one recommended action
- explanation/reasons/missing outputs
- qualification input traceability audit helper

Fields:

- Need
- Budget
- Timeline
- Authority
- Location
- Company
- Service Interest
- Intent
- Risk
- Recommended Action

Important constraint:

- No fake values. Unknown values display as `Not Yet Collected`.
- Untraceable historical values should be marked invalid or uncertain rather than trusted.
- No new AI provider or LLM calls were added for Phase 4.

### Automations / Worker Page

Implemented:

- `/app/worker`
- extension pairing evidence
- browser extension fallback monitor
- real available worker/infrastructure state
- n8n infrastructure visibility through settings/infrastructure routes

Removed:

- fake success percentages
- fake running statuses
- fake queue/workload claims
- fake operational metrics

Rule:

- If n8n or workers do not provide real data, show `No Data Available`, `Not Configured`, or specific real evidence. Do not invent health or throughput.

### Team Page

Implemented:

- `/app/team`
- read-only current user/workspace user/assignment configuration view

Not implemented:

- invitations
- role editing
- team management workflows

### Approval Queue And Tasks

Implemented:

- `/app/approvals`
- `/app/tasks`
- extension task lifecycle routes
- human approval concepts
- approval/send handoff routes

Current caveat:

- This is operator/task infrastructure, not a fully autonomous campaign system.

### Integrations And Channels

Implemented surfaces/routes:

- `/app/connect`
- `/app/integrations`
- Meta OAuth routes
- Meta webhook route
- WhatsApp webhook route
- extension capture/sync/context/copilot/reply routes
- manual lead/message routes

Current caveat:

- Official WhatsApp customer-message lifecycle is tested, but real production confidence still depends on actual webhook configuration and live message verification.

### Lead Magnet

Implemented:

- `/app/magnet`
- lead magnet brief/discover/search/import/outreach route structure
- OSINT/public research policy and spend guards in repo documentation

Current caveat:

- Production health shows `leadMagnetSources: 0` and `discoveredLeads: 0` at freeze time.

## Not Yet Built Or Not Mature

Treat these as not implemented or not production-grade unless a future freeze says otherwise:

- Assignment Engine
- Follow-Up Automation
- Analytics as a reliable decisioning layer
- Campaigns
- Workflow Builder
- autonomous outbound sending
- full team management
- role invitation flows
- mature CRM reporting
- reliable revenue/deal/account modules
- broad n8n migration of product logic
- database-backed production model beyond the current deployed data/runtime state

Production health reports zero for:

- accounts
- deals
- campaigns
- agency clients
- CRM follow-up tasks
- assignment rules
- interested leads
- human review leads

## Current User-Visible Risks

1. Product UI quality has been fragile.
   - A severe lead workspace layout collapse was fixed in the current deployed commit.
   - Future UI work must include actual browser/viewport verification.

2. CRM truth must remain sacred.
   - Customer conversation, internal notes, and system events must stay separated.
   - If a timeline or inbox item cannot be traced to a stored customer message record, it should not appear as customer conversation.

3. Fake metrics are banned.
   - Automations/workers/n8n surfaces must show only real evidence.

4. Performance risk remains in large lead/inbox surfaces.
   - Phase 4.5 centralized inbox construction and filtered visible inputs.
   - Broad data-layer/indexing work has not been completed.

5. Deployment watch-path trap.
   - Railway web watches `/apps/web/**`.
   - A CI-fix commit outside that path can pass GitHub Actions but be skipped by Railway.
   - Agents must confirm active Railway deployment commit equals `origin/main`.

## Verification Commands Available

Common checks:

```bash
npm run typecheck
npm run lint
npm run test:user-facing-surface
npm run test:crm-truth-stabilization
npm run test:qualification-engine
npm run test:lead-knowledge
npm run test:whatsapp-crm-v1
npm run build
```

Deployment checks:

```bash
git ls-remote origin refs/heads/main
railway deployment list --service efa9e589-cdb9-4268-b255-4c663bb32150 --environment 7b7fa246-b552-4a88-938c-672107c8dca4 --json
curl -fsS https://leadsy.up.railway.app/api/health
curl -fsS https://n8n-production-3749.up.railway.app/healthz
```

## What A New ChatGPT Thread Should Do With This

Use this context to reason about Leadsy honestly.

When asked to design or implement next steps:

- prioritize CRM truth, UI correctness, and performance over new AI features
- do not invent features, metrics, or operational states
- ask whether the request targets current production behavior, local repo behavior, or a proposed roadmap
- keep human approval as a hard outbound guardrail
- preserve the conversation contract
- verify with real tests and browser checks
- avoid Phase 5+ assumptions unless explicitly requested

