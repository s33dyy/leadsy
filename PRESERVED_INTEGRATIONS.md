# Preserved Integrations

Step 3 preservation boundary: UI-only refactors must not change integration logic, routes, authentication, storage, provider routing, deployment wiring, or tenant isolation. Future UI work can wrap, link to, or display these integrations, but it must not replace or bypass the underlying implementation.

## Meta Lead Ads

- Preserve the existing Meta ingestion surface at `apps/web/src/app/api/meta/webhook/route.ts`.
- Preserve routed Meta payload handling in `apps/web/src/lib/meta-webhook-routing.ts`.
- Preserve `META_LEAD_ADS_PAGE_ACCESS_TOKEN`, `META_VERIFY_TOKEN`, `META_APP_ID`, and `META_APP_SECRET` exactly as named.
- UI refactors may add connection/status views, but must not alter webhook verification, lead routing, or token storage.

## Meta OAuth

- Preserve `/api/meta/oauth/callback` and its callback URL construction.
- Preserve `exchangeMetaOAuthCode`, `saveMetaOAuthConnection`, channel readiness extraction, and token redaction in `apps/web/src/lib/meta-oauth-store.ts`.
- Preserve session-gated OAuth completion and audit logging.
- UI refactors may change connection screens, but must not change OAuth configuration, scopes, env names, redirect handling, token exchange, or token storage.

## Meta Webhooks

- Preserve webhook challenge handling through `verifyMetaWebhookChallenge`.
- Preserve request signature verification through `verifyMetaWebhookSignature`.
- Preserve route handlers at `/api/meta/webhook` and `/api/meta/whatsapp/webhook`.
- UI refactors must not rename or remove webhook endpoints, verification parameters, signature behavior, or routing into the lead knowledge store.

## WhatsApp

- Preserve WhatsApp webhook storage in `apps/web/src/lib/meta-whatsapp-webhook-store.ts`.
- Preserve WhatsApp contact/conversation normalization and `whatsappConversationUrl`.
- Preserve `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID` exactly as named.
- UI refactors may add logging and status views, but must not introduce autonomous outreach sends from the UI.

## OpenRouter / AI providers

- Preserve the existing provider abstractions in `packages/ai/src/index.ts` and the extension OpenRouter client in `apps/extension/src/core/openrouter.ts`.
- Preserve fallback model handling, max token controls, JSON response formatting, and the OpenRouter chat completions endpoint.
- Preserve `AI_PROVIDER`, `AI_GATEWAY_API_KEY`, `OPENROUTER_API_KEY`, and `OPENROUTER_BASE_URL` exactly as named.
- UI refactors may expose model/status choices, but must not generate new keys, hardcode secrets, bypass provider abstraction, or add redundant AI calls.

## Browser Extension endpoints

- Preserve bearer-token authentication in `apps/web/src/lib/extension-auth.ts`.
- Preserve extension sync, reply, task, token, and capture endpoint routes under `/api/extension/*`.
- Preserve `syncLeadsyExtensionConversation`, `syncExtensionConversation`, task status flow, audit logging, and tenant-scoped rate limits.
- UI refactors may display extension status or task queues, but must not weaken extension auth or change sync payload contracts.

## Workers

- Preserve workflow definitions and execution in `packages/workflows/src/index.ts`.
- Preserve extension task routes and task state handling under `/api/extension/tasks/*`.
- Preserve event publication for workflow execution.
- UI refactors may provide operator controls and approval surfaces, but must not change worker scheduling, task execution semantics, or background-job behavior.

## Knowledge Systems

- Preserve `apps/web/src/lib/lead-knowledge-store.ts` as the active lead knowledge storage/update mechanism.
- Preserve Meta webhook, extension conversation, manual-message, and context-building paths into the knowledge store.
- Preserve tenant and owner scoping on lead knowledge records.
- UI refactors may add notes, timelines, and knowledge panels, but note/task/communication mutations must route through existing knowledge update mechanisms.

## Event System

- Preserve `packages/events/src/index.ts`, including `InMemoryEventBus`, `subscribe`, `publish`, and `eventBus`.
- Preserve current event names until a deliberate event migration is designed and tested.
- UI refactors must not replace the event bus or silently remove event publication from workers.

## Security/Auth

- Preserve signed session cookies in `apps/web/src/lib/auth.ts`.
- Preserve `requireApiSession`, `assertPermission`, `rateLimit`, `audit`, and session/extension auth boundaries.
- Preserve `AUTH_SECRET`, `SESSION_COOKIE_NAME`, and existing cookie security attributes.
- UI refactors may change forms and navigation, but must not weaken auth, RBAC, audit logging, rate limits, or route protection.

## Tenant Logic

- Preserve `tenantId` and `ownerId` scoping in stores, routes, workers, extension endpoints, OAuth storage, and knowledge records.
- Preserve database tenant indexes and relationships in `packages/db/prisma/schema.prisma`.
- UI refactors must not combine tenant data, remove tenant filters, or introduce cross-tenant shortcuts.
