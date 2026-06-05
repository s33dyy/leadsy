# UI Audit

Captured: 2026-06-05

This audit records the current frontend before the Lovable-quality redesign. Baseline screenshots were saved in `docs/ui-baseline/` before any UI source changes.

## Baseline Screenshot Manifest

Screenshots were captured against the already-running local Docker web service at `http://localhost:3000`; no new dev server was started.

| Route | Screenshot | Observed status |
| --- | --- | --- |
| `/` | `docs/ui-baseline/home.png` | 200 |
| `/login` | `docs/ui-baseline/login.png` | 200, redirected to `/app/leads` because a temporary local demo session was used |
| `/signup` | `docs/ui-baseline/signup.png` | 404 from running Docker image |
| `/forgot-password` | `docs/ui-baseline/forgot-password.png` | 404 from running Docker image |
| `/extension` | `docs/ui-baseline/extension.png` | 200 |
| `/dashboard` | `docs/ui-baseline/dashboard-alias.png` | 404 from running Docker image |
| `/crm` | `docs/ui-baseline/crm-alias.png` | 404 from running Docker image |
| `/workers` | `docs/ui-baseline/workers-alias.png` | 404 from running Docker image |
| `/settings` | `docs/ui-baseline/settings.png` | 404 from running Docker image |
| `/app` | `docs/ui-baseline/app-dashboard.png` | 500 from running Docker image |
| `/app/leads` | `docs/ui-baseline/app-leads-crm.png` | 200 |
| `/app/leads?panel=knowledge` | `docs/ui-baseline/app-leads-knowledge.png` | 200 |
| `/app/worker` | `docs/ui-baseline/app-worker.png` | 500 from running Docker image |
| `/app/worker?tab=pending` | `docs/ui-baseline/app-approvals.png` | 500 from running Docker image |
| `/app/connect` | `docs/ui-baseline/app-connect.png` | 200 |
| `/app/connect?panel=settings` | `docs/ui-baseline/app-settings.png` | 200 |
| `/app/magnet` | `docs/ui-baseline/app-magnet.png` | 500 from running Docker image |

Baseline note: the running Docker image is not perfectly aligned with the current source tree. Current source contains `/signup`, `/forgot-password`, `/dashboard`, `/crm`, `/workers`, and `/settings`, but the already-running container returned 404 for those aliases. Treat this as deployment drift to verify before final release.

## Current Frontend Routes

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `apps/web/src/app/page.tsx` | Public landing page. Already positions Leadsy as an AI Lead Intelligence & Operations Platform. |
| `/login` | `apps/web/src/app/login/page.tsx` | Login entry rendering `AuthPage` with login mode. |
| `/signup` | `apps/web/src/app/signup/page.tsx` | Signup entry rendering `AuthPage` with signup mode. |
| `/forgot-password` | `apps/web/src/app/forgot-password/page.tsx` | Forgot-password entry rendering `AuthPage` with forgot mode. |
| `/extension` | `apps/web/src/app/extension/page.tsx` | Browser worker download/install page. |
| `/dashboard` | `apps/web/src/app/dashboard/page.tsx` | Protected alias to `/app`. |
| `/crm` | `apps/web/src/app/crm/page.tsx` | Protected alias to `/app/leads`. |
| `/workers` | `apps/web/src/app/workers/page.tsx` | Protected alias to `/app/worker`. |
| `/settings` | `apps/web/src/app/settings/page.tsx` | Protected alias to `/app/connect?panel=settings`. |
| `/app` | `apps/web/src/app/app/page.tsx` | Authenticated operations dashboard. |
| `/app/leads` | `apps/web/src/app/app/leads/page.tsx` | Main lead intelligence/CRM workspace. |
| `/app/leads?panel=knowledge` | `apps/web/src/app/app/leads/page.tsx` | Knowledge-focused lead workspace mode. |
| `/app/worker` | `apps/web/src/app/app/worker/page.tsx` | Worker pairing, monitor health, and task board. |
| `/app/worker?tab=pending` | `apps/web/src/app/app/worker/page.tsx` | Approval-focused worker queue. |
| `/app/connect` | `apps/web/src/app/app/connect/page.tsx` | Meta, webhook, and extension configuration. |
| `/app/connect?panel=settings` | `apps/web/src/app/app/connect/page.tsx` | Settings-style configuration mode. |
| `/app/magnet` | `apps/web/src/app/app/magnet/page.tsx` | Archived Lead Magnet redirect. |
| `/logout` | `apps/web/src/app/logout/route.ts` | Logout redirect route. |

