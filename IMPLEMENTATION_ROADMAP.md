# Leadsy Product Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign Leadsy into an AI lead capture, qualification, CRM, assignment, follow-up, and conversion platform without rewriting the product or breaking existing integrations.

**Architecture:** Preserve the current Next.js, PostgreSQL/Prisma, JSON-store fallback, browser extension, Meta, WhatsApp, OpenRouter, Railway, and n8n assets. Add product workflow layers incrementally: status mapping, UI information architecture, durable CRM operations, automation action endpoints, and analytics drilldowns.

**Tech Stack:** Next.js, React, TypeScript, Prisma, PostgreSQL, Railway, n8n, OpenRouter, Meta APIs, WhatsApp integration, browser extension, Vitest/Playwright-style route tests where already present.

---

## Execution Rules

- Do not start product code changes until `PRODUCT_GAP_ANALYSIS.md` has been accepted as the baseline.
- Do not rewrite the app.
- Do not remove current integrations.
- Do not move auth, RBAC, CRM state, tenant logic, or business logic into n8n.
- Prefer adapters, route aliases, and incremental migrations over large rewrites.
- Keep old routes working until redirects and tests prove safety.
- Run preservation tests before deployment-sensitive changes.

## Phase 0: Baseline And Guardrails

Objective:

- Lock the product gap analysis and preserve existing working surfaces.

Files:

- Read: `PRODUCT_GAP_ANALYSIS.md`
- Read: `PRESERVED_INTEGRATIONS.md`
- Read: `CURRENT_SYSTEM_AUDIT.md`
- Read: `BACKEND_AUDIT.md`
- Read: `docs/leadsy-frontend-audit.md`
- Test: existing integration and frontend tests

