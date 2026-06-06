# DEPLOYMENT VERIFICATION REPORT

Generated for the Leadsy Twilio CRM transformation on 2026-06-06.

## Current Status

This report is initialized during feature-branch implementation. Final production values must be filled after:

1. The feature branch is merged into `main`.
2. `main` is pushed to GitHub.
3. GitHub Actions passes on the exact `main` commit.
4. Railway deploys the `@leadsy/web` service from that exact commit.
5. The separate Railway `n8n` service health is verified.

## GitHub Actions

- Main branch commit: Pending merge to `main`.
- GitHub Action Run ID: Pending main-branch CI run.
- Required result: Success.

## Railway Web Deployment

- Service: `@leadsy/web`
- Deployment source: GitHub `main`
- Required commit match: Pending merge to `main`.
- Railway Deployment ID: Pending production deployment.
- Health endpoint: `https://leadsy.up.railway.app/api/health`
- Required result: HTTP 200 with `ok: true`.

## Twilio Webhook URLs

- Inbound webhook: `https://leadsy.up.railway.app/api/twilio/webhook`
- Delivery status callback: `https://leadsy.up.railway.app/api/twilio/status`

Required result:

- Publicly reachable HTTPS routes after web deployment.
- Twilio auth token configured as an environment secret.
- Webhook signature validation enabled when Twilio sends `X-Twilio-Signature`.
- No secrets exposed in Settings or report output.

## n8n Railway Service

- Service name: `n8n`
- Service ID: `4f5fec76-72ac-4b07-b2c4-452ef03e8449`
- Environment ID: `7b7fa246-b552-4a88-938c-672107c8dca4`
- Public URL: `https://n8n-production-3749.up.railway.app`
- Health endpoint: `https://n8n-production-3749.up.railway.app/healthz`

Required checks:

- Railway service status is active.
- Latest deployment status is successful.
- `/healthz` returns HTTP 200.
- Required env vars are present without printing values:
  - `DB_TYPE`
  - `DB_POSTGRESDB_HOST`
  - `DB_POSTGRESDB_DATABASE`
  - `DB_POSTGRESDB_USER`
  - `DB_POSTGRESDB_PASSWORD`
  - `N8N_ENCRYPTION_KEY`
  - `WEBHOOK_URL`
  - `N8N_HOST`
  - `N8N_EDITOR_BASE_URL`

## n8n Boundary Verification

n8n is limited to:

- Follow-Up Scheduling
- Reminder Generation
- Task Creation
- Escalation Rules

n8n must not own:

- Auth
- CRM
- Conversations
- Assignments
- Leads
- Qualification storage
- Twilio inbound or outbound message transport

## Local Verification Completed Before Final Deploy

- `npm run test:n8n-workflows`
- `npm run test:onboarding-surface`
- `npm run test:automation-gateway`

Final full verification still required before production complete:

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
