# Backend Audit

Captured: 2026-06-05

This audit records the current backend before the n8n architecture evolution. No backend behavior, API contract, environment variable, database schema, integration, or deployment wiring was modified for this audit.

## Executive Summary

Leadsy is currently a Next.js App Router application with route handlers acting as the backend API, local JSON-file stores under `LEADSY_DATA_DIR` for active auth/CRM/knowledge/extension/Meta connection state, a Prisma PostgreSQL schema in `packages/db/prisma/schema.prisma`, deterministic/local AI fallbacks with OpenRouter support, a browser extension worker, and Docker/Railway-oriented deployment wiring.

The target architecture should preserve Next.js as the application backend and Postgres as source of truth, while adding n8n only as an automation orchestration service. Business state must stay in Leadsy-owned storage and APIs. Existing route handlers and integrations should become n8n-callable surfaces where needed; they should not be removed.

## Current API Routes

| Methods | Route | File | Classification | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/admin/cleanup-dummy-data` | `apps/web/src/app/api/admin/cleanup-dummy-data/route.ts` | Preserve | Session/RBAC protected admin cleanup. |
| `POST` | `/api/admin/demo-seed` | `apps/web/src/app/api/admin/demo-seed/route.ts` | Preserve | Disabled unless `LEADSY_DEMO_SEED_ENABLED=1` and token header matches. |
| `GET` | `/api/auth/google` | `apps/web/src/app/api/auth/google/route.ts` | Preserve | Starts Google OAuth. |
| `GET` | `/api/auth/google/callback` | `apps/web/src/app/api/auth/google/callback/route.ts` | Preserve | Completes Google OAuth and creates signed session. |
| `POST` | `/api/auth/login` | `apps/web/src/app/api/auth/login/route.ts` | Preserve | JSON password login. |
| `POST` | `/api/auth/login/form` | `apps/web/src/app/api/auth/login/form/route.ts` | Preserve | Form fallback login with Set-Cookie redirect semantics. |
| `POST` | `/api/auth/logout` | `apps/web/src/app/api/auth/logout/route.ts` | Preserve | JSON logout. |
| `GET, POST` | `/api/crm/assignment-rules` | `apps/web/src/app/api/crm/assignment-rules/route.ts` | Preserve | CRM assignment rule API. |
| `GET, POST` | `/api/crm/follow-up-tasks` | `apps/web/src/app/api/crm/follow-up-tasks/route.ts` | Preserve | CRM follow-up task API. |
| `POST` | `/api/extension/capture` | `apps/web/src/app/api/extension/capture/route.ts` | Preserve | Bearer-token browser capture into lead knowledge. |
| `GET` | `/api/extension/context` | `apps/web/src/app/api/extension/context/route.ts` | Preserve | Extension context endpoint. |
| `POST` | `/api/extension/conversations/sync` | `apps/web/src/app/api/extension/conversations/sync/route.ts` | Preserve | Syncs extension conversations to extension and knowledge stores. |
| `POST` | `/api/extension/copilot` | `apps/web/src/app/api/extension/copilot/route.ts` | Preserve | Extension copilot endpoint using AI package. |
| `POST` | `/api/extension/reply` | `apps/web/src/app/api/extension/reply/route.ts` | Preserve | AI-assisted reply decision endpoint. |
| `POST` | `/api/extension/tasks/:taskId/approve-send` | `apps/web/src/app/api/extension/tasks/[taskId]/approve-send/route.ts` | Preserve | Human send approval/rejection. |
| `POST` | `/api/extension/tasks/:taskId/approve` | `apps/web/src/app/api/extension/tasks/[taskId]/approve/route.ts` | Preserve | Human task approval/cancel. |
| `POST` | `/api/extension/tasks/:taskId/claim` | `apps/web/src/app/api/extension/tasks/[taskId]/claim/route.ts` | Preserve | Extension worker claims queued task. |
| `POST` | `/api/extension/tasks/:taskId/complete` | `apps/web/src/app/api/extension/tasks/[taskId]/complete/route.ts` | Preserve | Extension completes/postpones/blocks/fails task. |
| `POST` | `/api/extension/tasks/:taskId/events` | `apps/web/src/app/api/extension/tasks/[taskId]/events/route.ts` | Preserve | Extension task event logging. |
| `POST` | `/api/extension/tasks/:taskId/prepare` | `apps/web/src/app/api/extension/tasks/[taskId]/prepare/route.ts` | Preserve | Prepares draft and moves task to send approval. |
| `PATCH, DELETE` | `/api/extension/tasks/:taskId` | `apps/web/src/app/api/extension/tasks/[taskId]/route.ts` | Preserve | Edits and soft-deletes extension tasks. |
| `POST` | `/api/extension/tasks/generate` | `apps/web/src/app/api/extension/tasks/generate/route.ts` | Preserve | Generates selected lead worker tasks. |
| `GET` | `/api/extension/tasks` | `apps/web/src/app/api/extension/tasks/route.ts` | Preserve | Lists active extension worker task states. |
| `GET, POST, DELETE` | `/api/extension/tokens` | `apps/web/src/app/api/extension/tokens/route.ts` | Preserve | Creates/lists/revokes extension bearer tokens. |
| `GET` | `/api/health` | `apps/web/src/app/api/health/route.ts` | Preserve and extend | Health endpoint; good base for infrastructure dashboard. |
| `GET, POST` | `/api/lead-magnet/brief` | `apps/web/src/app/api/lead-magnet/brief/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/brief/form` | `apps/web/src/app/api/lead-magnet/brief/form/route.ts` | Deprecate but keep | Archived form redirect. |
| `POST` | `/api/lead-magnet/discover` | `apps/web/src/app/api/lead-magnet/discover/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/discover/form` | `apps/web/src/app/api/lead-magnet/discover/form/route.ts` | Deprecate but keep | Archived form redirect. |
| `POST` | `/api/lead-magnet/discover/stream` | `apps/web/src/app/api/lead-magnet/discover/stream/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/draft` | `apps/web/src/app/api/lead-magnet/draft/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/import` | `apps/web/src/app/api/lead-magnet/import/route.ts` | Deprecate but keep | Archived compatibility route. |
| `PATCH, DELETE` | `/api/lead-magnet/leads/:leadId` | `apps/web/src/app/api/lead-magnet/leads/[leadId]/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/outreach` | `apps/web/src/app/api/lead-magnet/outreach/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/plan-preview` | `apps/web/src/app/api/lead-magnet/plan-preview/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/search/answer` | `apps/web/src/app/api/lead-magnet/search/answer/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/search/start` | `apps/web/src/app/api/lead-magnet/search/start/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/lead-magnet/search/stop` | `apps/web/src/app/api/lead-magnet/search/stop/route.ts` | Deprecate but keep | Archived compatibility route. |
| `GET` | `/api/lead-magnet/search/stream` | `apps/web/src/app/api/lead-magnet/search/stream/route.ts` | Deprecate but keep | Archived compatibility route. |
| `POST` | `/api/leads/conversation-status` | `apps/web/src/app/api/leads/conversation-status/route.ts` | Preserve | Includes/excludes conversation from AI knowledge. |
| `POST` | `/api/leads/delete` | `apps/web/src/app/api/leads/delete/route.ts` | Preserve | Archives lead knowledge record. |
| `POST` | `/api/leads/edit` | `apps/web/src/app/api/leads/edit/route.ts` | Preserve | Edits lead contact/summary/action/facts. |
| `POST` | `/api/leads/manual-message` | `apps/web/src/app/api/leads/manual-message/route.ts` | Preserve | Logs manual communication. |
| `POST` | `/api/leads/manual` | `apps/web/src/app/api/leads/manual/route.ts` | Preserve | Creates manual lead record. |
| `POST` | `/api/leads/message-status` | `apps/web/src/app/api/leads/message-status/route.ts` | Preserve | Hides/restores message. |
| `POST` | `/api/leads/status` | `apps/web/src/app/api/leads/status/route.ts` | Preserve | Includes/excludes lead. |
| `GET` | `/api/meta/oauth/callback` | `apps/web/src/app/api/meta/oauth/callback/route.ts` | Preserve | Completes Meta OAuth. |
| `GET` | `/api/meta/oauth/start` | `apps/web/src/app/api/meta/oauth/start/route.ts` | Preserve | Session-gated Meta OAuth start. |
| `GET, POST` | `/api/meta/webhook` | `apps/web/src/app/api/meta/webhook/route.ts` | Preserve | Unified Meta webhook verification and ingestion. |
| `POST` | `/api/meta/whatsapp/conversations/lead-status` | `apps/web/src/app/api/meta/whatsapp/conversations/lead-status/route.ts` | Preserve | Sets WhatsApp contact lead status. |
| `GET, POST` | `/api/meta/whatsapp/webhook` | `apps/web/src/app/api/meta/whatsapp/webhook/route.ts` | Preserve | WhatsApp-compatible Meta webhook verification and ingestion. |
| `POST` | `/api/onboarding` | `apps/web/src/app/api/onboarding/route.ts` | Preserve | Saves/completes onboarding. |
| `GET, POST` | `/api/qualification/profile` | `apps/web/src/app/api/qualification/profile/route.ts` | Preserve | Stores/retrieves qualification profile. |

## Existing Integrations

| Integration | Current implementation | Preserve / Refactor / Deprecate |
| --- | --- | --- |
| Meta OAuth | `/api/meta/oauth/start`, `/api/meta/oauth/callback`, `apps/web/src/lib/meta-oauth-store.ts`; exchanges codes with Graph API and stores connection metadata/token preview in `data/app/meta-oauth.json`. | Preserve. Refactor only to expose status/metadata to dashboards. |
| Meta Webhooks | `/api/meta/webhook`, `/api/meta/whatsapp/webhook`, `apps/web/src/lib/meta-webhook-routing.ts`, `apps/web/src/lib/lead-knowledge-store.ts`; verifies challenge/signature and routes messages by OAuth assets. | Preserve. Workflows may consume events after Leadsy stores them. |
| WhatsApp | WhatsApp-compatible webhook route and store, unified knowledge normalization, WhatsApp Web extension task lane. | Preserve. n8n may orchestrate follow-up timing and suggestions, not replace message handling. |
| Instagram / Messenger / Facebook | Unified Meta messaging extraction handles Instagram/Facebook object payloads; extension has platform lanes for Instagram/Facebook/generic web chat. | Preserve. Add visibility only. |
| OpenRouter | `packages/ai/src/index.ts`, `apps/extension/src/core/openrouter.ts`, cost constraints doc/tests, env-driven model selection. | Preserve. Add cost dashboard using existing cost metadata; do not create direct UI clients. |
| Browser extension | `apps/extension/*`, `/api/extension/*`, bearer-token auth in `extension-auth.ts`; extension captures, syncs, prepares, and executes selected tasks. | Preserve as capture/execution layer. It is not the workflow engine. |
| Google OAuth | `/api/auth/google`, `/api/auth/google/callback`; creates owner/workspace sessions. | Preserve. |
| Search/public research | `packages/ai/src/research-tools.ts` supports configured API, Brave, Bing, DuckDuckGo/Mojeek fallback, robots/cooldowns/retries. | Preserve. n8n can orchestrate research requests through Leadsy APIs. |
| Docker Compose | `docker-compose.yml` runs web, Postgres/pgvector, Redis. | Preserve. Add n8n only as a separate service when explicitly implementing local automation stack. |
| Railway / GitHub Actions | `.github/workflows/railway-web.yml` verifies lint/typecheck/test/build on PR/main. Railway deploy is connected to `main` externally. | Preserve. Add n8n Railway service plan without modifying web deployment. |

## Existing Workers

| Worker | Current location | Notes | Classification |
| --- | --- | --- | --- |
| Browser extension background service worker | `apps/extension/src/background/index.ts` | Runs explicit selected task batches; does not auto-poll queued tasks on interval. | Preserve |
| Browser content automation controller | `apps/extension/src/content/automation.ts` | Observes supported chat pages, syncs visible conversations, prepares/sends only approved active tasks. | Preserve |
| Extension task tab helper | `apps/extension/src/background/task-tabs.ts` | Opens/reuses supported target tabs. | Preserve |
| In-app worker APIs | `apps/web/src/app/api/extension/tasks/*` | Route handlers manage queue-like task state. | Preserve and later expose automation-safe endpoints |
| Typed workflow simulator | `packages/workflows/src/index.ts` | In-memory DAG runner publishing `workflow.executed`. | Refactor toward n8n orchestration metadata; keep package for compatibility/tests |

No separate server-side queue worker process exists today.

## Existing Events

Current event bus: `packages/events/src/index.ts`

Event names:

- `lead.detected`
- `meta.lead.ingested`
- `qualification.scored`
- `whatsapp.reply.generated`
- `leadmagnet.discovery.completed`
- `leadmagnet.outreach.queued`
- `lead.enriched`
- `lead.routed`
- `sequence.started`
- `deal.updated`
- `workflow.executed`
- `copilot.invoked`

Current implementation is in-memory only. n8n integration should introduce durable execution metadata in Postgres without removing these names.

## Existing Queues

- `QUEUE_DRIVER` exists in env/config and Docker defaults to `in-memory`.
- `REDIS_URL` exists and local Docker runs Redis.
- Extension tasks act as a queue-like store in `apps/web/src/lib/extension-store.ts`.
- No BullMQ, Temporal, Trigger.dev, Redis Stream, or durable queue consumer currently exists.

Classification:

- Preserve current extension task queue semantics.
- Refactor automation-style scheduling/retries into n8n while keeping task state in Leadsy/Postgres.
- Deprecate any assumption that in-memory queue state is production durable.

## Existing Scheduled Jobs

- `vercel.json` defines one cron: `GET /api/health` every 15 minutes.
- Research retry/backoff exists inside `packages/ai/src/research-tools.ts`.
- Extension content scripts use short `setTimeout` processing debounce; the background worker intentionally avoids automatic polling.

Classification:

- Preserve health cron.
- Refactor scheduled lead research, follow-up due checks, worker retry, and approval routing into n8n workflows.
- Do not add autonomous send schedules.

## Existing OpenRouter Usage

Server-side:

- `packages/ai/src/index.ts`
- Env vars include `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_DOSSIER_MODEL`, `OPENROUTER_SENTIMENT_MODEL`, `OPENROUTER_FAST_MODEL`, `AI_DEFAULT_MODEL`, `LEADSY_SPEND_CAP_INR`, `LEADSY_DEFAULT_SPEND_CAP_INR`, `LEADSY_AI_PLANNER_ENABLED`.
- Cost extraction reads usage fields from OpenRouter responses, converts USD to INR, combines planner/dossier/message-drafter costs, and emits `cost-recorded` lead research events.
- Defaults favor `openrouter/free`.

Extension-side:

- `apps/extension/src/core/openrouter.ts`
- Env vars include `VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_MODEL`, `VITE_OPENROUTER_FALLBACK_MODELS`.

Classification:

- Preserve provider abstraction and env names.
- Refactor cost visibility into an AI Cost Dashboard fed by stored execution/cost events.
- Deprecate untracked direct OpenRouter calls from UI or n8n.

## Existing Meta Integrations

- Meta OAuth start/callback route pair.
- Meta OAuth connection store with business/page/WABA/phone/Instagram asset metadata.
- Unified Meta webhook and WhatsApp-compatible webhook routes.
- Webhook routing to owner based on OAuth asset matches.
- Lead knowledge normalization for WhatsApp, Instagram, and Facebook.
- Tests cover OAuth callback, webhook routing, and WhatsApp qualification.

Classification:

- Preserve all routes, verification, env vars, and storage contracts.
- Refactor only to emit/record workflow trigger metadata after Leadsy has accepted and stored events.
- Do not make n8n the public Meta webhook endpoint in this phase.

## Existing WhatsApp Integrations

- WhatsApp inbound/outbound/status parsing in Meta webhook stores.
- WhatsApp knowledge channel normalization.
- WhatsApp Web extension task execution and status reporting.
- WhatsApp lead status route.

Classification:

- Preserve message handling and storage.
- Refactor automation-style reply suggestions, follow-up due checks, and qualification requests into n8n-triggerable workflows.
- Deprecate any UI language implying autonomous WhatsApp sends.

## Existing Extension Integrations

- Extension manifest, background worker, content scripts, side panel.
- Leadsy client with bearer token calls.
- Token CRUD in `/api/extension/tokens`.
- Conversation sync, context, reply, capture, copilot, and task lifecycle APIs.
- Tests cover automation, side panel, task tabs, page scope, storage, safety, OpenRouter fallback, and e2e smoke.

Classification:

- Preserve extension as capture and execution layer.
- Refactor admin visibility around worker health, queue status, and failed executions.
- Do not move workflow orchestration into the extension.

## Existing Authentication Architecture

- Signed `leadsy_session` cookie from `apps/web/src/lib/auth.ts`.
- Secret priority: `LEADSY_AUTH_SECRET`, `AUTH_SECRET`, local dev fallback.
- Session storage is currently JSON-file backed through `apps/web/src/lib/auth-store.ts`.
- Roles: `owner`, `admin`, `client` in runtime auth store; Prisma also defines `owner`, `admin`, `revops`, `manager`, `sdr`, `viewer`, `client`.
- API protection uses `apps/web/src/lib/api-auth.ts`, `@leadsy/security` permissions, rate limiting, and audit logging.
- Extension APIs use bearer-token auth in `apps/web/src/lib/extension-auth.ts`.

Classification:

- Preserve Next.js as authentication, RBAC, tenant isolation, and API access layer.
- Refactor session/business storage toward Postgres-backed repositories in a separate data migration phase.
- Do not put authentication or authorization into n8n.

## Existing Railway / Deployment Configuration

Repository-visible deployment config:

- `.github/workflows/railway-web.yml` runs lint, typecheck, test, and build on PRs and pushes to `main`.
- `apps/web/Dockerfile` builds the Next.js app with Node 22 Alpine and runs `npm --workspace @leadsy/web run start`.
- `docker-compose.yml` has `web`, `postgres` using `pgvector/pgvector:pg16`, and `redis:7-alpine`.
- `vercel.json` contains a health cron but Railway is the production target described by project instructions.

Current local service state:

- `leadsy-web-1` listens on `3000`.
- `leadsy-postgres-1` listens on `5432`.
- `leadsy-redis-1` listens on `6379`.
- `GET /api/health` returned `{ ok: true, service: "leadsy-web" }`.

Classification:

- Preserve web deployment and CI/CD.
- Add n8n as a separate Railway service in the same Railway project.
- Do not change the existing web service deploy command or environment variables unless a later implementation explicitly requires additive n8n status variables.

## Existing Database Schema

Prisma datasource:

- Provider: PostgreSQL.
- URL: `DATABASE_URL`.
- pgvector is used through `Unsupported("vector(1536)")` on `Account.embedding`.

Models:

- `Tenant`
- `User`
- `AuthSession`
- `Account`
- `Contact`
- `Lead`
- `Deal`
- `Activity`
- `Campaign`
- `AgencyClient`
- `LeadMagnetSource`
- `DiscoveredLead`
- `MetaLead`
- `QualificationSnapshot`
- `WhatsAppConversation`
- `WhatsAppMessage`
- `FollowUpTask`
- `Workflow`
- `AuditLog`

Enums:

- `Role`
- `DealStage`
- `Channel`

Important mismatch:

- The repository has a Postgres schema, but active route handlers and UI pages currently read/write many production-critical objects through JSON-file stores under `LEADSY_DATA_DIR`: `auth.json`, `extension.json`, `lead-knowledge.json`, `crm.json`, `meta-oauth.json`, and related files.
- The backend evolution should preserve working behavior first, then introduce durable Postgres-backed automation metadata and dashboards incrementally. n8n must never become the store of record for these objects.

## Subsystem Preserve / Refactor / Deprecate

| Subsystem | Preserve | Refactor | Deprecate |
| --- | --- | --- | --- |
| Next.js backend | Route handlers, auth, RBAC, tenant isolation, API contracts | Add internal automation/status APIs for n8n and admin dashboards | Any rewrite or backend replacement |
| Postgres | Existing Prisma schema, `DATABASE_URL`, pgvector direction | Add automation execution/workflow/cost metadata tables in a later migration | JSON-file business state as long-term source of truth |
| JSON stores | Current behavior and tests | Gradual repository migration to Postgres | Treating file stores as production durable |
| n8n | Not currently present | Add as separate automation service only | Business state, auth, tenant logic, public webhook ownership |
| Meta | OAuth, webhooks, routing, env vars | Emit automation trigger metadata after storage | Public Meta webhook directly to n8n |
| WhatsApp | Webhook parsing, knowledge storage, extension execution lane | Follow-up and qualification orchestration through n8n | Autonomous sends |
| OpenRouter | Provider abstraction, env vars, cost controls | Cost dashboard per workflow/execution | Direct UI/n8n model calls bypassing Leadsy |
| Extension | Capture/execution layer and bearer auth | Health/status visibility | Workflow engine role |
| Events | Existing event names and in-memory API | Durable event/execution persistence | Silent in-memory-only production workflow history |
| Queues | Extension task lifecycle | n8n retries/schedules around Leadsy APIs | In-memory queue claims as durable production queue |
| Railway | Existing web service and CI workflow | Separate n8n service plan | Ad hoc `railway up` for normal deploy |

## Automation Migration Candidates

Move only orchestration-style logic:

- Research requested
- Qualification requested
- Reminder/follow-up due checks
- Approval routing
- Task-generated notifications
- Worker retry orchestration
- Meta lead received post-storage workflow
- WhatsApp message received post-storage workflow

Do not move:

- Authentication
- Authorization/RBAC
- Tenant isolation
- Lead CRUD
- Knowledge CRUD
- Task CRUD
- Communication storage
- Meta/WhatsApp webhook verification
- Database repositories

## Immediate Risks Before Backend Evolution

- The local Docker service and current source tree appear out of sync for several routes.
- Active state stores are JSON backed despite a Postgres schema existing.
- n8n health/workflow/execution visibility needs new Leadsy-owned metadata and status APIs; adding only an iframe/link would not satisfy auditability.
- OpenRouter costs are calculated in memory/result payloads but do not appear to be durably persisted per workflow.
- Existing tests are broad and should be run sequentially because this project is resource-constrained.