- [ ] Confirm no implementation has started before gap analysis acceptance.
- [ ] Run baseline checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:preserved-integrations
npm run test:n8n-workflows
npm run test:global-components
npm run test:user-facing-surface
```

- [ ] Record current route and integration behavior before UI changes.
- [ ] Add regression tests if any preserved route is missing coverage.
- [ ] Commit only documentation and test guardrails for this phase.

Acceptance criteria:

- Existing build and preservation tests pass.
- Product gap analysis is accepted.
- No integration behavior has changed.

## Phase 1: Product Language And Navigation Realignment

Objective:

- Make the app shell reflect the target workflow without changing backend behavior.

Files:

- Modify: `apps/web/src/components/app-shell.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/components/auth-page.tsx`
- Modify: `apps/web/src/app/app/page.tsx`
- Test: app shell, route, and UX tests under `apps/web/src`

- [ ] Add tests that assert primary nav labels are Dashboard, Leads, Inbox, Automations, Team, Analytics, Settings.
- [ ] Update app shell labels and route links.
- [ ] Keep old routes accessible through secondary links or aliases.
- [ ] Replace primary copy that says Leadsy is a lead intelligence/research product with AI lead qualification and conversion language.
- [ ] Move Workers, Knowledge, and Intelligence wording into supporting contexts.
- [ ] Run nav and UX tests.

Acceptance criteria:

- Main navigation matches target IA.
- Existing routes still load.
- No Meta, WhatsApp, extension, auth, or deployment route is removed.

## Phase 2: Pipeline Status Mapping

Objective:

- Introduce product pipeline statuses safely before UI pipeline work.

Files:

- Modify: `apps/web/src/lib/lead-knowledge-store.ts`
- Modify: `apps/web/src/app/api/leads/edit/route.ts`
- Possibly modify: `packages/domain/src/index.ts`
- Possibly modify: `packages/db/prisma/schema.prisma`
- Test: lead store and lead edit route tests

- [ ] Add tests for mapping existing statuses to New, Qualified, Interested, Contacted, Won, Lost.
- [ ] Add a read-only mapping helper first.
- [ ] Preserve existing `crmStatus` and `qualificationStage` values.
- [ ] Add explicit Won and Lost update paths only after tests cover them.
- [ ] Keep `needs_reply` and `human_review` as operational flags if possible.
- [ ] Run lead route and type checks.

Acceptance criteria:

- Existing leads render into the required product statuses.
- Existing status values still round-trip.
- Won and Lost can be represented without breaking old records.

## Phase 3: Leads Primary Workspace

Objective:

- Make `/app/leads` the central CRM workspace.

Files:

- Modify: `apps/web/src/app/app/leads/page.tsx`
- Modify related lead components under `apps/web/src/components`
- Modify: lead list/detail API use where needed
- Test: user-facing lead surface tests

- [ ] Add tests for lead search, filters, status views, owner display, source display, and last activity.
- [ ] Convert any static lead controls into connected controls or disabled states.
- [ ] Add saved view data contract if not already present.
- [ ] Add bulk action data contract before bulk UI.
- [ ] Add lead detail tabs: Overview, Conversation, Qualification, Tasks, Notes, Activity, Timeline.
- [ ] Reuse existing lead knowledge fields instead of introducing a parallel record type.

Acceptance criteria:

- Leads screen can operate on real lead records.
- Required columns or status views exist.
- Lead detail tabs use existing data.
- No integration source is disconnected.

## Phase 4: Inbox Conversion Hub

Objective:

- Turn communications into a unified lead-attached inbox.

Files:

- Modify: `apps/web/src/app/app/communications/page.tsx`
- Add route alias if needed: `apps/web/src/app/app/inbox/page.tsx`
- Modify message/communication stores only through existing contracts
- Test: inbox route and communication behavior tests

- [ ] Add tests for channel filters: WhatsApp, Instagram, Messenger, Email.
- [ ] Add tests that a selected conversation links to a lead record.
- [ ] Wire search and filters to real message data.
- [ ] Add internal notes connected to lead activity or notes.
- [ ] Add AI summary and suggested reply states with clear loading/error behavior.
- [ ] Add owner assignment control using assignment APIs.

Acceptance criteria:

- Inbox is unified across supported channels.
- Every communication is attached to a lead record.
- Static controls are removed, wired, or disabled honestly.

## Phase 5: Team And Assignment

Objective:

- Add team operations and routing configuration.

Files:

- Create: `apps/web/src/app/app/team/page.tsx`
- Modify: `apps/web/src/app/api/crm/assignment-rules/route.ts` if needed
- Modify: `apps/web/src/lib/crm-store.ts` if needed
- Possibly add user/team helper components
- Test: assignment rule and team route tests

- [ ] Add tests for assignment rule list/create/update behavior.
- [ ] Add Team route with users and role display.
- [ ] Add assignment rules UI for source-based routing.
- [ ] Add round-robin and workload distribution as data contracts before automation.
- [ ] Add assignment audit visibility.
- [ ] Keep auth and RBAC checks in Leadsy.

Acceptance criteria:

- Operators can see team ownership and routing rules.
- Source-based routing is configurable through UI.
- Assignment changes are auditable.

## Phase 6: Automation Action Endpoints

Objective:

- Prepare Leadsy-owned action endpoints before n8n activation.

Files:

- Modify or create routes under `apps/web/src/app/api/automation`
- Modify: `packages/workflows/src/automation-catalog.ts`
- Modify: `packages/workflows/src/n8n-blueprints.ts`
- Test: automation gateway and n8n workflow tests

- [ ] Add service-auth tests for automation endpoints.
- [ ] Add idempotency tests.
- [ ] Add execution start/complete/fail endpoints.
- [ ] Add lead status, assignment, qualification result, follow-up result, and message queue action endpoints.
- [ ] Keep router in dry-run mode until endpoint tests pass.
- [ ] Run `npm run test:automation-gateway` and `npm run test:n8n-workflows`.

Acceptance criteria:

- n8n can call Leadsy only through authenticated, audited, idempotent action endpoints.
- n8n still does not own CRM state.
- Router can dry-run safely.

## Phase 7: Follow-Ups And Campaigns

Objective:

- Build delayed follow-ups, reminders, re-engagement, and bulk messaging around Leadsy-owned records.

Files:

- Modify: `apps/web/src/app/api/crm/follow-up-tasks/route.ts`
- Possibly add follow-up sequence routes under `apps/web/src/app/api/crm`
- Add UI under Automations or Leads
- Test: follow-up and campaign tests

- [ ] Add tests for delayed intervals: 3 hours, 24 hours, 7 days, 30 days.
- [ ] Add follow-up sequence data model or store.
- [ ] Add segment filters for campaigns.
- [ ] Require approval before outbound sends unless workspace rules explicitly allow automation.
- [ ] Track Sent, Delivered, Read, Replied.
- [ ] Attribute replies and conversions back to campaign runs.

Acceptance criteria:

- Follow-up sequences can be configured and audited.
- Bulk messaging uses segments and approval rules.
- Delivery and reply tracking are visible.

## Phase 8: Analytics And Drilldowns

Objective:

- Make dashboard and analytics record-driven.

Files:

- Modify: `apps/web/src/app/app/page.tsx`
- Create: `apps/web/src/app/app/analytics/page.tsx`
- Add analytics helpers under `apps/web/src/lib` if needed
- Test: dashboard and analytics drilldown tests

- [ ] Add tests that dashboard metrics link to filtered records.
- [ ] Add source performance report.
- [ ] Add qualification rate report.
- [ ] Add conversion rate report.
- [ ] Add team performance report.
- [ ] Add response time and follow-up effectiveness reports.

Acceptance criteria:

- Every chart drills into real records.
- Analytics describe conversion operations, not generic system activity.

## Phase 9: Durable Data Migration

Objective:

- Move runtime CRM state toward PostgreSQL without breaking JSON-backed deployment behavior.

Files:

- Modify: `packages/db/prisma/schema.prisma`
- Modify stores under `apps/web/src/lib`
- Add migration scripts where appropriate
- Test: database, store adapter, and route tests

- [ ] Add adapter tests that read existing JSON records.
- [ ] Add Postgres-backed adapter behind a feature flag.
- [ ] Migrate lead knowledge records incrementally.
- [ ] Migrate assignment rules and follow-up tasks.
- [ ] Keep JSON fallback until production migration is verified.
- [ ] Add rollback plan before enabling production writes.

Acceptance criteria:

- Existing data remains readable.
- Postgres can become the durable source of truth gradually.
- Deployment does not break when migration flag is off.

## Phase 10: Final Product Polish And Deployment

Objective:

- Complete visual polish, route compatibility, and deployment readiness.

Files:

- Review all app routes under `apps/web/src/app`
- Review all public copy
- Review deployment docs
- Test: complete suite

- [ ] Remove or hide stale archived surfaces from primary UX.
- [ ] Verify extension download and connect flows.
- [ ] Verify Meta and WhatsApp preservation tests.
- [ ] Verify OpenRouter cost and fallback behavior.
- [ ] Verify Railway deployment workflow.
- [ ] Run full test suite.

Acceptance criteria:

- Product reads as AI lead capture, qualification, CRM, assignment, follow-up, and conversion.
- Existing integrations remain working.
- Deployment path remains unchanged except for documented additive config.

## Recommended First Sprint

Sprint 1 should stay small:

1. Accept this planning baseline.
2. Add product status mapping tests.
3. Update primary navigation labels and copy.
4. Make hardcoded shell/dashboard counts live, hidden, or clearly unavailable.
5. Preserve all existing routes and integration tests.

Do not start n8n activation, Postgres migration, or a full CRM rewrite in Sprint 1.

