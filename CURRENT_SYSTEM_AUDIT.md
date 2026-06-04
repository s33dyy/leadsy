## 1. Routes Inventory

### Frontend Routes

| Route | File | Current purpose |
| --- | --- | --- |
| `/` | `apps/web/src/app/page.tsx` | Public landing page for the current Lead OS positioning. |
| `/login` | `apps/web/src/app/login/page.tsx` | Login and Google signup entry. Uses `LoginForm`. |
| `/logout` | `apps/web/src/app/logout/route.ts` | GET logout redirect route. |
| `/extension` | `apps/web/src/app/extension/page.tsx` | Private browser extension download and install guide. |
| `/app` | `apps/web/src/app/app/page.tsx` | Redirects to `/app/leads`. |
| `/app/connect` | `apps/web/src/app/app/connect/page.tsx` | Meta connection, webhook details, extension token pairing. |
| `/app/leads` | `apps/web/src/app/app/leads/page.tsx` | Current primary CRM/operator workspace over lead knowledge records. |
| `/app/magnet` | `apps/web/src/app/app/magnet/page.tsx` | Redirects to `/app/leads?notice=lead-magnet-archived`. |
| `/app/worker` | `apps/web/src/app/app/worker/page.tsx` | Browser worker pairing plus extension task board. |

Missing Phase 1 target routes: `/signup`, `/forgot-password`, `/dashboard`, `/crm`, `/workers`, `/settings`, `/approvals`, `/knowledge`, `/integrations`.

### API Routes

