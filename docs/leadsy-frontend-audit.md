# Leadsy Frontend Audit

Date: 2026-06-06
Scope: `apps/web/src`, shared packages used by the web frontend, and the existing frontend surface scripts in `package.json`.

## Validation Run

These checks passed during the audit:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:auth-page-surface`
- `npm run test:global-components`
- `npm run test:ux-rules`
- `npm run test:phase-one-routes`
- `npm run test:production-bug-sweep`
- `npm run test:user-facing-surface`

The app compiles and the current static/surface tests pass. The issues below are mostly product wiring, runtime stability, data persistence, and hardcoded display behavior that the existing checks do not catch.

## Executive Summary

The Leadsy frontend has a polished operator UI, and several CRM workflows are already real: lead search through `q`, view filters, lead editing, follow-up creation, extension token generation, extension task boards, manual lead intake, and manual communication logging.

The unstable areas are where the UI suggests live automation or live operations but renders static placeholders, non-interactive controls, or query links that the destination pages ignore. The biggest product risks are incomplete client-role routing, file-backed production state, a disabled Meta setup CTA when env is missing, unimplemented password reset, hardcoded shell metrics/workspace labels, and several pages that look action-ready but only navigate to a generic page.

## Highest Priority Findings

### 1. Client-role access appears incomplete and may redirect-loop

Severity: High
Category: Buggy / unstable routing

Evidence:

- `apps/web/src/lib/auth.ts:121-123` returns `/app/leads` for both client and non-client sessions.
- `apps/web/src/lib/auth.ts:130-145` redirects client users from agency-only pages back to `/app/leads`.
- `/app/leads` itself lives under the agency app layout, which calls the agency session guard.
- `requireClientSession()` exists at `apps/web/src/lib/auth.ts:148-164`, but no current app route appears to use it.
- Login and Google auth helpers block `/client` next paths, for example `apps/web/src/app/api/auth/login/route.ts` and `apps/web/src/app/api/auth/google/route.ts`.

Impact:

Client users can be created in `auth-store`, but the frontend does not appear to have a real client portal route. A client session trying to access `/app/leads` is likely bounced back to the same agency route instead of reaching a client workspace.

Suggested fix:

Create a real client route group such as `/client` or `/app/client`, wire it through `requireClientSession()`, and make `redirectForSession()` send client users there. Then update safe-next validation so valid client routes are allowed.

### 2. Production state is mostly JSON-file backed

Severity: High
Category: Unstable persistence / scalability

Evidence:

- Auth state is stored at `leadsyDataDir/auth.json` in `apps/web/src/lib/auth-store.ts:9`.
- Auth reads/writes JSON with an in-process mutation queue in `apps/web/src/lib/auth-store.ts:83-134`.
- CRM, extension, lead knowledge, Meta OAuth, agency client, and webhook stores also read/write JSON files under `leadsyDataDir`.
- `apps/web/src/lib/data-dir.ts:9-17` defaults to `/data/leadsy` on Railway, otherwise `data/app` under the process root.
- UI copy claims stronger infrastructure, for example Approvals says business state is in Postgres at `apps/web/src/app/app/approvals/page.tsx:196-199`.

Impact:

This is fragile for production. Multiple instances can race because the mutation queue is per process, deployments can lose local `data/app` state, and the UI overstates the backend durability.

Suggested fix:

Move auth/session, CRM, lead knowledge, extension, Meta connection, and webhook state into the Prisma/Postgres model already present in `packages/db/prisma/schema.prisma`. Until then, change UI copy to avoid claiming Postgres-backed state.

### 3. Auth session signing falls back to a public dev secret

Severity: High
Category: Security / hardcoded fallback

Evidence:

- `apps/web/src/lib/auth.ts:19-23` uses `leadsy-local-dev-secret-change-before-production` when `LEADSY_AUTH_SECRET` and `AUTH_SECRET` are missing.

Impact:

If production is deployed without a secret, session cookies are signed with a predictable value.

Suggested fix:

Throw on missing auth secret in production. Keep the fallback only for local development.

### 4. Meta connection CTA becomes a dead primary action when env is missing

Severity: High
Category: Not working / env-dependent

Evidence:

- `apps/web/src/app/app/connect/page.tsx:129` reads `META_EMBEDDED_SIGNUP_URL`.
- `apps/web/src/app/app/connect/page.tsx:183-200` renders a real link only when that env var exists. Otherwise it renders a disabled-looking `<span>` for "Connect Meta account".
- `apps/web/src/app/app/connect/page.tsx:216-224` also warns "Facebook Login is currently unavailable".

Impact:

The main setup path can look like a product outage to users. Operators can skip Meta, but onboarding and integrations still place heavy emphasis on this route.

Suggested fix:

Show a clear setup-blocked state with missing configuration details for admins, and avoid showing a disabled primary CTA as if the user could fix it. Add a health check that flags missing Meta app credentials before users reach onboarding.

### 5. Password reset is not implemented

Severity: High
Category: Not working

Evidence:

- In forgot mode, `apps/web/src/components/login-form.tsx:73-77` prevents submit and shows: "Password reset is not automated yet."
- The button says "Get recovery guidance" at `apps/web/src/components/login-form.tsx:153-159`, not "Send reset email".

Impact:

Password users cannot recover access without Google sign-in or manual owner/support intervention.

Suggested fix:

Implement reset-token creation, email delivery, token verification, and password update. Until then, rename the forgot route and tab to support guidance so it is not mistaken for reset automation.

## Hardcoded or Misleading Live Data

### 6. Global app shell has hardcoded workspace, counts, and worker stats

Severity: Medium
Category: Hardcoded / misleading

Evidence:

- Navigation count `"142"` for CRM and `"3"` for Communications at `apps/web/src/components/app-shell.tsx:46-55`.
- Knowledge nav counts `"12"`, `"38"`, `"24"` at `apps/web/src/components/app-shell.tsx:57-61`.
- Workspace label `"Helio - Operations"` at `apps/web/src/components/app-shell.tsx:268-272`.
- User footer label `${session.role} - Helio` at `apps/web/src/components/app-shell.tsx:319-322`.
- Header stat `"4 workers running"` and queue `82 + pendingApprovalCount` at `apps/web/src/components/app-shell.tsx:373-378`.

Impact:

Users see fake numbers mixed with real notification counts. This undermines trust because some badges are live and others are static.

Suggested fix:

Source shell counts from the same stores used by the dashboard, or remove counts until they are real. Replace "Helio" with tenant/workspace data from the current session or owner profile.

### 7. Auth page preview is fully static demo content

Severity: Medium
Category: Hardcoded / demo surface

Evidence:

- `apps/web/src/components/auth-page.tsx:111-129` hardcodes metrics, funnel values, and names.
- `apps/web/src/components/auth-page.tsx:131-235` renders the static "Helio" operator preview.

Impact:

This is acceptable as a marketing/login preview if intentional, but it should not be treated as current workspace data.

Suggested fix:

Keep it clearly as demo preview copy, or use neutral sample labels. Avoid real-looking names and counts that can be mistaken for customer data.

### 8. Dashboard has artificial deltas and incomplete conversion metrics

Severity: Medium
Category: Hardcoded / unstable metric semantics

Evidence:

- `convertedCount` is hardcoded to `0` at `apps/web/src/app/app/page.tsx:220`.
- Deltas are fabricated from current counts at `apps/web/src/app/app/page.tsx:226-233`.
- Empty lead sources fall back to hardcoded Instagram, WhatsApp, Meta Ads, and Extension rows at `apps/web/src/app/app/page.tsx:126-133`.
- Recent activity is labeled `streaming` at `apps/web/src/app/app/page.tsx:367-371`, but the component is server-rendered from current arrays.

Impact:

The dashboard looks live, but several numbers do not represent real time windows or historical changes.

Suggested fix:

Introduce a metric service with explicit time windows, previous-period comparison, and conversion status definitions. Rename "streaming" to "recent" until there is a live event stream.

### 9. Worker page fabricates worker rows and success rates

Severity: Medium
Category: Hardcoded / misleading

Evidence:

- `apps/web/src/app/app/worker/page.tsx:48-93` builds fixed rows like `meta-research`, `qualifier-v3`, `whatsapp-outreach`, and `extension-capture`.
- Success rates are fixed values toggled by whether any task failed, for example `82` vs `96` at `apps/web/src/app/app/worker/page.tsx:55`.
- The side panel always selects `rows[0]` at `apps/web/src/app/app/worker/page.tsx:108-110`.
- Filter tabs are static spans at `apps/web/src/app/app/worker/page.tsx:114-119`.
- "Logs" links to `/app/connect?panel=settings` at `apps/web/src/app/app/worker/page.tsx:184-189`.

Impact:

The worker dashboard looks operational, but it does not actually select workers, filter rows, or show real logs/success rates.

Suggested fix:

Model workers as real records or derive them from task/workflow definitions. Make filters real links or client controls. Add a logs route or remove the Logs action.

## Non-Functional or Partially Wired UI Controls

### 10. Global search, new lead, and filter links use params the CRM page ignores

Severity: Medium
Category: Broken navigation / not working

Evidence:

- App shell links to `/app/leads?search=open`, `/app/leads?new=lead`, and `/app/leads?filters=open` at `apps/web/src/components/app-shell.tsx:278-296` and `apps/web/src/components/app-shell.tsx:379-385`.
- The CRM page reads `view`, `panel`, `tab`, `commChannel`, `q`, and `contact` at `apps/web/src/app/app/leads/page.tsx:370-378`; it does not read `search`, `new`, or `filters`.
- The actual CRM search field uses `q` at `apps/web/src/app/app/leads/page.tsx:487-499`.

Impact:

Clicking Quick search, New lead, or Filter can navigate but does not open the promised state. This is one of the clearest "looks wired but does nothing" issues.

Suggested fix:

Either consume these params in the CRM page to open the right UI, or change links to existing supported behavior. For example, use `?q=` for search and add a `new=lead` modal state around `ManualLeadIntake`.

### 11. Approvals page has static filters/search/bulk controls and a non-action Reject

Severity: Medium
Category: Not working / UI affordance mismatch

Evidence:

- Approval filter tabs are spans at `apps/web/src/app/app/approvals/page.tsx:107-112`.
- Search is a static span, not an input, at `apps/web/src/app/app/approvals/page.tsx:113-120`.
- Bulk select checkboxes do not submit or control any bulk action at `apps/web/src/app/app/approvals/page.tsx:124-129`.
- Reject is a span at `apps/web/src/app/app/approvals/page.tsx:175-187`.

Impact:

The page appears to support filtering, searching, bulk actions, and rejection, but the controls do not perform those actions.

Suggested fix:

Implement query-backed filters and search, add bulk action forms, and wire Reject to task/lead rejection APIs. If rejection is not supported yet, remove the control.

### 12. Communications page has a static search/filter bar and fake composer

Severity: Medium
Category: Not working / partial wiring

Evidence:

- Search bar is static text at `apps/web/src/app/app/communications/page.tsx:152-157`.
- Channel filters are spans at `apps/web/src/app/app/communications/page.tsx:158-164`.
- Pin, Star, and Summarize controls are spans at `apps/web/src/app/app/communications/page.tsx:211-217`.
- Reply composer is a static div with placeholder text; Prepare only links to pending workers at `apps/web/src/app/app/communications/page.tsx:250-263`.

Impact:

The page resembles an inbox but does not let users search, filter, pin, star, summarize, or compose from that view.

Suggested fix:

Add query-backed search/filtering, implement conversation actions, and either provide a real draft/approval creation form or relabel the composer as a read-only handoff.

### 13. Lead knowledge "Run research worker" does not run a worker

Severity: Medium
Category: Not working / misleading action

Evidence:

- The button at `apps/web/src/app/app/leads/page.tsx:639-642` links to the same lead details page.
- No API call is made from that action.

Impact:

Users expect research/enrichment to start, but the action only changes or preserves navigation state.

Suggested fix:

Wire it to the existing extension task generation or automation endpoint, or rename it to "Open details" until worker execution exists.

### 14. CRM chat composer logs manual communication, it does not send messages

Severity: Low to Medium
Category: Partial wiring / user expectation

Evidence:

- `ManualReplyHandoff` says "Leadsy tracks this. You send it." at `apps/web/src/app/app/leads/page.tsx:1049-1066`.
- `ManualMessageForm` posts to `/api/leads/manual-message` and the button says "Save manual comm" at `apps/web/src/app/app/leads/page.tsx:1247-1310`.

Impact:

This is technically honest in the side copy, but it sits inside a chat composer area and can be mistaken for actual channel sending.

Suggested fix:

Make the composer label more explicit, such as "Log communication", or add a separate draft/send workflow that routes through approvals.

### 15. Archive lead posts immediately

Severity: Low to Medium
Category: UX risk

Evidence:

- The archive form posts directly to `/api/leads/delete` at `apps/web/src/app/app/leads/page.tsx:866-875`.
- The API archives rather than hard-deletes, and returns `notice=lead-archived`, but there is no confirmation in the UI.

Impact:

Users can archive a selected lead with one click from the details panel.

Suggested fix:

Add confirmation, undo, or move archive into a menu. Keep the soft-archive behavior.

## Incomplete or Archived Surfaces

### 16. Lead Magnet is archived but large old surface remains in source

Severity: Medium
Category: Dead code / maintenance risk

Evidence:

- `/app/magnet` redirects to `/app/leads?notice=lead-magnet-archived` at `apps/web/src/app/app/magnet/page.tsx:5-7`.
- Lead Magnet APIs return archived responses through `apps/web/src/lib/lead-magnet-archive.ts:4-18`.
- `LeadMagnetLab` is still a large interactive component beginning at `apps/web/src/components/lead-magnet-lab.tsx:610`, with fetches to archived `/api/lead-magnet/*` routes.

Impact:

The old product surface still adds test/build/readability overhead and can confuse future work. It is mostly neutral at runtime because the route is redirected and APIs return `410`.

Suggested fix:

Delete the unused component and store code after confirming there are no external dependencies, or move it under an explicit archive folder with tests that assert it stays unreachable.

### 17. Profile/settings panels are mostly headings, not settings experiences

Severity: Medium
Category: Partial wiring

Evidence:

- The connect page accepts `panel=settings` and `panel=profile`, but `apps/web/src/app/app/connect/page.tsx:131-136` mainly changes the heading.
- App shell user menu profile path points to `/app/connect?panel=profile` at `apps/web/src/components/app-shell.tsx:426-427`.
- Onboarding copy says users can configure Meta later from Profile Settings at `apps/web/src/components/onboarding-wizard.tsx:387-395`.

Impact:

Users are told to use Profile Settings, but the route mostly shows the same integrations page with a different heading.

Suggested fix:

Build actual workspace/profile settings, or update links/copy to say "Integrations".

## Onboarding and Setup Stability

### 18. Onboarding dismissal is browser-local and can hide incomplete setup

Severity: Medium
Category: Unstable state / setup completion

Evidence:

- Dismissal checks a cookie and localStorage at `apps/web/src/components/onboarding-wizard.tsx:26-40`.
- Dismiss writes localStorage and a 30-day cookie at `apps/web/src/components/onboarding-wizard.tsx:116-120`.
- Completion score is computed from local component state and Meta connection at `apps/web/src/components/onboarding-wizard.tsx:80-83`.

Impact:

A user can hide onboarding locally even if server-side profile fields or integration steps remain incomplete. The same user on another browser can see a different onboarding state.

Suggested fix:

Store dismissal/completion on the server per user. Keep localStorage only for draft form state.

### 19. Onboarding contains non-functional future-looking photo upload

Severity: Low
Category: Placeholder

Evidence:

- The profile photo block says upload storage will use the asset path "when enabled" at `apps/web/src/components/onboarding-wizard.tsx:265-269`.

Impact:

It communicates a feature that is not available.

Suggested fix:

Remove the block until upload storage is implemented, or turn it into a disabled "coming later" item outside the required onboarding flow.

## Hardcoded Tenant and Demo Data

### 20. Domain package hardcodes tenant identity

Severity: Medium
Category: Hardcoded / multi-tenant limitation

Evidence:

- `packages/domain/src/index.ts:1` defines `TenantId = "tenant_northstar"`.
- `apps/web/src/lib/auth-store.ts:6` imports that tenant id.
- Owner and client users created via password flows use the hardcoded tenant at `apps/web/src/lib/auth-store.ts:223-231` and `apps/web/src/lib/auth-store.ts:278-287`.
- Google workspace users get hashed tenant IDs at `apps/web/src/lib/auth-store.ts:238-263`, creating different tenant behavior by signup path.

Impact:

The app is not consistently multi-tenant. Password-created owner/client users default to the same tenant while Google users get generated tenant IDs.

Suggested fix:

Move tenant creation into a workspace model and require every user creation path to attach to a real workspace/tenant record.

### 21. Demo seed and dummy cleanup are hardcoded to named sample data

Severity: Low to Medium
Category: Hardcoded operational tooling

Evidence:

- Demo seed uses hardcoded tenant/user/contact data in `apps/web/src/lib/demo-workspace-seed.ts`.
- Admin cleanup requires `"KEEP_ONLY_BIBHOR_DAS"` and defaults to `["Bibhor Das", "8100510961", "Contendo"]` at `apps/web/src/app/api/admin/cleanup-dummy-data/route.ts:9-10`.

Impact:

Demo seed is gated, but cleanup tooling is person-specific and not reusable or safe for general operations.

Suggested fix:

Move sample data to fixtures, require explicit request payloads for cleanup targets, and add a dry-run-first admin UI if this endpoint remains.

## Additional Notes

The extension download path is not broken. `/downloads/leadsy-extension.zip` exists under `apps/web/public/downloads`, and onboarding/download links point to that file.

The Lead Magnet archive behavior appears intentional: the route redirects and APIs return `410`. The problem is leftover code surface, not the redirect itself.

Several "fake-live" labels are probably design placeholders from a prelaunch build. They should either become live data or be visually marked as sample/demo content.

## Suggested Fix Order

1. Fix client-role routing and session redirects.
2. Require production auth secrets and remove the public fallback outside development.
3. Replace JSON-file stores with Postgres-backed persistence, or at minimum stop claiming Postgres in UI copy.
4. Make AppShell counts/workspace labels real, or remove the hardcoded values.
5. Wire or remove the global Quick search, New lead, and Filter links.
6. Implement or remove non-functional controls on Approvals and Communications.
7. Make worker metrics/logs real, or downgrade the worker page to a task/status page.
8. Clarify manual communication logging versus actual channel send.
9. Move onboarding dismissal to server state.
10. Remove archived Lead Magnet frontend/API code when no longer needed.
