# Leadsy Product Gap Analysis

Date: 2026-06-06
Status: Gap analysis complete. No product refactor has started.
Scope: Main Leadsy repository, excluding generated dependencies and unrelated `prelaunch/` output.

## Target Product

Leadsy should become an AI lead capture, qualification, and conversion platform.

Primary workflow:

```text
Lead Source -> AI Qualification -> CRM -> Assignment -> Follow-Up -> Conversion
```

Leadsy is:

- AI Qualification Platform
- CRM
- Conversation Hub
- Team Assignment System
- Automation Engine

Leadsy is not:

- Revenue OS
- Knowledge Management System
- Prospect Research Platform

## Preservation Boundaries

The repository already contains working product assets that must be preserved:

- Meta OAuth, Meta webhook, Meta Lead Ads, and Click-to-WhatsApp surfaces
- WhatsApp integration and WhatsApp conversation data structures
- OpenRouter integration and AI cost controls
- Browser extension capture and task execution layer
- Railway deployment and Docker/PostgreSQL setup
- Existing authentication, roles, tenant isolation, audits, and rate limits
- Existing CRM, lead knowledge, assignment rule, follow-up task, and qualification profile structures
- Existing workflow catalog and n8n migration assets

The realignment should evolve these assets. It should not replace the application, move business ownership to n8n, or remove integrations that already work.

## Repository Coverage

Reviewed areas:

- Product and architecture docs: `README.md`, `CURRENT_SYSTEM_AUDIT.md`, `PRESERVED_INTEGRATIONS.md`, `BACKEND_AUDIT.md`, `UI_AUDIT.md`, `UI_REDESIGN_REPORT.md`, `DESIGN_SYSTEM.md`, `docs/architecture.md`, `docs/modules.md`, `docs/api.md`, `docs/roadmap.md`
- Deployment and CI: `.github/workflows/railway-web.yml`, `docker-compose.yml`, `apps/web/Dockerfile`, `vercel.json`, `RAILWAY_MIGRATION_PLAN.md`
- Database and domain model: `packages/db/prisma/schema.prisma`, `packages/domain/src/index.ts`
- AI and events: `packages/ai/src/index.ts`, `packages/events/src/index.ts`
- Workflow and n8n assets: `packages/workflows/src/*`, `packages/workflows/n8n/*`, `N8N_WORKFLOWS.md`, `DEVELOPER_AUTOMATION_GUIDE.md`
- Web routes, stores, components, and tests under `apps/web/src`
- Extension source under `apps/extension/src`
- Existing frontend audit: `docs/leadsy-frontend-audit.md`

## Current Product Shape

The current app is closer to an AI lead intelligence and operations cockpit than the requested conversion platform. It has useful building blocks, but the user-facing emphasis is spread across workers, knowledge, approvals, infrastructure, and research workflows.

Current strengths:

- Unified lead knowledge records already aggregate contact, conversation, source, assignment, qualification fields, summary, next action, and activity.
- Manual lead creation exists through `apps/web/src/app/api/leads/manual/route.ts`.
- Lead editing supports contact data, source, assignee, CRM status, qualification stage, and qualification fields.
- `apps/web/src/lib/lead-knowledge-store.ts` already infers simple qualification status from conversation content.
- `apps/web/src/app/api/qualification/profile/route.ts` supports workspace qualification profile configuration.
- `apps/web/src/app/api/crm/assignment-rules/route.ts` and `apps/web/src/app/api/crm/follow-up-tasks/route.ts` provide early CRM operations.
- Prisma contains durable models for tenants, users, leads, deals, activities, Meta leads, qualification snapshots, WhatsApp conversations, WhatsApp messages, follow-up tasks, workflows, and audits.
- n8n workflow catalog already includes lead added, qualification requested, Meta lead received, WhatsApp message received, and follow-up due events.

Main mismatch:

- The UI and copy present Leadsy as intelligence/research/worker software.
- The target product requires Leads, Inbox, Automations, Team, Analytics, and Settings as the main operating loop.
- Runtime lead state is still largely JSON-file backed, while PostgreSQL models exist but are not the main visible source of truth.
- Several frontend actions are static, hardcoded, or optimistic placeholders instead of connected operator workflows.

## Product Gap Matrix