| Methods | Route | File | Current purpose |
| --- | --- | --- | --- |
| `POST` | `/api/admin/demo-seed` | `apps/web/src/app/api/admin/demo-seed/route.ts` | Token-gated demo seed endpoint, disabled unless env flag is set. |
| `GET` | `/api/auth/google` | `apps/web/src/app/api/auth/google/route.ts` | Starts Google OAuth with state and next cookies. |
| `GET` | `/api/auth/google/callback` | `apps/web/src/app/api/auth/google/callback/route.ts` | Completes Google OAuth, creates owner/workspace user session. |
| `POST` | `/api/auth/login` | `apps/web/src/app/api/auth/login/route.ts` | JSON password login. |
| `POST` | `/api/auth/login/form` | `apps/web/src/app/api/auth/login/form/route.ts` | Form fallback password login. |
| `POST` | `/api/auth/logout` | `apps/web/src/app/api/auth/logout/route.ts` | JSON logout. |
| `GET` | `/api/health` | `apps/web/src/app/api/health/route.ts` | Health and module counts. |
| `GET, POST` | `/api/extension/tokens` | `apps/web/src/app/api/extension/tokens/route.ts` | Session-authenticated extension token list/create. |
| `GET` | `/api/extension/context` | `apps/web/src/app/api/extension/context/route.ts` | Extension context endpoint. |
| `POST` | `/api/extension/conversations/sync` | `apps/web/src/app/api/extension/conversations/sync/route.ts` | Bearer-token extension conversation sync into extension and lead knowledge stores. |
| `POST` | `/api/extension/reply` | `apps/web/src/app/api/extension/reply/route.ts` | Bearer-token AI reply decision endpoint using lead knowledge context. |
| `POST` | `/api/extension/capture` | `apps/web/src/app/api/extension/capture/route.ts` | Bearer-token browser page capture into lead knowledge. |
| `POST` | `/api/extension/copilot` | `apps/web/src/app/api/extension/copilot/route.ts` | Extension copilot endpoint. |
| `GET` | `/api/extension/tasks` | `apps/web/src/app/api/extension/tasks/route.ts` | Lists active worker task states for the extension. |
| `POST` | `/api/extension/tasks/generate` | `apps/web/src/app/api/extension/tasks/generate/route.ts` | Generates queued extension tasks from lead knowledge records. |
| `POST` | `/api/extension/tasks/:taskId/approve` | `apps/web/src/app/api/extension/tasks/[taskId]/approve/route.ts` | Approves or cancels generated worker tasks. |
| `POST` | `/api/extension/tasks/:taskId/approve-send` | `apps/web/src/app/api/extension/tasks/[taskId]/approve-send/route.ts` | Human approval or rejection for prepared sends. |
| `POST` | `/api/extension/tasks/:taskId/claim` | `apps/web/src/app/api/extension/tasks/[taskId]/claim/route.ts` | Extension claims a task for execution. |
| `POST` | `/api/extension/tasks/:taskId/prepare` | `apps/web/src/app/api/extension/tasks/[taskId]/prepare/route.ts` | Extension prepares draft and moves task to send approval. |
| `POST` | `/api/extension/tasks/:taskId/complete` | `apps/web/src/app/api/extension/tasks/[taskId]/complete/route.ts` | Extension completes or blocks task and can append outbound message. |
| `POST` | `/api/extension/tasks/:taskId/events` | `apps/web/src/app/api/extension/tasks/[taskId]/events/route.ts` | Extension logs task lifecycle events. |
| `PATCH, DELETE` | `/api/extension/tasks/:taskId` | `apps/web/src/app/api/extension/tasks/[taskId]/route.ts` | Edits or soft-deletes extension tasks. |
| `GET, POST` | `/api/lead-magnet/brief` | `apps/web/src/app/api/lead-magnet/brief/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/brief/form` | `apps/web/src/app/api/lead-magnet/brief/form/route.ts` | Archived form compatibility redirect to `/app/leads`. |
| `POST` | `/api/lead-magnet/discover` | `apps/web/src/app/api/lead-magnet/discover/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/discover/form` | `apps/web/src/app/api/lead-magnet/discover/form/route.ts` | Archived form compatibility redirect to `/app/leads`. |
| `POST` | `/api/lead-magnet/discover/stream` | `apps/web/src/app/api/lead-magnet/discover/stream/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/draft` | `apps/web/src/app/api/lead-magnet/draft/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/import` | `apps/web/src/app/api/lead-magnet/import/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `PATCH, DELETE` | `/api/lead-magnet/leads/:leadId` | `apps/web/src/app/api/lead-magnet/leads/[leadId]/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/outreach` | `apps/web/src/app/api/lead-magnet/outreach/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/plan-preview` | `apps/web/src/app/api/lead-magnet/plan-preview/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/search/answer` | `apps/web/src/app/api/lead-magnet/search/answer/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/search/start` | `apps/web/src/app/api/lead-magnet/search/start/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/lead-magnet/search/stop` | `apps/web/src/app/api/lead-magnet/search/stop/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `GET` | `/api/lead-magnet/search/stream` | `apps/web/src/app/api/lead-magnet/search/stream/route.ts` | Archived compatibility route returning `lead_magnet_archived`. |
| `POST` | `/api/leads/manual-message` | `apps/web/src/app/api/leads/manual-message/route.ts` | Logs manual lead communication into knowledge store. |
| `POST` | `/api/leads/edit` | `apps/web/src/app/api/leads/edit/route.ts` | Edits lead knowledge contact, summary, next action, facts. |
| `POST` | `/api/leads/status` | `apps/web/src/app/api/leads/status/route.ts` | Includes/excludes lead from active lead set. |
| `POST` | `/api/leads/conversation-status` | `apps/web/src/app/api/leads/conversation-status/route.ts` | Includes/excludes a conversation from AI knowledge. |
| `POST` | `/api/leads/message-status` | `apps/web/src/app/api/leads/message-status/route.ts` | Hides/restores lead messages in timeline. |
| `POST` | `/api/leads/delete` | `apps/web/src/app/api/leads/delete/route.ts` | Archives lead knowledge record. |
| `GET` | `/api/meta/oauth/callback` | `apps/web/src/app/api/meta/oauth/callback/route.ts` | Completes Meta OAuth and stores connection summary. |
| `GET, POST` | `/api/meta/webhook` | `apps/web/src/app/api/meta/webhook/route.ts` | Unified Meta webhook verification and payload ingestion. |
| `POST` | `/api/meta/whatsapp/conversations/lead-status` | `apps/web/src/app/api/meta/whatsapp/conversations/lead-status/route.ts` | Sets Meta WhatsApp contact lead status. |
| `GET, POST` | `/api/meta/whatsapp/webhook` | `apps/web/src/app/api/meta/whatsapp/webhook/route.ts` | WhatsApp-compatible Meta webhook verification and payload ingestion. |

