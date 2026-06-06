# DEPLOYMENT VERIFICATION REPORT

Generated for the Leadsy Twilio CRM transformation on 2026-06-06.

Final verification recorded at `2026-06-06T13:36:07Z`.

## Current Status

Production verification passed for the Twilio CRM transformation release.

## GitHub Actions

- Main branch commit: `7dde88e968809482358a83e98a90e2fd92f41a45`
- GitHub Action Run ID: `27063383371`
- Workflow: `Web CI`
- Result: Success.
- URL: `https://github.com/s33dyy/leadsy/actions/runs/27063383371`

Note: GitHub emitted a Node.js 20 actions deprecation annotation for `actions/checkout@v4` and `actions/setup-node@v4`. It did not fail CI.

## Railway Web Deployment

- Service: `@leadsy/web`
- Service ID: `efa9e589-cdb9-4268-b255-4c663bb32150`
- Deployment source: GitHub `main`
- Deployed commit: `7dde88e968809482358a83e98a90e2fd92f41a45`
- Railway Deployment ID: `16233bc9-6a80-457e-8707-4d61262b989d`
- Deployment status: Success.
- Deployment created at: `2026-06-06T13:19:02.641Z`
- Health endpoint: `https://leadsy.up.railway.app/api/health`
- Health result: HTTP 200.
- Infrastructure health endpoint: `https://leadsy.up.railway.app/api/infrastructure/health`
- Infrastructure health result: HTTP 401 without auth, which confirms the route is protected.

## Twilio Webhook URLs

- Inbound webhook: `https://leadsy.up.railway.app/api/twilio/webhook`
- Delivery status callback: `https://leadsy.up.railway.app/api/twilio/status`
- Inbound webhook reachability: HTTP 401 for unsigned POST, which confirms the route is reachable and protected.
- Delivery callback reachability: HTTP 405 for GET, which confirms the route exists and only accepts callback methods.

Verified result:

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
- Latest deployment ID: `47eb448c-a4c2-4866-b9e3-115bc21861af`
- Latest deployment status: Success.
- Image: `docker.n8n.io/n8nio/n8n:stable`
- Health result: HTTP 200.
- Recent app error logs: 0 lines for `@level:error`.
- Recent HTTP 5xx logs: 0 lines in the last 30 minutes.

Verified checks:

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

- `npm run test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:n8n-workflows`
- `npm run test:onboarding-surface`
- `npm run test:automation-gateway`
