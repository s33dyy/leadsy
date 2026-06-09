# Leadsy Automation Migration Plan

Date: 2026-06-06
Status: Plan only. No automation refactor or n8n activation has started.

## Objective

Use n8n only for qualification workflows, follow-up sequences, notifications, routing, and automation orchestration while keeping auth, RBAC, CRM data, tenant logic, business rules, and durable state in Leadsy.

Primary workflow:

```text
Lead Source -> AI Qualification -> CRM -> Assignment -> Follow-Up -> Conversion
```

## Non-Negotiable Boundary

Leadsy owns:

- Authentication
- RBAC
- Tenant isolation
- CRM records
- Lead records
- Contact and conversation records
- Qualification snapshots
- Assignment rules
- Follow-up tasks and campaign state
- Business logic
- Audit logs
- Provider webhook verification
- Deployment-sensitive integrations

n8n may own:

- Timed waits
- Multi-step orchestration
- Retry orchestration
- Notifications
- Routing workflow execution
- Qualification workflow sequencing
- Follow-up sequence timing
- Calling Leadsy-approved action endpoints

n8n must not own:

- Lead source of truth
- User permissions
- CRM tables
- Auth sessions
- Business decision persistence
- Direct mutable access to provider webhooks
- Direct storage of customer records beyond execution metadata

## Existing Automation Assets

Current assets to preserve:

- `packages/workflows/src/automation-catalog.ts`
- `packages/workflows/src/n8n-blueprints.ts`
- `packages/workflows/n8n/leadsy-automation-router.json`
- `packages/workflows/n8n/index.json`
- `apps/web/src/app/api/automation/agent/route.ts`
- `N8N_WORKFLOWS.md`
- `DEVELOPER_AUTOMATION_GUIDE.md`
- `RAILWAY_MIGRATION_PLAN.md`

Existing catalog events:

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

These events are close to the requested product flow. They should be renamed or grouped in UI around Lead Capture, Qualification, Assignment, Follow-Up, and Conversion rather than research/workers.

## Target Trigger Map

| Product moment | Leadsy event/action | n8n role | Leadsy-owned result |
| --- | --- | --- | --- |
| Meta lead received | Verify webhook, create/update lead | Start qualification workflow | Lead and source audit |
| WhatsApp message received | Verify/store message, attach lead | Refresh qualification, suggest reply | Message, summary, status suggestion |
| Manual lead created | Create lead | Optional route/qualification workflow | Lead record and assignment state |
| Website form submitted | Verify/store form lead | Start qualification workflow | Lead record and source audit |
| CSV imported | Batch create leads | Optional qualification queue | Lead records and import audit |
| Qualification requested | Create AI qualification job | Ask/score/summarize sequence | Qualification snapshot |
| Lead qualified | Update lead status | Notify/route owner | Status, owner, task |
| Follow-up due | Find due task | Wait/notify/queue message | Task update and audit |
| Campaign segment selected | Create campaign run | Sequence sends and reminders | Campaign status and metrics |
| Conversion status changed | Update lead/deal | Notify/report | Won/Lost state and analytics |

## Required Leadsy Action Endpoints

The n8n router should stay inactive until these Leadsy-owned endpoints exist and are tested.

Service auth:

- `POST /api/automation/service-auth/verify`
- `POST /api/automation/executions/start`
- `POST /api/automation/executions/complete`
- `POST /api/automation/executions/fail`

Lead actions:

- `GET /api/automation/leads/:id`
- `POST /api/automation/leads/:id/status`
- `POST /api/automation/leads/:id/owner`
- `POST /api/automation/leads/:id/activity`

Qualification actions:

- `POST /api/automation/qualification/request`
- `POST /api/automation/qualification/result`
- `POST /api/automation/qualification/question`

Follow-up actions:

- `POST /api/automation/follow-ups/schedule`
- `POST /api/automation/follow-ups/mark-due`
- `POST /api/automation/follow-ups/result`

Communication actions:

- `POST /api/automation/messages/suggest-reply`
- `POST /api/automation/messages/queue`
- `POST /api/automation/messages/approval-request`
- `POST /api/automation/messages/send-approved`

Routing actions:

- `POST /api/automation/routing/evaluate`
- `POST /api/automation/routing/apply`

Campaign actions:

- `POST /api/automation/campaigns/run`
- `POST /api/automation/campaigns/message-result`

These endpoints should enforce tenant, role, idempotency, rate limits, and audit logging.

## Workflow 1: Lead Created Qualification

Trigger:

- Lead created from Meta, Website Form, WhatsApp, Instagram, Messenger, Email, Manual Lead, or CSV import.

Leadsy steps:

1. Verify source.
2. Create or update unified lead record.
3. Attach source metadata.
4. Emit `lead-added` or source-specific event.

n8n steps:

1. Call Leadsy qualification request endpoint.
2. Wait for result or retry.
3. Call Leadsy routing evaluation endpoint if qualified.
4. Notify assigned owner if required.

Leadsy result:

- Qualification snapshot
- Product status update
- Owner assignment or unassigned queue
- Audit event

