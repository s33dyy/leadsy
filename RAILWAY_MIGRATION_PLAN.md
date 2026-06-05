# Railway Migration Plan: Add n8n Automation Service

Status: first implementation complete for service creation. The `n8n` Railway service exists and is healthy, while workflow import/activation remains gated.

## Goal

Add n8n as a separate Railway service in the existing Railway project while preserving the current Leadsy web deployment.

Target shape:

```text
Lovable-quality Leadsy frontend
  -> Next.js APIs
  -> Postgres
  -> n8n automation orchestration
  -> Leadsy APIs / Meta / WhatsApp / OpenRouter through approved adapters
```

Business state remains in Leadsy-owned storage and Postgres. n8n stores workflow definitions, execution logs, retry state, and orchestration metadata only.

## Non-Negotiables

- Do not modify the existing Railway web service deployment.
- Do not remove existing services.
- Do not rename existing environment variables.
- Do not point public Meta/WhatsApp webhooks directly at n8n in this phase.
- Do not store lead, task, knowledge, communication, auth, RBAC, tenant, or CRM state in n8n.
- Do not use ad hoc `railway up` for normal deployment.

## Existing Deployment Facts

Repository-visible:

- Web CI: `.github/workflows/railway-web.yml`.
- Web Dockerfile: `apps/web/Dockerfile`.
- Local compose: `docker-compose.yml` with `web`, `postgres`, and `redis`.
- Production instruction: Railway watches `main` and waits for GitHub Actions CI before production deploy.

Current local compose services:

- `leadsy-web-1`
- `leadsy-postgres-1`
- `leadsy-redis-1`

## New Railway Service

Name:

```text
n8n
```

Live service:

- Service ID: `4f5fec76-72ac-4b07-b2c4-452ef03e8449`
- Public URL: `https://n8n-production-3749.up.railway.app`
- Latest verified deployment: `47eb448c-a4c2-4866-b9e3-115bc21861af`
- Health check: `GET /healthz` returned HTTP 200 on 2026-06-05.
- Existing web service was not replaced or renamed.
- Railway Redis is not present in production; queue mode is deferred.

Placement:

- Same Railway project as the existing Leadsy web service.
- Separate service.
- Internal networking enabled.
- Connected to existing Postgres.
- Connected to existing Redis if present.

Image used:

```text
docker.n8n.io/n8nio/n8n:stable
```

The official n8n Docker docs recommend `stable` for production. Pin to an explicit tested version before a later high-volume automation rollout.

## Required n8n Variables

Add these only to the new `n8n` service unless explicitly needed by the web service for visibility:

- `N8N_ENCRYPTION_KEY`
- `N8N_HOST`
- `N8N_LISTEN_ADDRESS`
- `N8N_PORT`
- `N8N_PROTOCOL`
- `N8N_EDITOR_BASE_URL`
- `WEBHOOK_URL`
- `PORT`
- `GENERIC_TIMEZONE`
- `DB_TYPE`
- `DB_POSTGRESDB_HOST`
- `DB_POSTGRESDB_PORT`
- `DB_POSTGRESDB_DATABASE`
- `DB_POSTGRESDB_USER`
- `DB_POSTGRESDB_PASSWORD`
- `DB_POSTGRESDB_SCHEMA` if using a dedicated schema
- `DB_POSTGRESDB_SSL_ENABLED`
- `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED`
- `DB_TABLE_PREFIX`
- `QUEUE_BULL_REDIS_HOST`
- `QUEUE_BULL_REDIS_PORT`
- `QUEUE_BULL_REDIS_PASSWORD`
- `EXECUTIONS_MODE`
- `N8N_LOG_LEVEL`
- `N8N_DIAGNOSTICS_ENABLED`
- `N8N_VERSION_NOTIFICATIONS_ENABLED`

Recommended:

- `EXECUTIONS_MODE=regular` until a Railway Redis service exists.
- `EXECUTIONS_MODE=queue` when Redis is connected and worker mode is configured.
- `DB_TYPE=postgresdb`.
- `DB_TABLE_PREFIX=n8n_` when using the shared Postgres database to avoid table-name collision.
- `DB_POSTGRESDB_SCHEMA` can remain unset in the first phase because the service uses the default schema plus `DB_TABLE_PREFIX=n8n_`.
- `GENERIC_TIMEZONE=Asia/Kolkata`.
- Disable diagnostics/version notifications if the team wants minimal outbound telemetry.

Runtime note:

- Railway Postgres currently presents a self-signed certificate chain to n8n. `DB_POSTGRESDB_SSL_ENABLED=true` and `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` were required for n8n startup. Replace this with a CA-backed configuration if Railway exposes the CA certificate cleanly.

## n8n Provider Configuration Variables

Add automation provider configuration to the `n8n` service, not the existing `@leadsy/web` service. Leadsy keeps webhook intake, auth, tenant isolation, Postgres records, approvals, and audit state; n8n owns automation provider credentials.

Meta automation:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_GRAPH_VERSION`
- `META_LEAD_ADS_PAGE_ACCESS_TOKEN`

WhatsApp automation:

- `WHATSAPP_BUSINESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_SEND_MODE`

Email automation:

- `EMAIL_PROVIDER`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `RESEND_API_KEY`
- `POSTMARK_SERVER_TOKEN`

OpenRouter automation:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_FAST_MODEL`
- `OPENROUTER_RESEARCH_MODEL`
- `OPENROUTER_DOSSIER_MODEL`
- `OPENROUTER_SENTIMENT_MODEL`