## Current Layout and Navigation

- `apps/web/src/app/app/layout.tsx` wraps authenticated routes with `AppShell`.
- `apps/web/src/components/app-shell.tsx` provides a dark fixed sidebar, top header, notifications, user menu, and onboarding wizard.
- Sidebar sections already map closely to the requested IA: Dashboard, CRM, Workers, Approvals, Knowledge, Integrations, Settings.
- The shell supports sidebar collapse and mobile drawer behavior.
- The current visual system is dark, panel-based, and Tailwind-driven with shared primitives in `apps/web/src/components/ui.tsx`.

## Current Major Views

### Dashboard

File: `apps/web/src/app/app/page.tsx`

Current behavior:

- Reads sessions, extension tasks, CRM follow-up tasks, and lead knowledge.
- Displays operations metrics, source/status/assignee/task breakdowns, approval queue, recent lead movement, and recent worker activity.
- Most metric cards link to filtered workspaces.

Preserve:

- Data dependencies and filtered route links.
- Operator dashboard framing.
- No autonomous-send language.

Refactor:

- Reduce card heaviness and make dashboard read more like an operations console.
- Make worker throughput, qualification funnel, recent activity, and pending approvals more scannable.

Deprecate:

- Any executive-dashboard styling that implies generic CRM analytics over daily operator flow.

### CRM / Lead Intelligence Workspace

File: `apps/web/src/app/app/leads/page.tsx`

Current behavior:

- Lists lead knowledge records, filters by view/search/query params, selects lead by `contact`, and renders communications/details/tasks modes.
- Uses `LeadScrollKeeper`, `ManualLeadIntake`, and `SelectedLeadTasks`.
- Supports lead status, conversation status, manual messages, manual intake, edits, archived leads, and task generation.

Preserve:

- Lead knowledge store calls and all existing mutations.
- Current query-param compatibility.
- Manual lead/message flows and human-approved task generation.

Refactor:

- Make this the clear center of the product with a true three-pane layout: lead list, selected lead workspace, and persistent knowledge panel.
- Make lead rows compact, keyboard-friendly, and information dense.
- Split communications, tasks, notes, and knowledge with progressive disclosure.

Deprecate:

- Any giant repeated cards for leads.
- Any UI that hides the selected lead while reviewing notes/tasks/communications.

### Workers / Approvals

File: `apps/web/src/app/app/worker/page.tsx`

Current behavior:

- Shows extension pairing.
- Shows hybrid monitor health: official Meta webhook first, browser extension fallback.
- Shows `ExtensionTaskBoard` with focus support for pending approvals.

Preserve:

- Extension token pairing and delete flow.
- `focusColumn` behavior for `tab=pending`.
- Worker task lifecycle semantics.

Refactor:

- Present workers as AI operators with table-first status, queue, last run, outputs, and approvals.
- Make approvals a first-class review center with bulk actions.

Deprecate:

- Any framing that makes the extension itself look like the workflow engine.

### Integrations / Settings

File: `apps/web/src/app/app/connect/page.tsx`

Current behavior:

- Shows Meta setup, webhook readiness, connection state, and worker token pairing.
- Uses `META_EMBEDDED_SIGNUP_URL` readiness but starts Meta OAuth through `/api/meta/oauth/start`.

Preserve:

- Session-gated Meta OAuth start.
- Existing env var names and route links.
- Skip-later path for Meta setup.

Refactor:

- Convert to searchable settings grouped by Profile, Workspace, Integrations, AI, Workers, Notifications, Meta, WhatsApp, Extension, and Infrastructure.
- Add future Infrastructure -> Automation section for n8n visibility.