Archived compatibility routes under `/api/lead-magnet/*` still exist and return `410 lead_magnet_archived` or redirect forms to `/app/leads`.

### Webhook Routes

| Methods | Route | Verification | Storage/side effect |
| --- | --- | --- | --- |
| `GET, POST` | `/api/meta/webhook` | `hub.verify_token` challenge plus `x-hub-signature-256` using `META_APP_SECRET` when present. | Calls `saveRoutedMetaWebhookMessages`, routes to OAuth connection owner when possible, saves lead knowledge. |
| `GET, POST` | `/api/meta/whatsapp/webhook` | Same challenge/signature path as unified webhook. | Compatibility WhatsApp webhook path, also calls `saveRoutedMetaWebhookMessages`. |

## 2. Pages Inventory
(List every existing page/view with file path)

- Public landing page: `apps/web/src/app/page.tsx`
- Login/signup entry view: `apps/web/src/app/login/page.tsx`
- Extension download view: `apps/web/src/app/extension/page.tsx`
- App layout wrapper: `apps/web/src/app/app/layout.tsx`
- Workspace redirect: `apps/web/src/app/app/page.tsx`
- Connect/config view: `apps/web/src/app/app/connect/page.tsx`
- Leads/operator CRM view: `apps/web/src/app/app/leads/page.tsx`
- Archived Lead Magnet redirect view: `apps/web/src/app/app/magnet/page.tsx`
- Worker task center view: `apps/web/src/app/app/worker/page.tsx`

Important components/views:
- App shell/sidebar/topbar: `apps/web/src/components/app-shell.tsx`
- Login form: `apps/web/src/components/login-form.tsx`
- Extension pairing: `apps/web/src/components/extension-pairing.tsx`
- Extension task board: `apps/web/src/components/extension-task-board.tsx`
- Selected lead task panel: `apps/web/src/components/selected-lead-tasks.tsx`
- Archived Lead Magnet lab component still present: `apps/web/src/components/lead-magnet-lab.tsx`

## 3. Workers Inventory
(List every background job, cron, queue worker)

- Browser extension worker/background service: `apps/extension/src/background/index.ts`. Pulls task queue, opens task tabs, runs selected batches only, prepares/completes/logs tasks against `/api/extension/tasks/*`.
- Browser content automation controller: `apps/extension/src/content/automation.ts`. Arms supported chat pages, observes messages, syncs conversations, prepares or executes selected tasks, and uses human approval rules.
- Extension task tab helper: `apps/extension/src/background/task-tabs.ts`. Reuses/focuses WhatsApp, Instagram, Facebook, Messenger, or generic target tabs.
- In-app worker task APIs: `apps/web/src/app/api/extension/tasks/*`. These are synchronous route handlers, not a separate queue worker.
- Workflow runner: `packages/workflows/src/index.ts`. Provides typed DAG workflow simulation and publishes `workflow.executed` to the in-memory event bus.
- Vercel cron config: `vercel.json` calls `/api/health` every 15 minutes only.

No BullMQ, Temporal, Trigger.dev, Redis-backed queue worker, or server-side cron worker is currently implemented. Docs identify those as production direction.

## 4. Integrations Inventory

### Meta Lead Ads

- Prisma contains `MetaLead`, `QualificationSnapshot`, `FollowUpTask`, and `AgencyClient` relationships.
- Domain package contains seeded/static Meta lead concepts and workflow nodes.
- Current active webhook handling is message/webhook oriented, not a full Meta Lead Ads form ingestion endpoint named `/api/meta/leads`.
- Preserve `packages/db/prisma/schema.prisma`, `packages/domain/src/index.ts`, and all Meta routes.

### Meta OAuth

- `apps/web/src/lib/meta-oauth-store.ts` exchanges OAuth codes at `https://graph.facebook.com/oauth/access_token`.
- Stores OAuth connection records in `data/app/meta-oauth.json` when present.
- Tracks access token preview, expiry, business/page/WABA/phone/Instagram asset ids, and channel readiness.
- UI lives in `/app/connect`, using `META_EMBEDDED_SIGNUP_URL` for the connect CTA.

### Meta Webhooks