Use n8n credentials for any provider where the built-in credential type is more ergonomic than service variables. Do not commit literal provider secrets into workflow JSON.

## Workflow Change Management

The single n8n workflow is intentionally editable from two places:

- Manual n8n edits for fast operational changes.
- GitHub/Codex edits in `packages/workflows/src/logic-modules.ts`, `provider-config.ts`, and `n8n-blueprints.ts` for reviewable source-controlled changes.

After manual n8n edits, export the workflow and copy durable rule changes back into the typed source files before the next GitHub-generated import. Otherwise the next Codex/GitHub export can overwrite manual canvas changes.

## Optional Web Service Variables

Add only when implementing the Leadsy admin automation visibility UI:

- `N8N_INTERNAL_URL`
- `N8N_PUBLIC_URL`
- `N8N_API_KEY`
- `N8N_HEALTH_TIMEOUT_MS`

These must be additive. Do not remove or rename existing Leadsy variables.

Current status:

- `N8N_PUBLIC_URL` and `N8N_HEALTH_TIMEOUT_MS` are confirmed on the web service with `--skip-deploys`.
- `N8N_INTERNAL_URL` timed out through Railway CLI and should be retried later.
- These variables are picked up by the next normal `main` deploy after CI:

```bash
railway variable set --service @leadsy/web \
  N8N_PUBLIC_URL=https://n8n-production-3749.up.railway.app \
  N8N_HEALTH_TIMEOUT_MS=2500 \
  --skip-deploys
```

Optional private networking retry:

```bash
railway variable set --service @leadsy/web \
  'N8N_INTERNAL_URL=http://${{n8n.RAILWAY_PRIVATE_DOMAIN}}:5678' \
  --skip-deploys
```

## Database Connection Strategy

Preferred:

- Use a dedicated Postgres database/schema for n8n execution storage.
- Use a dedicated database user with access limited to n8n tables/schema.
- Keep Leadsy business tables separate.

Acceptable first phase:

- Same Railway Postgres plugin/instance.
- Separate schema such as `n8n`.
- No direct n8n writes to Leadsy business tables.

Not allowed:

- n8n as the source of truth for leads, tasks, notes, knowledge, conversations, auth, or tenant records.

## Redis Connection Strategy

If Redis exists in the Railway project:

- Connect n8n queue mode to Redis through private networking.
- Keep Leadsy web Redis variables unchanged.
- Use n8n-specific Redis env vars in the n8n service.

If Redis does not exist in production:

- Start n8n in regular execution mode first.
- Add Redis in a later migration before high-volume schedules/retries.

## Leadsy Web Integration

Leadsy should expose read-only/admin status through Next.js APIs:

- `GET /api/infrastructure/automation/status`
- `GET /api/infrastructure/automation/workflows`
- `GET /api/infrastructure/automation/executions`
- `GET /api/infrastructure/health`
- `GET /api/ai/costs`

These routes should call n8n API/status endpoints and combine them with Leadsy-owned execution metadata from Postgres.

## Workflow Triggering Pattern

Preferred pattern:

1. External event hits existing Leadsy route.
2. Leadsy authenticates/verifies/rate-limits/audits.
3. Leadsy stores business state in Postgres.
4. Leadsy records workflow trigger metadata.
5. Leadsy invokes n8n internal webhook or n8n polls a Leadsy automation endpoint.
6. n8n performs orchestration.
7. n8n calls Leadsy APIs to update state or request approved actions.
8. Leadsy writes audit events and business state.

Do not bypass Leadsy for business mutations.

## Migration Sequence

1. Confirm current `main` CI is green and Railway web deploy is healthy.
2. Add n8n service in Railway UI or approved Railway workflow. Done.
3. Attach Postgres to n8n using a separate schema/database. First phase done with shared Postgres and `n8n_` table prefix.
4. Attach Redis if present and configure queue mode. Deferred because Railway Redis is not present.
5. Configure n8n encryption key and base URLs. Done.
6. Verify n8n health from Railway logs and public dashboard URL. Done.
7. Add additive Leadsy env vars for n8n visibility only.
8. Add Leadsy infrastructure/admin APIs.
9. Add Settings -> Infrastructure -> Automation UI.
10. Import the single inactive `Leadsy - Automation Router` workflow from `N8N_WORKFLOWS.md`.
11. Test the router dispatch path against staging/local-like data for each supported `workflowKey`.
12. Push through feature branch, CI on `main`, and Railway production deploy.
13. Confirm Railway production deployment hash matches successful `main` commit hash.

## Rollback Plan

If n8n causes issues:

1. Disable workflow triggers in Leadsy by toggling the additive automation flag introduced during implementation.
2. Leave existing Leadsy APIs active.
3. Pause the n8n Automation Router.
4. Keep n8n service running for log inspection.
5. If needed, remove n8n public URL exposure while preserving database logs.
6. Do not rollback the existing web service unless web-specific code changed and failed CI/deploy verification.

## Validation Checklist

- Existing web service still responds to `/api/health`.
- Existing Meta webhook verification still works.
- Existing WhatsApp webhook verification still works.
- Existing extension token and task APIs still work.
- Existing OpenRouter env vars remain unchanged.
- n8n can connect to Postgres.
- n8n can connect to Redis if configured.
- Leadsy Settings -> Infrastructure -> Automation can show n8n status.
- GitHub Actions passes on `main`.
- Railway deploys the exact successful `main` commit.