| Area | Existing base | Gap | Priority |
| --- | --- | --- | --- |
| Lead sources | Meta, WhatsApp, browser extension, manual leads, webhook/store support | Website forms, CSV import, first-class email source, source taxonomy, source-to-pipeline normalization | P0 |
| AI qualification | Qualification fields, inferred statuses, configurable profile API, OpenRouter support | Conversational question engine, scoring model, rule UI, qualification snapshots tied to status transitions | P0 |
| CRM pipeline | Lead list/detail, CRM status, assignee, facts, notes, conversation summaries | Required columns New, Qualified, Interested, Contacted, Won, Lost; saved views; bulk actions; durable status model | P0 |
| Lead detail | Lead knowledge panel and edit APIs | Required tab model: Overview, Conversation, Qualification, Tasks, Notes, Activity, Timeline | P0 |
| Inbox | Communications route and message store | Search/filter/pin/star/summarize/composer are not fully wired; no unified owner assignment surface | P0 |
| Assignment | Assignment rule API and default source-based owners | Team UI, Admin/Manager/Agent roles, round robin, workload routing, rule execution visibility | P1 |
| Follow-ups | Follow-up task API and extension tasks | Delayed messages, reminder sequences, re-engagement campaigns, due automation, campaign tracking | P1 |
| Bulk messaging | Extension task and communication primitives | Segment builder, campaign UI, delivery/read/replied analytics, send approvals | P1 |
| Automations | Workflow catalog, n8n router export, n8n service docs | Visual workflow builder, service-auth action endpoints, execution history, activation and monitoring | P1 |
| Analytics | Dashboard cards and health endpoints | Drillable source performance, qualification rate, conversion rate, response times, follow-up effectiveness | P1 |
| Knowledge | Lead summaries, facts, notes, activity, AI insights | Too prominent as product identity; should move into lead context and qualification support | P2 |
| Extension | Capture and task execution layer | Needs positioning as capture layer, not primary product experience | P2 |
| Deployment | Railway, Docker, CI, Postgres | Preserve while adding APIs and migrations incrementally | P0 |

## Detailed Findings

### 1. Lead Source Intake

Current assets:

- Meta and WhatsApp integration routes are documented and protected by preservation tests.
- Browser extension pushes captured conversations and contact information into Leadsy-owned stores.
- Manual lead creation exists and writes lead knowledge.
- Domain and Prisma schemas include Meta and WhatsApp models.

Gaps:

- Website form intake is not a first-class product route.
- CSV import is not implemented as an operator workflow.
- Email is represented conceptually but not yet a full inbound channel.
- Source names are currently strings rather than a normalized taxonomy.
- Source-specific routing exists in assignment rules but is not shown as a primary UI capability.

Required direction:

- Define one normalized lead source contract.
- Route every source through the same create/update lead pipeline.
- Keep Meta, WhatsApp, extension, and manual APIs intact while adding missing intake surfaces.

### 2. AI Qualification

Current assets:

- `LeadQualificationFields` tracks name, phone, company, need, team/query volume, budget, and timeline.
- The lead knowledge store infers `qualificationStage` and `crmStatus`.
- `QualificationProfile` supports required fields and question order.
- OpenRouter integration supports AI calls and budget controls.

Gaps:

- No visible workspace UI for qualification rules.
- No durable qualification score or intent score tied to the lead detail experience.
- No operator-visible question flow for AI to ask, collect, summarize, and advance status.
- Existing AI surface still leans toward prospect research rather than lead conversion.

Required direction:

- Make AI qualification the core product feature.
- Store qualification snapshots and decisions durably.
- Show score, missing fields, collected answers, suggested next question, and status reason in lead detail.

### 3. CRM Pipeline

Current assets:

- `/app/leads` exists as the main CRM-like route.
- Lead records include contact, source, company, owner, summary, next action, facts, activity, and conversation records.
- Lead editing supports `crmStatus` and `qualificationStage`.

Gaps:

- Current status values are `new_lead`, `interested`, `needs_reply`, and `human_review`.
- Required pipeline columns are New, Qualified, Interested, Contacted, Won, and Lost.
- Bulk actions, saved views, and real filters need to become durable operator features.
- Some global shell actions are not connected to the CRM state.

Required direction:

- Introduce a stable product pipeline status taxonomy while mapping existing statuses safely.
- Treat Leads as the primary screen.
- Use dense CRM patterns inspired by Attio, HubSpot, Close CRM, and Linear.

### 4. Inbox

Current assets:

- Conversations and communication records are attached to lead knowledge.
- Channels include WhatsApp, Instagram, Facebook, web chat, email, call, and manual.
- Communications route already exists.

Gaps:

- Current communications UI contains static or partially wired controls.
- Suggested replies and AI summaries are not a complete operator workflow.
- Internal notes and owner assignment need to happen inside the inbox.
- Conversation timelines need drill-through into lead records.

Required direction:

- Make Inbox the unified communication hub.
- Attach every message to a lead.
- Show conversation timeline, AI summary, suggested replies, internal notes, and owner controls.

### 5. Team Assignment

Current assets:

- Assignment rules exist in `apps/web/src/lib/crm-store.ts`.
- Assignment rule API supports source, campaign, status, assignee, and enabled state.
- Prisma supports roles beyond the simplified runtime role set.

Gaps:

- No primary Team route.
- No UI for Admin, Manager, Agent operational management.
- No round-robin, workload distribution, or source-routing dashboard.
- Rule application needs clear auditability.

Required direction:

- Create Team as a first-class nav item.
- Keep auth/RBAC in Next.js/Postgres.
- Use n8n only to orchestrate routing actions after Leadsy authorizes them.

### 6. Follow-Ups and Bulk Messaging

Current assets:

- Follow-up tasks exist and can be created.
- Extension tasks support queued, approval, sent, monitoring, postponed, failed, and cancelled states.
- Workflow catalog includes `follow-up-due`.