- `apps/web/src/app/api/meta/webhook/route.ts`
- `apps/web/src/app/api/meta/whatsapp/webhook/route.ts`
- `apps/web/src/lib/meta-webhook-routing.ts`
- `apps/web/src/lib/meta-whatsapp-webhook-store.ts`
- `apps/web/src/lib/lead-knowledge-store.ts`

Webhook payloads are verified, parsed, routed to a matching Meta OAuth connection when assets match, and saved into lead knowledge. Unmatched/ambiguous counts are returned.

### WhatsApp

- WhatsApp webhook compatibility route exists at `/api/meta/whatsapp/webhook`.
- `meta-whatsapp-webhook-store.ts` parses inbound/outbound WhatsApp message fields, referral context, contact ids, and status.
- `lead-knowledge-store.ts` normalizes WhatsApp/Instagram/Facebook webhook messages into the unified knowledge store.
- The extension supports WhatsApp Web task execution and conversation sync.
- Direct WhatsApp Cloud outbound send adapter is not currently implemented in active API routes.

### OpenRouter / AI providers

- Server AI logic: `packages/ai/src/index.ts` and `packages/ai/src/research-tools.ts`.
- Extension AI fallback: `apps/extension/src/core/openrouter.ts`.
- Server model envs: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_FAST_MODEL`, `OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_DOSSIER_MODEL`, `OPENROUTER_SENTIMENT_MODEL`, `AI_DEFAULT_MODEL`, `AI_PROVIDER`, `AI_GATEWAY_*`.
- Extension envs: `VITE_OPENROUTER_API_KEY`, `VITE_OPENROUTER_MODEL`, `VITE_OPENROUTER_FALLBACK_MODELS`.
- Cost guards exist in `packages/ai/src/index.ts` with spend-cap envs and expensive-model checks.
- Research tools search/fetch public sources first, with configured API, Brave, Bing, DuckDuckGo, and Mojeek paths.

### Browser Extension endpoints

- Token auth: `/api/extension/tokens`
- Context: `/api/extension/context`
- Conversation sync: `/api/extension/conversations/sync`
- Reply decision: `/api/extension/reply`
- Page capture: `/api/extension/capture`
- Copilot: `/api/extension/copilot`
- Task queue and lifecycle: `/api/extension/tasks`, `/api/extension/tasks/generate`, `/api/extension/tasks/:taskId/*`
- Client implementation: `apps/extension/src/core/leadsy-client.ts`, `apps/extension/src/background/index.ts`, `apps/extension/src/sidepanel/index.ts`

### Any other third-party

- Google OAuth: `/api/auth/google` and `/api/auth/google/callback`; envs `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- Railway deployment via `.github/workflows/railway-web.yml`.
- Docker Compose for local web, Postgres, Redis: `docker-compose.yml`.
- Vercel config and health cron: `vercel.json`.
- Public search APIs: configured search API, Brave, Bing, DuckDuckGo/Mojeek HTML fallback in `packages/ai/src/research-tools.ts`.
- Frankfurter exchange rate API appears in `packages/ai/src/index.ts` for USD to INR cost conversion fallback.

## 5. Environment Variables
(List all .env keys - DO NOT include values)

Keys present in `.env.example` and `.env.local`:

- `AI_DEFAULT_MODEL`
- `AI_GATEWAY_API_KEY`
- `AI_GATEWAY_BASE_URL`
- `AI_PROVIDER`
- `APP_ENV`
- `AUDIT_LOG_SINK`
- `AUTH_SECRET`
- `BING_SEARCH_API_KEY`
- `BING_SEARCH_ENDPOINT`
- `BRAVE_SEARCH_API_KEY`
- `BROWSER_WORKER_PROVIDER`
- `DATABASE_READ_REPLICA_URL`
- `DATABASE_URL`
- `EVENT_BUS_DRIVER`
- `LEADSY_AI_PLANNER_ENABLED`
- `LEADSY_DATA_DIR`
- `LEADSY_RESEARCH_BATCH_SIZE`
- `LEADSY_RESEARCH_DOMAIN_COOLDOWN_MS`
- `LEADSY_RESEARCH_FETCH_CACHE_TTL_MS`
- `LEADSY_RESEARCH_MAX_PAGES_PER_DOMAIN`
- `LEADSY_RESEARCH_MIN_DELAY_MS`
- `LEADSY_RESEARCH_RETRY_AFTER_MAX_MS`
- `LEADSY_RESEARCH_ROBOTS_TTL_MS`
- `LEADSY_RESEARCH_USER_AGENT`
- `LEADSY_SEARCH_API_KEY`
- `LEADSY_SEARCH_API_URL`
- `LEADSY_SEARCH_LIMIT_PARAM`
- `LEADSY_SEARCH_QUERY_PARAM`
- `LEADSY_SPEND_CAP_INR`
- `LEAD_DISCOVERY_DAILY_LIMIT`
- `LINKEDIN_CONNECTOR_WEBHOOK_URL`
- `LOG_LEVEL`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_EMBEDDED_SIGNUP_URL`
- `META_LEAD_ADS_PAGE_ACCESS_TOKEN`
- `META_VERIFY_TOKEN`
- `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `NEXT_PUBLIC_APP_URL`
- `NODE_ENV`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_DOSSIER_MODEL`
- `OPENROUTER_FAST_MODEL`
- `OPENROUTER_RESEARCH_MODEL`
- `OPENROUTER_SENTIMENT_MODEL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OUTBOUND_REQUIRE_APPROVED_SOURCE`
- `QUEUE_DRIVER`
- `REDIS_URL`
- `SESSION_COOKIE_NAME`
- `SMTP_HOST`
- `SMTP_PASSWORD`
- `SMTP_PORT`
- `SMTP_USER`
- `WEBSOCKET_URL`
- `WHATSAPP_BUSINESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

Additional env names referenced in code/scripts/config, but not necessarily present in `.env.example`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `INIT_CWD`
- `LEADSY_AUTH_SECRET`
- `LEADSY_BASE_URL`
- `LEADSY_CAMPAIGN_DRY_BATCH_LIMIT`
- `LEADSY_CAMPAIGN_MAX_BATCHES`
- `LEADSY_CAMPAIGN_SPEND_CAP_INR`
- `LEADSY_DEFAULT_SPEND_CAP_INR`
- `LEADSY_DEMO_OWNER_PASSWORD`
- `LEADSY_DEMO_SEED_ENABLED`
- `LEADSY_DEMO_SEED_TOKEN`
- `LEADSY_META_OWNER_ID`
- `LEADSY_META_TENANT_ID`
- `LEADSY_REQUIRE_API_REGRESSION`
- `LEADSY_TEST_EMAIL`
- `LEADSY_TEST_PASSWORD`
- `RAILWAY_PUBLIC_DOMAIN`
- `USD_INR_RATE`
- `VITE_LEADSY_BASE_URL`
- `VITE_OPENROUTER_API_KEY`
- `VITE_OPENROUTER_FALLBACK_MODELS`
- `VITE_OPENROUTER_MODEL`

## 6. Database Schema
(Tables/collections, key columns, relationships)

Prisma schema file: `packages/db/prisma/schema.prisma`.

Enums:
- `Role`: `owner`, `admin`, `revops`, `manager`, `sdr`, `viewer`, `client`
- `DealStage`: `qualified`, `discovery`, `technical_win`, `proposal`, `commit`
- `Channel`: `email`, `linkedin`, `phone`, `whatsapp`, `chat`, `ads`

Models and key relationships:
- `Tenant`: root tenant with users, accounts, clients, lead magnet sources, discovered leads, audit logs.
- `User`: tenant-scoped user with role, optional client portal relationship, sessions, owned accounts.
- `AuthSession`: tenant/user session with token hash and expiry.
- `Account`: tenant-scoped company/account, owner, contacts, leads, deals, activities, optional vector embedding.
- `Contact`: tenant/account contact, unique tenant email, leads, activities.
- `Lead`: account/contact lead with source, score, intent/ICP score, status, reason.
- `Deal`: account deal with stage, forecast, value, probability, close date, risk.
- `Activity`: account/contact timeline item.
- `Campaign`: tenant campaign with channels and campaign metrics.
- `AgencyClient`: tenant client workspace with onboarding fields, performance metrics, portal users, Meta leads, lead magnet sources, discovered leads, WhatsApp conversations.
- `LeadMagnetSource`: tenant/client source with limits and daily found/qualified counts.
- `DiscoveredLead`: tenant/client/source lead candidate with contact/social fields, score, consent, outreach status, suggested message.
- `MetaLead`: tenant/client Meta inbound lead with campaign fields, qualification, conversations, follow-ups.
- `QualificationSnapshot`: one-to-one Meta lead score and next best action.
- `WhatsAppConversation`: tenant/client/Meta lead conversation with suggested reply, status, messages.
- `WhatsAppMessage`: conversation message with direction, body, content type, delivery status.
- `FollowUpTask`: Meta lead follow-up task with channel, due date, title, automation, status.
- `Workflow`: tenant workflow definition JSON, version, active flag.
- `AuditLog`: tenant audit row with actor, action, resource, metadata.

Current local stores used by the app runtime:
- `data/app/auth.json`: users and sessions.
- `data/app/agency-clients.json`: agency clients.
- `data/app/extension.json`: extension tokens, conversations, messages, events, tasks, task events.
- `data/app/lead-knowledge.json`: unified leads, conversations, messages.
- `data/app/lead-magnet.json`: archived lead brief, lead dossiers, runs, drafts, agent runs, search sessions.
- `data/postgres`: local Postgres/pgvector Docker data.
- `data/redis`: local Redis Docker data.

Risk note: the Prisma production-shaped schema is not the active persistence path for most current web app operations.

## 7. Background Jobs
(What they do, trigger mechanism, frequency)

- Vercel health cron: `vercel.json` triggers `/api/health` every 15 minutes.
- Extension selected batch runner: user-triggered from extension side panel through `leadsy:runSelectedTasks`; no automatic task polling on background boot per `scripts/extension-app-only-approval.test.ts`.
- Extension content observer: user arms it on a supported chat page; it observes DOM changes and syncs detected/inbound/reply events.
- Workflow runner: synchronous API/package function, not scheduled.
- Lead Magnet discovery workers: code remains in `packages/ai` and `lead-magnet-store`, but active `/api/lead-magnet/*` routes are archived shims.

No current server-side periodic enrichment, qualification, outreach, analytics, or Redis queue worker was found.

## 8. Knowledge Systems
(Any existing notes/knowledge/research storage)

- Primary active lead intelligence store: `apps/web/src/lib/lead-knowledge-store.ts`.
- Storage file: `data/app/lead-knowledge.json`.
- Lead records aggregate contact identity, status, summary, next action, facts, channels, conversations, and messages.
- Knowledge sources include Meta webhook messages, extension conversation sync, extension task sync, extension capture, and manual messages.
- `buildLeadKnowledgeContext` prepares business prompt, support notes, facts, and qualification hints for AI reply decisions.
- `syncLeadKnowledgeFromExtensionTasks` can create or update lead knowledge from worker-only tasks.
- `appendManualLeadMessage` is used for manual communication logs and browser capture notes.
- Archived Lead Magnet research memory still exists in `data/app/lead-magnet.json` and `apps/web/src/lib/lead-magnet-store.ts`.

Missing from Phase 1 spec today:
- No dedicated Notes CRUD model or API.
- No separate AI/Human/System note distinction beyond message direction/source/generatedBy fields.
- No explicit global knowledge route/page.

## 9. Event System
(Internal events, pub/sub, socket events)

- `packages/events/src/index.ts` exports `InMemoryEventBus` and `eventBus`.
- Event names include `lead.detected`, `meta.lead.ingested`, `qualification.scored`, `whatsapp.reply.generated`, `leadmagnet.discovery.completed`, `leadmagnet.outreach.queued`, `lead.enriched`, `lead.routed`, `sequence.started`, `deal.updated`, `workflow.executed`, `copilot.invoked`.
- `packages/workflows/src/index.ts` publishes `workflow.executed`.
- Extension task events are persisted separately in `data/app/extension.json` through `logExtensionTaskEvent`.
- No WebSocket server or SSE event stream is currently active for the main dashboard/CRM; docs mention WebSocket/SSE as future production direction.

## 10. Security Layer
(Auth middleware, RBAC, tenant isolation)

- Session signing: `apps/web/src/lib/auth.ts` uses HMAC-signed session cookies with `AUTH_SECRET` or `LEADSY_AUTH_SECRET`.
- Password hashing: `apps/web/src/lib/auth-store.ts` uses scrypt with per-user salt.
- Session storage: file-backed `data/app/auth.json`.
- Google OAuth: state cookie, next cookie, id token verification, email verification, session creation.
- API auth: `apps/web/src/lib/api-auth.ts` wraps `getSessionFromRequest` and `assertPermission`.
- Extension auth: `apps/web/src/lib/extension-auth.ts` resolves bearer token hashes from `extension-store`.
- RBAC: `packages/security/src/index.ts` maps roles to permissions (`crm:read`, `crm:write`, `ai:invoke`, `workflow:run`, `workflow:write`, `analytics:read`, `admin:manage`).
- Rate limiting: in-memory `rateLimit` in `packages/security`.
- Audit: `audit` logs structured JSON to stdout; Prisma `AuditLog` model exists but active routes do not write there.
- Tenant isolation: most active stores and routes pass `tenantId` and `ownerId`; helper `canAccessClient` exists for client access. Prisma has tenant-scoped indexes, but active local JSON writes rely on manual scoping.

## 11. Code Health

### What fully works

- Next.js app shell, landing, login, extension download, connect, leads, and worker routes are implemented in source.
- Password login and Google OAuth flows are implemented.
- Meta OAuth callback, connection storage, and connect UI are implemented.
- Meta webhook verification/signature parsing/routing is implemented.
- Extension token generation, bearer auth, sync, reply, capture, task queue, approval, prepare, complete, edit, soft-delete APIs are implemented.
- Lead knowledge store supports Meta, extension, task, capture, manual message, status, archive, edit, and context-building flows.
- Worker task UI supports generated tasks, columns, send approval, edit, delete, and event display.
- Tests exist for lead knowledge, extension store, extension approval, Meta OAuth, Meta webhook routing, Meta WhatsApp webhook, user-facing surface, and task-board layout.
- Railway CI/CD workflow and Dockerfile exist.

### What is partially implemented

- CRM surface exists at `/app/leads`, but target `/crm` three-column spec is not implemented. Current layout is two main columns and server-rendered query navigation.
- Communications logging exists, but through inline/server forms and a generic manual comm form, not modal sub-tabs with WA/fb/Mail/All plus call modal.
- Worker Center exists only as extension pairing plus task board, not the three-section configuration/approvals/feed layout.
- Approval flow exists for extension tasks and prepared sends, but no global `approval_item` queue or `/approvals` route exists.
- Dashboard KPIs/charts do not exist as a dedicated route. Current top metrics are basic lead counts inside `/app/leads`.
- Onboarding exists only as an `AgencyClient.onboardingCompletedAt` concept and agency-client helper, not a first-login modal wizard.
- Settings/config exists only in `/app/connect` and extension side panel, not `/settings`.
- Knowledge display exists in lead detail, but no full knowledge page or note CRUD.
- OpenRouter integration exists, but current default model envs are heavy (`openai/gpt-5.2`) unless overridden.
- Prisma schema exists but active runtime uses JSON stores for auth, lead knowledge, extension, and Lead Magnet.

### What is dead code

- `apps/web/src/components/lead-magnet-lab.tsx` remains large and feature-rich but its page redirects away and `/api/lead-magnet/*` routes return archived responses.
- `apps/web/src/lib/lead-magnet-store.ts` and `apps/web/src/lib/lead-magnet-campaign.ts` remain present while API access is archived.
- Docs reference older routes/components such as `/api/copilot`, `/api/workflows/run`, `whatsapp-inbox.tsx`, `pipeline-board.tsx`, and `meta-lead-lab.tsx` that are not present in the current source tree.
- Graphify output contains some duplicated node references to the external SSD archival copy; local `/Users/pratikchoudhuri/Documents/leadsy` files should be authoritative.

### What is broken

- `window.confirm` exists in `apps/web/src/components/lead-magnet-lab.tsx`, violating the no-browser-primitives rule even though the route is archived.
- `/signup` and `/forgot-password` routes are absent.
- App metadata still says "Leadsy Revenue OS" in `apps/web/src/app/layout.tsx`.
- Root `package.json` description still says "Leadsy Revenue OS".
- `/app/connect` and `/app/leads` use form redirects for mutations in several places instead of toast/modals/optimistic UI.
- There is no toast notification system, confirmation modal system, notification center, global approval queue, onboarding modal, settings search, or dashboard charting.
- Docs and `apps/web/AGENTS.md` are partly stale against current source.

## 12. Preserve List
(Explicitly list everything that must not change)

- Do not remove or rename existing API routes, including archived `/api/lead-magnet/*` compatibility routes.
- Preserve Meta OAuth flow and env names: `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_URL`.
- Preserve Meta webhook challenge/signature behavior and both webhook endpoints.
- Preserve WhatsApp webhook compatibility and parsing/store logic.
- Preserve OpenRouter/provider abstraction and all existing OpenRouter env names.
- Preserve extension endpoints, bearer-token auth, task lifecycle, side panel semantics, and extension package.
- Preserve `data/app`, `data/postgres`, and `data/redis` store locations.
- Preserve Prisma schema in Phase 1. No migrations in this pass.
- Preserve auth/session/cookie names and role/permission contract.
- Preserve Railway GitHub Actions deployment workflow and Railway IDs.
- Preserve Dockerfile, docker-compose, Vercel config, and production build command.
- Preserve all existing tests and CI checks.
- Preserve human-in-the-loop send approval. Do not introduce autonomous outreach sends.
- Preserve Lead Magnet archive responses until a deliberate product decision replaces them.

## 13. Refactor List
(What needs UI/UX changes only)

- Reposition product copy from Revenue OS / Lead OS / Lead Magnet toward AI Lead Intelligence and Operations.
- Add `/dashboard` or redirect `/` after auth to an operational dashboard with real KPI cards, charts, worker activity, and recent lead feed.
- Add `/crm` or realign `/app/leads` into the required three-column CRM with list, detail tabs, notes, jobs, and right-side knowledge/activity.
- Add modal-based Add Lead, CSV import, communication log, note CRUD, and task edit flows.
- Add note CRUD using the existing lead knowledge update path.
- Add task/job CRUD UI around existing extension task APIs before changing task logic.
- Add Worker Center three-section layout while reusing extension token, Meta OAuth, source health, task, and event APIs.
- Add `/settings` searchable settings surface that links/reuses connection and worker config state.
- Add first-login onboarding modal wizard using existing auth/agency-client concepts where possible, without schema migrations in Phase 1 unless explicitly approved.
- Replace browser primitives with modal/confirmation/toast UI.
- Replace redirect notices with toasts for mutations.
- Add global sidebar nav items and notification badge using existing routes first.
- Add responsive/mobile menu behavior.

## 14. Risk Map
(What is most likely to break and why)

- Auth and onboarding risk: current user store has no `onboarding_completed` flag; Prisma has `AgencyClient.onboardingCompletedAt`, but active auth is JSON-backed. Adding first-login onboarding must avoid schema churn and preserve session behavior.
- Persistence mismatch risk: Prisma suggests production relational storage, but active app uses JSON stores. UI work must call existing stores/APIs rather than assuming Prisma repositories exist.
- Meta webhook risk: routing depends on OAuth asset matching and default webhook scope envs. Changing connect UI or callback behavior can orphan incoming messages.
- Extension worker risk: human-in-the-loop approval is split between app API and extension selected-batch execution. Any task status rename can break extension side panel and tests.
- Knowledge update risk: many features converge into `lead-knowledge-store`. Notes/tasks/comms should reuse `appendManualLeadMessage`, `editLeadKnowledgeRecord`, or a small local extension of that store instead of creating a parallel knowledge source.
- Archived Lead Magnet risk: large dead UI still references archived APIs and one `window.confirm`. Re-enabling it accidentally would expose broken flows.
- Cost risk: default OpenRouter envs use heavy model names unless overridden. New onboarding AI questions must explicitly use cheap/fast model config and avoid redundant calls.
- UX mutation risk: current server form redirects are simple and reliable. Replacing with client mutations/toasts needs careful error handling and router refresh behavior.
- Tenant isolation risk: JSON stores rely on explicit tenant/owner parameters. New list/detail APIs must include these filters everywhere.
- CI/build risk: Next 16 and React 19 are in use. Client/server component boundaries and `server-only` imports must be respected.
- Machine risk: this Mac has limited memory. Do not run dev server, browser automation, lint/typecheck/build, and Docker simultaneously.
