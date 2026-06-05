# UI Redesign Report

Status: Lovable operator workspace port in progress on the production Next.js frontend

Lovable project:

- `https://lovable.dev/projects/0374c950-90bb-46e8-a818-064efc632c74`
- Lovable status: ready
- Screenshot URL: `https://screenshot2.lovable.dev/48b59aec-5ac0-42a5-b6bb-98ef9a9c3f2d/id-preview-955b9905--0374c950-90bb-46e8-a818-064efc632c74.lovable.app-1780680873884.png`

## Changed Pages

### Auth Surface

Files:

- `apps/web/src/components/auth-page.tsx`
- `apps/web/src/components/login-form.tsx`

Changes:

- Preserved the existing session redirect, password login, Google auth, forgot-password, and extension links.
- Added a large desktop operator preview that matches the Lovable dashboard structure.
- Removed the disconnected card-only feel from the login page.

### Global App Shell

File:

- `apps/web/src/components/app-shell.tsx`

Changes:

- Replaced the previous generic shell with a dense Leadsy operator layout.
- Added Lovable-style navigation sections:
  - Workflow
  - Knowledge
  - user/workspace footer
- Added quick search and new lead controls.
- Added compact top bar with breadcrumb, worker queue signal, filter, and new action.
- Preserved logout, notifications, mobile drawer, onboarding, auth session, and route active-state behavior.

### Dashboard

File:

- `apps/web/src/app/app/page.tsx`

Changes:

- Replaced the generic dashboard with a Lovable-style operator console.
- Added compact metric strip:
  - New leads
  - Qualified
  - Escalations
  - Active tasks
  - Worker activity
  - Pending approvals
- Added qualification funnel, lead source breakdown, worker throughput, recent activity, and right-side Needs You approval rail.
- Preserved live data reads from Leadsy stores instead of hardcoded demo data.

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
- `packages/workflows/n8n/leadsy-automation-router.json`

Behavior:

- Defines the ten requested n8n workflow routes from shared package source.
- Exports one inactive n8n Automation Router workflow for easier setup/review.
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

Remaining:

- Convert CRM to the full three-pane Attio-style workspace.
- Make Knowledge a persistent first-class right panel across CRM/detail views.
- Refactor Workers into a table + side-panel AI operator console.
- Build the dedicated Approval Center with bulk actions.
- Expand Settings search and section navigation.
- Run one visual browser pass against the deployed app after Railway deploys this branch.

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