Deprecate:

- A single long settings/configuration surface.

## Component Inventory

| Component | File | Current role |
| --- | --- | --- |
| `AppShell` | `apps/web/src/components/app-shell.tsx` | Global authenticated shell. |
| `AuthPage` / `LoginForm` | `apps/web/src/components/auth-page.tsx`, `apps/web/src/components/login-form.tsx` | Login/signup/forgot UI with inline validation. |
| `ui.tsx` primitives | `apps/web/src/components/ui.tsx` | `Badge`, `Panel`, `SectionTitle`, `PrimaryLink`, `EmptyState`, progress primitives. |
| `ExtensionTaskBoard` | `apps/web/src/components/extension-task-board.tsx` | Worker queue and task lifecycle board. |
| `SelectedLeadTasks` | `apps/web/src/components/selected-lead-tasks.tsx` | Selected lead task generation and task history. |
| `ManualLeadIntake` | `apps/web/src/components/manual-lead-intake.tsx` | Manual lead intake form and knowledge facts. |
| `ExtensionPairing` | `apps/web/src/components/extension-pairing.tsx` | Worker token creation/deletion. |
| `OnboardingWizard` | `apps/web/src/components/onboarding-wizard.tsx` | First-run profile, Meta optional setup, worker token setup. |
| `ToastProvider` | `apps/web/src/components/toast-provider.tsx` | Toast feedback. |
| `LeadMagnetLab` | `apps/web/src/components/lead-magnet-lab.tsx` | Archived/legacy Lead Magnet UI still present in source. |

## Design System Snapshot

- Styling: Tailwind CSS, dark mode variables in `apps/web/src/app/globals.css`.
- Icons: Lucide React.
- Shared primitives: local `ui.tsx`; no shadcn registry currently installed.
- Layout: fixed left sidebar plus central content; not yet a full persistent three-column Leadsy workspace.
- Border radius is mostly 6-8px and aligns with the requested premium/productivity feel.
- Current palette leans dark with teal accents. The redesign should broaden status colors carefully while avoiding gradients/neon/glassmorphism.

## UX Risks

- The current source and running Docker service appear out of sync; verify the container is rebuilt before judging route availability.
- The lead workspace is already large and server-rendered; redesign should be incremental and test-backed rather than a single-file rewrite.
- `LeadMagnetLab` remains in source even though Lead Magnet is archived; avoid resurrecting it as the main UI.
- The current app has good preservation tests for auth, route aliases, UX rules, and integrations; redesign must keep these passing.

## Preserve / Refactor / Deprecate

| Subsystem | Preserve | Refactor | Deprecate |
| --- | --- | --- | --- |
| Global shell | Authenticated layout, sidebar IA, collapse support, notifications, onboarding | Three-column app structure with persistent context panel | Generic admin-dashboard framing |
| Dashboard | Linked metrics, operations-first data, approval queue | Denser operator console with funnel, source split, throughput, activity stream | Oversized charts or vanity executive cards |
| CRM | Lead knowledge source, filters, selected lead state, existing mutations | Attio-style compact list + selected lead detail + knowledge panel | Lead cards that obscure scanning |
| Knowledge | Lead facts, messages, task-derived knowledge | Persistent first-class right panel | Hidden/secondary knowledge treatment |
| Workers | Extension worker task board and monitor health | Table/side-panel worker console | Browser extension as workflow engine |
| Approvals | Existing task approval routes and statuses | Dedicated bulk approval center | Scattered approval controls only inside worker board |
| Settings | Meta OAuth, webhook, extension token UI | Searchable settings and Infrastructure -> Automation | Single monolithic config page |
| Auth pages | Inline validation, Google flow, form fallback | Visual polish only | Browser prompts or AJAX-only cookie login |

## Lovable Redesign Boundary

Lovable should generate the frontend experience direction and screen composition only. It must not replace Next.js APIs, auth, stores, Meta/WhatsApp/OpenRouter/extension integrations, env vars, Docker/Railway config, or database schema.
