# Final Migration Report

Status: backend/n8n migration slice deployed; Lovable operator UI port is being shipped as the next production frontend change.

## What Changed

- Captured baseline UI screenshots in `docs/ui-baseline/`.
- Created a Lovable redesign project for Leadsy:
  - `https://lovable.dev/projects/0374c950-90bb-46e8-a818-064efc632c74`
- Added read-only infrastructure and automation visibility APIs:
  - `GET /api/infrastructure/automation/status`
  - `GET /api/infrastructure/automation/workflows`
  - `GET /api/infrastructure/automation/executions`
  - `GET /api/infrastructure/health`
  - `GET /api/ai/costs`
- Added Settings -> Infrastructure -> Automation visibility inside Leadsy.
- Moved the automation workflow catalog into `@leadsy/workflows`.
- Added source-controlled n8n blueprint generation.
- Added one importable inactive n8n Automation Router workflow JSON under `packages/workflows/n8n/`.
- Added the n8n Provider Config Hub for Meta, WhatsApp, Email, and OpenRouter automation configuration.
- Added `npm run workflows:export-n8n`.
- Added `npm run test:n8n-workflows`.
- Created a separate Railway service named `n8n`.
- Verified the n8n service health endpoint returns HTTP 200.

## What Stayed

- Next.js remains the application backend.
- PostgreSQL remains the durable data store.
- Existing API routes remain present.
- Existing authentication, RBAC, and tenant boundaries remain in Leadsy.
- Existing Meta OAuth/webhook implementation remains in Leadsy.
- Existing WhatsApp handling remains in Leadsy.
- Existing OpenRouter env names remain documented and preserved for fallback/migration compatibility.
- Existing browser extension architecture remains the capture/execution layer.
- Existing Railway web service remains the web deployment target.
- Existing GitHub Actions CI remains the release gate for `main`.

## New Workflows

The n8n production service now uses one inactive workflow for easier configuration:

- `Leadsy - Automation Router`

The router supports these event types through one data-driven `Dispatch Automation` node instead of one visible branch per event:

- Lead Added
- Lead Updated
- Research Requested
- Qualification Requested
- Task Generated
- Approval Requested
- Follow-up Due
- Meta Lead Received
- WhatsApp Message Received
- Worker Retry

The router also includes one `Provider Config Check` node. It reads provider readiness from the n8n service environment and reports only non-secret status metadata to Leadsy.

n8n-owned provider config groups:

- Meta
- WhatsApp
- Email
- OpenRouter

Source files:

- `packages/workflows/src/automation-catalog.ts`
- `packages/workflows/src/n8n-blueprints.ts`

Generated files:

- `packages/workflows/n8n/leadsy-automation-router.json`
- `packages/workflows/n8n/index.json`

## New Railway Services

### n8n

- Service name: `n8n`
- Service ID: `4f5fec76-72ac-4b07-b2c4-452ef03e8449`
- URL: `https://n8n-production-3749.up.railway.app`
- Image: `docker.n8n.io/n8nio/n8n:stable`
- Latest verified deployment: `47eb448c-a4c2-4866-b9e3-115bc21861af`
- Health: `GET /healthz` returned HTTP 200
- Database: existing Railway Postgres, with `n8n_` table prefix
- Execution mode: regular
- Redis: not connected because production Railway Redis is not present

## Risks

- n8n is live and the single `Leadsy - Automation Router` workflow is imported but inactive.
- The workflow JSON references future Leadsy automation action endpoints such as `/api/automation/events/*`; those endpoints still need implementation before activation.
- Durable execution metadata and AI cost persistence still need Postgres-backed tables/repositories.
- Provider credentials must be added to the n8n service or n8n credentials before provider-backed automation branches are activated.
- `N8N_PUBLIC_URL` and `N8N_HEALTH_TIMEOUT_MS` were confirmed on the web service with `--skip-deploys`; `N8N_INTERNAL_URL` timed out and should be retried later if private networking is preferred.
- n8n Postgres SSL uses `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` because Railway Postgres presented a self-signed certificate chain to n8n. Prefer CA-backed validation if Railway exposes the CA.
- The Lovable dashboard/app-shell/auth port is implemented on the current feature branch and still needs CI/Railway deployment.

## Remaining Work

- Retry optional private web service variable:
  - `N8N_INTERNAL_URL`
- Implement service authentication for n8n-to-Leadsy calls.
- Implement Leadsy automation action endpoints.
- Add Postgres-backed automation execution metadata.
- Add Postgres-backed AI usage/cost ledger.
- Add Meta, WhatsApp, Email, and OpenRouter provider credentials to the n8n service.
- Review credentials in n8n and activate the single Automation Router after Leadsy action endpoints are ready.
- Add Redis to Railway and move n8n to queue mode if automation volume requires it.
- Complete the full CRM/Workers/Approvals detail-page redesign after the dashboard/app-shell port lands.

## Rollback Plan

1. Keep the existing Leadsy web service running.
2. Pause or leave inactive the n8n Automation Router.
3. Remove or leave unset web `N8N_*` variables if the admin dashboard should show n8n as unavailable.
4. Stop the Railway `n8n` service if it causes resource pressure.
5. Do not route Meta or WhatsApp public webhooks to n8n.
6. Revert the workflow-definition commit if the generated JSON/package exports cause app issues.
7. Roll back the web service only through the existing GitHub main plus Railway flow.

## Verification

Local verification passed:

- `npm run test:n8n-workflows`
- `npm run test:phase-one-routes`
- `npm run test:preserved-integrations`
- `npm run test:openrouter-cost`
- `npm run test:user-facing-surface`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Deployment verification:

- GitHub Actions `Web CI` passed on `main` after the migration commits.
- Railway web deployment succeeded on `main` after CI.
- Railway n8n service deployment succeeded.
- Leadsy public health returned HTTP 200.
- n8n public health returned HTTP 200.

Use these commands to retrieve the latest exact IDs:

```bash
gh run list --branch main --limit 3 --json databaseId,headSha,status,conclusion,workflowName,url
railway deployment list --service @leadsy/web --json --limit 3
railway deployment list --service n8n --json --limit 3
```