Gaps:

- No sequence builder for 3 hours, 24 hours, 7 days, 30 days.
- No campaign segment builder.
- Delivery, read, replied, and conversion tracking are not yet shown as campaign analytics.
- Outbound messages need approval and audit rules before automation sends at scale.

Required direction:

- Build follow-up sequences as Leadsy-owned CRM objects.
- Let n8n schedule and notify, but keep the canonical task, campaign, and lead state in Leadsy.
- Use approvals for risky outbound sends.

### 7. Automations and n8n

Current assets:

- n8n service exists on Railway.
- Source-controlled workflow router exists.
- Workflow catalog is typed and versioned.
- `/api/automation/agent` accepts automation requests with idempotency metadata.

Gaps:

- Router is intentionally inactive until service-auth and action endpoints exist.
- Visual workflow builder is not implemented.
- Automation execution history is not a first-class operator view.
- n8n should not call provider APIs directly without Leadsy-owned authorization and audit.

Required direction:

- Keep n8n as orchestration only.
- Add Leadsy action endpoints for qualification, assignment, follow-up, notification, and campaign execution.
- Store automation definitions, runs, statuses, and audit trail in Leadsy.

### 8. Analytics

Current assets:

- Dashboard has metrics and some operational status.
- Health and infrastructure endpoints exist.
- Lead stores contain enough fields to compute early metrics.

Gaps:

- Charts are not fully drillable into records.
- Conversion trends, source performance, team performance, response times, and follow-up effectiveness are incomplete.
- Current dashboard copy and cards overemphasize intelligence/infrastructure.

Required direction:

- Make dashboard operator-focused.
- Every chart should link to filtered Leads, Inbox, Team, or Follow-Up records.
- Analytics should measure conversion operations, not system novelty.

### 9. Data Durability

Current assets:

- PostgreSQL schema exists.
- JSON stores are practical for current local/runtime data and should not be broken abruptly.
- CI and deployment are already sensitive to integration preservation.

Gaps:

- Visible CRM, assignment, lead knowledge, extension, and auth state still rely heavily on JSON stores under `LEADSY_DATA_DIR`.
- Prisma models are broader than the runtime store contracts.
- Migration paths must protect existing data and deployment.

Required direction:

- Add adapters and migrations incrementally.
- Do not flip all stores to Postgres in one release.
- Preserve JSON fallback until production migration and tests are complete.

## Required Product Status Taxonomy

The target UI requires these pipeline statuses:

- New
- Qualified
- Interested
- Contacted
- Won
- Lost

Suggested safe mapping from current values:

| Current field/value | Initial product mapping | Notes |
| --- | --- | --- |
| `crmStatus = new_lead` | New | Existing default |
| `qualificationStage = qualified` | Qualified | Should become explicit durable status |
| `crmStatus = interested` | Interested | Existing value |
| `crmStatus = needs_reply` | Contacted or New with pending reply | Needs product decision |
| `crmStatus = human_review` | Contacted with review flag | Keep separate review flag if possible |
| Existing won/lost deal activity | Won/Lost | Needs explicit lead status update path |

The status model should preserve existing values during migration and expose the new product names in the UI.

## Product Realignment Risks

P0 risks:

- Rewriting the app would break preserved integrations.
- Moving auth, RBAC, CRM state, or business logic into n8n would violate the architecture boundary.
- Renaming/removing current routes without redirects would break extension, tests, and deployment assumptions.
- Changing provider webhook behavior before tests are expanded could break Meta and WhatsApp intake.

P1 risks:

- UI-only realignment without connected data will create a prettier but still unstable product.
- Static dashboard and inbox controls can mislead operators.
- Overemphasizing knowledge/workers will keep the product positioned incorrectly.

## Definition Of Done For Realignment

Leadsy is realigned when:

- Primary nav is Dashboard, Leads, Inbox, Automations, Team, Analytics, Settings.
- Leads is the primary workspace and uses the required pipeline statuses.
- Every supported source creates or updates a unified lead record.
- AI qualification collects required fields, summarizes answers, scores intent, and explains status.
- Lead detail has Overview, Conversation, Qualification, Tasks, Notes, Activity, and Timeline tabs.
- Inbox is channel-unified and attached to lead records.
- Assignment rules are visible, configurable, auditable, and role-aware.
- Follow-up sequences and reminders are manageable through UI.
- Automations use n8n for orchestration only and store durable state in Leadsy.
- Analytics drill into real records.
- Meta, WhatsApp, OpenRouter, browser extension, Railway, PostgreSQL, authentication, and existing CRM structures remain intact.

## First Gap To Close

The first implementation step should not be a redesign from scratch. It should be a controlled product shell and status realignment:

1. Rename and reorganize navigation around the target workflow.
2. Add a product-safe pipeline status mapping layer.
3. Make Leads the primary route and preserve existing lead knowledge data.
4. Convert hardcoded or static controls into real empty, disabled, or wired states.
5. Add tests that prove existing integrations and deployment-sensitive routes still work.