## Workflow 2: Inbound Message Qualification Refresh

Trigger:

- WhatsApp, Instagram, Messenger, Email, or extension-captured inbound message.

Leadsy steps:

1. Verify and store message.
2. Attach message to lead.
3. Emit message received event.

n8n steps:

1. Request AI summary refresh.
2. Request missing qualification question or suggested reply.
3. Queue internal note or owner notification.

Leadsy result:

- Updated summary
- Suggested reply
- Qualification status reason
- Inbox notification

## Workflow 3: Assignment Routing

Trigger:

- New lead, qualified lead, interested lead, owner removed, or SLA breach.

Leadsy steps:

1. Load assignment rules.
2. Enforce tenant and role access.
3. Provide candidate routing result to n8n if orchestration is required.

n8n steps:

1. Apply wait, branch, escalation, or notification rules.
2. Call Leadsy apply endpoint.

Leadsy result:

- Owner assigned
- Assignment reason stored
- Team workload metric updated
- Audit event

## Workflow 4: Follow-Up Due

Trigger:

- Follow-up task due at 3 hours, 24 hours, 7 days, 30 days, or configured interval.

Leadsy steps:

1. Store canonical follow-up task and due time.
2. Emit follow-up due event.

n8n steps:

1. Wait until due time.
2. Call Leadsy to verify current lead state.
3. Queue message, reminder, or notification.
4. Stop if lead is Won, Lost, opted out, or assigned workflow has changed.

Leadsy result:

- Task status update
- Queued message or internal reminder
- Audit event
- Follow-up effectiveness data

## Workflow 5: Re-Engagement Campaign

Trigger:

- Segment selected by operator.

Examples:

- Source = Meta
- Status = Interested
- Last activity older than 7 days

Leadsy steps:

1. Create campaign run.
2. Snapshot segment membership.
3. Require approval for outbound rules.

n8n steps:

1. Sequence messages and waits.
2. Call Leadsy for each approved send or reminder.
3. Report provider status updates back to Leadsy.

Leadsy result:

- Sent, delivered, read, replied metrics
- Lead status changes
- Campaign analytics

## Workflow 6: Notification And Escalation

Trigger:

- High intent score
- No owner assigned
- Follow-up overdue
- Human review required
- Hot lead from Meta or WhatsApp

n8n steps:

1. Select notification path.
2. Notify agent, manager, or team channel.
3. Call Leadsy to write audit and task state.

Leadsy result:

- Notification audit
- Escalation activity
- Manager or owner task

## Data Model Needs

Add or formalize these Leadsy-owned records before automation activation:

- Automation definition
- Automation execution
- Automation execution step
- Idempotency key
- Qualification snapshot
- Assignment decision
- Follow-up sequence
- Follow-up sequence step
- Campaign run
- Campaign recipient
- Message delivery receipt

Existing Prisma models can support part of this, especially `Workflow`, `AuditLog`, `QualificationSnapshot`, `FollowUpTask`, `WhatsAppConversation`, and `WhatsAppMessage`.

## Execution Metadata

Every n8n call to Leadsy should include:

- `tenantId`
- `workflowKey`
- `workflowVersion`
- `n8nExecutionId`
- `idempotencyKey`
- `triggerEventId`
- `leadId` when applicable
- `source`
- `requestedAction`

Leadsy should reject calls missing required metadata.

## Activation Stages

Stage 0: Keep router inactive.

- Confirm current tests pass.
- Add service-auth endpoint tests.
- Add idempotency tests.

Stage 1: Dry-run automation gateway.

- n8n calls Leadsy dry-run endpoints only.
- Leadsy records execution attempts without mutating lead state.
- Operators can inspect execution history.

Stage 2: Qualification result writes.

- Allow n8n to request qualification.
- Leadsy writes snapshots and suggestions.
- No outbound sends yet.

Stage 3: Assignment and notification.

- Allow routing decisions to update owner after Leadsy validation.
- Notify users through approved channels.

Stage 4: Follow-up sequences.

- Allow due reminders and queued messages.
- Require approval for actual outbound sends unless workspace rules permit automation.

Stage 5: Campaign automation.

- Add segment snapshots, approval, delivery receipts, replies, and conversion attribution.

## Testing Plan

Existing tests to preserve:

```bash
npm run test:preserved-integrations
npm run test:n8n-workflows
npm run test:automation-gateway
npm run test:whatsapp-crm-v1
npm run typecheck
npm run lint
npm run build
```

New test coverage needed:

- n8n service-auth acceptance and rejection
- idempotent execution start/complete/fail
- lead status update authorization
- qualification result validation
- follow-up due guard when lead is Won/Lost/opted out
- assignment rule audit trail
- campaign recipient snapshot immutability
- message approval before send

## Rollback Plan

Automation rollout should be reversible:

- Keep current Leadsy APIs as the source of truth.
- Keep n8n router inactive by default until activation stage.
- Feature flag each automation group.
- Store execution state in Leadsy for audit and rollback.
- Make n8n failures create visible failed execution records rather than hidden data loss.
- Do not remove existing manual and extension workflows during automation rollout.

