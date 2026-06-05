# Leadsy Design System

Status: design direction for frontend implementation

Leadsy should feel like an AI lead operations cockpit: dense, calm, fast, and context-preserving. The product is not a generic CRM, not a revenue OS, and not a marketing dashboard. The interface should make this operating loop obvious:

Research -> Knowledge -> Qualification -> Tasks -> Communications -> Conversion.

## Visual Positioning

- Default theme: dark.
- References: Attio density, Linear task precision, Notion progressive disclosure, Arc-like calm surfaces, Slack/Superhuman command speed.
- Avoid: neon, glassmorphism, decorative gradients, oversized hero/dashboard charts, generic SaaS cards, crypto aesthetics, startup-bro language.
- Primary feeling: premium technical workspace for daily operators.

## Layout System

### Global Shell

The authenticated app uses a three-column architecture:

- Left: global navigation and workspace/user controls.
- Center: primary workspace.
- Right: persistent context panel.

Desktop should prioritize productivity. Tablet should retain two-pane work where possible. Mobile may collapse panels into drawers, but should not become a marketing-style page.

### Sidebar

Sections:

- Dashboard
- CRM
- Knowledge
- Workers
- Approvals
- Integrations
- Settings

Footer:

- Workspace switcher
- User menu
- Collapse control

Rules:

- Icons from Lucide.
- Labels visible when expanded.
- Tooltips when collapsed.
- Active state should be subtle but unmistakable.

### Center Workspace

The center workspace owns the main task. It should not be visually fragmented by nested cards. Use full-width bands, compact tables, split panes, and section dividers.

### Right Context Panel

The right panel is Leadsy's moat. It should show lead intelligence, AI findings, notes, task history, communication summaries, workflow status, and automation signals. It must remain visible on CRM and approval-heavy workflows unless the viewport cannot support it.

## Typography

- Use the existing app font stack unless a future implementation adds a dedicated font intentionally.
- No viewport-based font scaling.
- Letter spacing: `0` for normal UI text.
- Hero-scale type only on true public/landing hero sections.
- Dense application views should use compact headings and strong hierarchy through weight, spacing, and muted metadata.

Recommended scale:

- Page title: 24-28px.
- Section title: 14-18px.
- Table row primary text: 13-14px.
- Metadata: 11-12px.
- Monospace metadata: existing mono treatment is acceptable for IDs, states, timestamps, and technical status.

## Spacing

- Base grid: 4px.
- Compact row height: 44-56px.
- Toolbar height: 40-48px.
- Sidebar item height: 40-44px.
- Panel padding: 12-20px based on density.
- Avoid large empty vertical gaps in authenticated views.

## Radius and Borders

- Default radius: 6px.
- Larger containers: 8px maximum unless existing primitives require otherwise.
- Use borders and background contrast instead of shadows for separation.
- Avoid cards inside cards.

## Color

Current dark + teal direction is compatible with Leadsy. Keep it, but broaden status colors carefully:

- Teal: primary intelligence/action accent.
- Amber: human review, pending approval, risk.
- Lime/green: healthy, completed, qualified.
- Sky/blue: integration, source, sync.
- Violet: automation/workflow metadata.
- Neutral gray: inactive, archived, unknown.

Rules:

- No dominant purple/blue gradients.
- No one-note palette.
- Status color must encode state, not decorate.
- Preserve accessible contrast on dark backgrounds.

## Core Components

### Tables

Use tables for leads, workers, workflows, approvals, tasks, executions, and costs.

Required behavior:

- Compact rows.
- Sticky column headers when useful.
- Sort/filter-ready structure.
- Multi-select-ready checkboxes for approval and lead actions.
- Empty states that explain next operational action, not marketing copy.

### Split Panes

CRM default:

- Left pane: lead list.
- Center pane: selected lead workspace.
- Right pane: knowledge panel.

Approval default:

- Left/center: queue table.
- Right: selected item review context and action history.

### Tabs

Use tabs inside a selected lead or selected worker only:

- Overview
- Communications
- Tasks
- Notes
- Knowledge

Tabs must not cause full page reloads when implemented client-side later. Current server query-param behavior can be preserved during incremental migration.

### Drawers and Modals

Use drawers for contextual editing and detail expansion. Use modals for destructive confirmations and focused approval/reject/edit flows.

No browser `alert`, `confirm`, or `prompt`.

### Command Controls

Use icons for common tool actions where Lucide provides a familiar symbol:

- Search
- Filter
- More
- Edit
- Archive
- Approve
- Reject
- Escalate
- Open external
- Refresh

Pair icons with labels for primary commands and destructive actions.

## Product Surfaces

### Dashboard

Dashboard is for operators, not executives.

Required modules:

- New leads.
- Qualified leads.
- Escalations.
- Active tasks.
- Worker activity.
- Pending approvals.
- Qualification funnel.
- Lead source breakdown.
- Worker throughput.
- Recent activity stream.

Everything clickable.

### CRM

CRM is the heart of the app, but Leadsy should frame it as lead intelligence operations.

Lead list:

- Search.
- Filters.
- Saved-view-ready controls.
- Infinite-scroll-ready list body.
- Multi-select-ready rows.
- Name, company/contact, qualification, last activity, owner, status.

Lead detail:

- Name/company/contact identity.
- Status.
- Qualification.
- Quick actions.
- Tabs for overview, communications, tasks, notes, knowledge.

Knowledge panel:

- AI findings.
- Recent notes.
- Tasks.
- Communication summaries.
- Lead intelligence.
- Execution/workflow metadata.

### Workers

Workers are AI operators.

Use a table and side panel with:

- Worker name.
- Status.
- Last run.
- Queue.
- Output count.
- Approval status.
- Failure state.
- Retry action.

### Approvals

Central review queue for:

- Research.
- Tasks.
- Notes.
- Drafts.
- Outreach.

Actions:

- Approve.
- Reject.
- Edit.
- Escalate.
- Bulk approve/reject/escalate.

### Communications

Conversation-first timeline supporting:

- WhatsApp.
- Instagram.
- Messenger/Facebook.
- Email.
- Manual notes/calls.

Pinned summaries and important signals should be visible above the timeline.

### Settings

Searchable sections:

- Profile.
- Workspace.
- Integrations.
- AI.
- Workers.
- Notifications.
- Meta.
- WhatsApp.
- Extension.
- Infrastructure.

Infrastructure -> Automation must eventually show:

- n8n URL.
- n8n health.
- Workflow count.
- Last execution.
- Failed executions.
- Queue status.
- Links to dashboard, workflows, and executions.

## Implementation Rules

- Use existing Next.js App Router structure.
- Preserve existing route handlers, stores, env vars, auth, integrations, and deployment.
- Prefer existing local primitives where sufficient.
- Add shadcn/Radix patterns only where they improve consistency and do not destabilize the app.
- Keep backend/API contracts unchanged during frontend redesign.
- Make changes incrementally and keep existing tests passing.

## Accessibility Rules

- All icon-only buttons need `aria-label`.
- Controls need visible focus states.
- Tables need semantic headers where practical.
- Mutations need clear success/error feedback through the existing toast system.
- Forms need inline validation and `aria-invalid` where applicable.

## Baseline Reference

Before redesign, route screenshots were captured in `docs/ui-baseline/`. Use those images to preserve working flows and avoid losing functionality during visual refactors.
