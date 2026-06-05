# UI Redesign Report

Status: first implementation slice

Lovable project:

- `https://lovable.dev/projects/0374c950-90bb-46e8-a818-064efc632c74`
- Lovable status: ready
- Screenshot URL: `https://screenshot2.lovable.dev/48b59aec-5ac0-42a5-b6bb-98ef9a9c3f2d/id-preview-955b9905--0374c950-90bb-46e8-a818-064efc632c74.lovable.app-1780680873884.png`

## Changed Pages

### Settings / Integrations

File:

- `apps/web/src/app/app/connect/page.tsx`

Changes:

- Added a read-only Infrastructure section under the existing settings panel.
- Added n8n automation visibility:
  - n8n URL
  - n8n health
  - workflow count
  - last execution
  - failed executions
  - queue status
  - links to n8n dashboard/workflows when configured
- Added an Infrastructure Dashboard table:
  - Web Service
  - Database
  - n8n
  - Meta
  - WhatsApp
  - OpenRouter
  - Extension
- Added an AI Cost Dashboard scaffold:
  - requests
  - prompt tokens
  - completion tokens
  - total tokens
  - estimated cost
  - failures
  - per-workflow rows

## New Supporting APIs

Files:

- `apps/web/src/app/api/infrastructure/automation/status/route.ts`
- `apps/web/src/app/api/infrastructure/automation/workflows/route.ts`
- `apps/web/src/app/api/infrastructure/automation/executions/route.ts`
- `apps/web/src/app/api/infrastructure/health/route.ts`
- `apps/web/src/app/api/ai/costs/route.ts`

Behavior:

- Read-only.
- Session protected with `analytics:read`.
- Audit logged.
- Additive only.
- Existing APIs remain untouched.

## New Supporting Libraries

Files:

- `apps/web/src/lib/automation-workflows.ts`
- `apps/web/src/lib/infrastructure-status.ts`
- `packages/workflows/src/automation-catalog.ts`
- `packages/workflows/src/n8n-blueprints.ts`
- `packages/workflows/n8n/*.json`

Behavior:

- Defines the ten requested n8n workflow contracts from shared package source.
- Exports inactive n8n JSON workflows for later import/review.
- Probes n8n only when optional n8n env vars are configured.
- Returns a clean `not configured` state when n8n is absent.
- Keeps Leadsy as the source of truth.

## Preserved Functionality

Preserved:

- Next.js App Router backend.
- Auth and signed session cookies.
- RBAC and permission checks.
- Existing route handlers.
- Meta OAuth.
- Meta webhooks.
- WhatsApp webhook compatibility.
- Browser extension token/task APIs.
- OpenRouter provider abstraction and env vars.
- Existing Docker/Railway web deployment files.
- Existing database schema.

## Remaining Frontend Work

The full Lovable-quality frontend redesign is not complete in this slice.

Remaining:

- Convert CRM to the full three-pane Attio-style workspace.
- Make Knowledge a persistent first-class right panel.
- Refactor Workers into a table + side-panel AI operator console.
- Build the dedicated Approval Center with bulk actions.
- Refactor Dashboard into a denser operator console.
- Expand Settings search and section navigation.
- Add command palette-ready structure.
- Run one visual browser pass against a current rebuilt app service.

## Known Baseline Issue

The already-running local Docker service on port `3000` was healthy but stale relative to the current source tree. Baseline screenshots were still captured in `docs/ui-baseline/`, but some source routes returned 404/500 from that container. The production build from current source succeeded and showed those routes in the Next.js route manifest.

## Verification

Passed:

- `npm run test:phase-one-routes`
- `npm run test:preserved-integrations`
- `npm run test:openrouter-cost`
- `npm run test:user-facing-surface`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `graphify update .`
