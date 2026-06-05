# n8n Workflows

Status: workflow catalog, typed blueprint source, and source-controlled n8n JSON exports. The workflows are intentionally exported inactive and are not yet activated in production n8n.

## Source-Controlled Workflow Files

Typed source:

- `packages/workflows/src/automation-catalog.ts`
- `packages/workflows/src/n8n-blueprints.ts`

n8n import files:

- `packages/workflows/n8n/lead-added.json`
- `packages/workflows/n8n/lead-updated.json`
- `packages/workflows/n8n/research-requested.json`
- `packages/workflows/n8n/qualification-requested.json`
- `packages/workflows/n8n/task-generated.json`
- `packages/workflows/n8n/approval-requested.json`
- `packages/workflows/n8n/follow-up-due.json`
- `packages/workflows/n8n/meta-lead-received.json`
- `packages/workflows/n8n/whatsapp-message-received.json`
- `packages/workflows/n8n/worker-retry.json`
- `packages/workflows/n8n/index.json`

Generation command:

```bash
npm run workflows:export-n8n
```

Validation command:

```bash
npm run test:n8n-workflows
```

Import posture:

- Import one JSON workflow file at a time into n8n.
- Keep imported workflows inactive until Leadsy automation action endpoints and service authentication are in place.
- Reconnect credentials in n8n instead of storing secrets in workflow JSON.

## Global Rules

- n8n is the automation engine only.
- Leadsy Next.js APIs remain the auth, RBAC, tenant isolation, database access, and API layer.
- Postgres remains the source of truth for business state.
- n8n must call Leadsy APIs for reads/writes instead of writing Leadsy business tables directly.
- Every workflow must log execution, support retries, write audit events through Leadsy, and store execution metadata in Leadsy-owned automation tables/APIs once implemented.
- Workflows should be idempotent using a Leadsy-supplied idempotency key.

## Shared Execution Metadata

Each workflow execution should record:

- `workflowKey`
- `workflowName`
- `n8nWorkflowId`
- `n8nExecutionId`
- `tenantId`
- `ownerId`
- `triggerType`
- `triggerId`
- `idempotencyKey`
- `status`
- `startedAt`
- `completedAt`
- `durationMs`
- `retryCount`
- `lastError`
- `leadId`
- `taskId`
- `conversationId`
- `meta`
- `cost`

## Shared Retry Policy

- Retry transient failures 3 times.
- Backoff: 1 minute, 5 minutes, 15 minutes.
- Stop immediately on authentication, authorization, tenant mismatch, validation, or approval-required errors.
- Write a failed execution record after final retry.
- Create or update an operator-visible approval/escalation item when human action is needed.

## Shared Audit Events

Leadsy should expose an audit endpoint or internal repository call for workflow events:

- `automation.workflow.triggered`
- `automation.workflow.started`
- `automation.workflow.succeeded`
- `automation.workflow.failed`
- `automation.workflow.retry_scheduled`
- `automation.workflow.approval_required`
- `automation.workflow.action_dispatched`

## Workflow Definitions

### 1. Lead Added

Trigger:

- Leadsy emits/records a lead-created event after `/api/leads/manual`, Meta ingestion, extension sync, or future Postgres lead creation.

Inputs:

- `tenantId`
- `ownerId`
- `leadId`
- `source`
- `createdAt`
- `idempotencyKey`

Steps:

1. Fetch lead summary from Leadsy API.
2. Write `automation.workflow.started`.
3. If source has enough context, request qualification.
4. If source is Meta/WhatsApp/extension, update lead intelligence summary request queue.
5. If follow-up is needed, generate a task suggestion through Leadsy API.
6. Write execution metadata and `automation.workflow.succeeded`.

Outputs:

- Qualification request metadata.
- Optional task suggestion.
- Execution record.

Failure modes:

- Missing lead: mark failed, no retry.
- Leadsy API 5xx: retry.
- Duplicate idempotency key: mark skipped/succeeded.

Dependencies:

- Leadsy lead read API.
- Leadsy qualification request API.
- Leadsy task generation API.

### 2. Lead Updated

Trigger:

- Leadsy emits/records lead-updated event after status, edit, message, task, or knowledge mutation.

Inputs:

- `tenantId`
- `ownerId`
- `leadId`
- `changedFields`
- `changedBy`
- `idempotencyKey`

Steps:

1. Fetch current lead intelligence.
2. Determine whether knowledge summary, qualification, or follow-up schedule needs refresh.
3. Trigger only needed downstream workflow(s).
4. Write audit and execution metadata.

Outputs:

- Refresh decisions.
- Downstream workflow links.

Failure modes:

- No actionable fields: succeeded/no-op.
- Conflicting updates: retry after short backoff.

Dependencies:

- Leadsy lead read API.
- Leadsy automation execution API.

### 3. Research Requested

Trigger:

- Operator requests research from Leadsy UI/API.
- Scheduled research campaign in n8n after Leadsy stores campaign/source state.

Inputs:

- `tenantId`
- `ownerId`
- `leadId` or `researchRequestId`
- `brief`
- `sourceTypes`
- `budgetCap`
- `idempotencyKey`

Steps:

1. Fetch request and current knowledge.
2. Call Leadsy research API or internal approved endpoint.
3. Track OpenRouter usage/cost returned by Leadsy.
4. Write research results to Leadsy through Leadsy API.
5. Route uncertain findings to Approval Requested.
6. Write execution metadata.

Outputs:

- Research summary.
- Evidence URLs.
- Cost metadata.
- Approval items for uncertain/draft outputs.

Failure modes:

- Missing evidence: completed with low-confidence/no-save.
- OpenRouter unavailable: completed with deterministic fallback or failed based on request settings.
- Spend cap exceeded: completed/blocked with clear reason.

Dependencies:

- Leadsy research endpoint.
- OpenRouter through Leadsy only.
- Leadsy audit endpoint.

### 4. Qualification Requested

Trigger:

- Lead Added.
- Lead Updated with new communication/facts.
- Operator manual request.

Inputs:

- `tenantId`
- `ownerId`
- `leadId`
- `conversationId`
- `qualificationProfileId`
- `idempotencyKey`

Steps:

1. Fetch lead and qualification profile from Leadsy.
2. Request qualification through Leadsy AI/provider abstraction.
3. Store qualification result through Leadsy API.
4. If hot/urgent, trigger Approval Requested or Task Generated.
5. Write cost and execution metadata.

Outputs:

- Qualification stage.
- Scores.
- Recommended action.
- Optional task/approval trigger.

Failure modes:

- Missing profile: route to setup/approval.
- Model failure: retry if transient; fallback if allowed.

Dependencies:

- Leadsy qualification profile API.
- Leadsy AI provider abstraction.

### 5. Task Generated

Trigger:

- Leadsy creates an extension/CRM/follow-up task.

Inputs:

- `tenantId`
- `ownerId`
- `taskId`
- `leadId`
- `taskType`
- `requiresApproval`
- `idempotencyKey`

Steps:

1. Fetch task from Leadsy.
2. If approval required, trigger Approval Requested.
3. If due date exists, schedule Follow-up Due.
4. If worker retry policy applies, schedule Worker Retry.
5. Write execution metadata.

Outputs:

- Approval item or schedule record.
- Execution record.

Failure modes:

- Task already deleted/cancelled: no-op.
- Tenant mismatch: fail without retry.

Dependencies:

- Leadsy task APIs.

### 6. Approval Requested

Trigger:

- Research output needs review.
- Draft outreach generated.
- Task requires human approval.
- Qualification requests escalation.

Inputs:

- `tenantId`
- `ownerId`
- `approvalType`
- `resourceId`
- `leadId`
- `summary`
- `risk`
- `idempotencyKey`

Steps:

1. Create/update approval item in Leadsy.
2. Notify assigned owner if notification channel exists.
3. Wait for Leadsy approval/rejection/edit result.
4. Continue downstream workflow only after approved.
5. Write audit and execution metadata.

Outputs:

- Approval item.
- Approval status.
- Downstream continuation link.

Failure modes:

- No owner: escalate to workspace admin.
- Timeout: mark stale and surface in Approval Center.

Dependencies:

- Leadsy approval/task APIs.
- Notification channel through Leadsy.

### 7. Follow-up Due

Trigger:

- Scheduled due check in n8n.
- Task Generated with due date.

Inputs:

- `tenantId`
- `ownerId`
- `followUpTaskId`
- `leadId`
- `dueAt`
- `idempotencyKey`

Steps:

1. Fetch current follow-up task from Leadsy.
2. Verify it is still open and due.
3. Generate suggested follow-up through Leadsy if needed.
4. Route suggested message to Approval Requested.
5. Mark reminder dispatched through Leadsy.

Outputs:

- Reminder/approval item.
- Optional draft metadata.

Failure modes:

- Task completed: no-op.
- Lead excluded: no-op.
- Draft failure: create manual review task.

Dependencies:

- Leadsy CRM follow-up task API.
- Leadsy AI provider abstraction.

### 8. Meta Lead Received

Trigger:

- Existing Leadsy Meta webhook route stores a Meta-derived lead/communication and emits automation trigger.

Inputs:

- `tenantId`
- `ownerId`
- `leadId`
- `metaObject`
- `assetIds`
- `campaignId`
- `idempotencyKey`

Steps:

1. Fetch stored lead from Leadsy.
2. Confirm it was routed from Meta assets.
3. Trigger Qualification Requested.
4. If qualified or urgent, trigger Task Generated or Approval Requested.
5. Write execution metadata.

Outputs:

- Qualification execution.
- Optional task/approval.

Failure modes:

- Ambiguous asset routing: create admin review item.
- Signature/webhook verification failure: should never reach n8n.

Dependencies:

- Existing Leadsy Meta webhook routes.
- Leadsy qualification/task APIs.

### 9. WhatsApp Message Received

Trigger:

- Existing Leadsy WhatsApp/Meta webhook route stores inbound WhatsApp message and emits automation trigger.

Inputs:

- `tenantId`
- `ownerId`
- `leadId`
- `conversationId`
- `messageId`
- `direction`
- `idempotencyKey`

Steps:

1. Fetch conversation and lead context from Leadsy.
2. If inbound and active lead, request reply suggestion/qualification through Leadsy.
3. Create approval item for any outbound draft.
4. Update conversation summary through Leadsy.
5. Write execution metadata and cost metadata.

Outputs:

- Suggested reply approval.
- Updated summary.
- Qualification refresh.

Failure modes:

- Duplicate message: no-op.
- Lead excluded: no-op.
- Approval required: pause downstream send.

Dependencies:

- Existing Leadsy WhatsApp webhook handling.
- Leadsy reply/AI endpoints.

### 10. Worker Retry

Trigger:

- Worker task failed, blocked, or postponed with retryable reason.
- Scheduled retry due time.

Inputs:

- `tenantId`
- `ownerId`
- `taskId`
- `leadId`
- `failureReason`
- `retryCount`
- `retryAfter`
- `idempotencyKey`

Steps:

1. Fetch current task from Leadsy.
2. Verify retry is allowed and task is not deleted/completed.
3. If human approval needed, route to Approval Requested.
4. If retryable, update task status/due time through Leadsy.
5. If retry exhausted, escalate to operator.
6. Write execution metadata.

Outputs:

- Rescheduled task or escalation item.
- Execution record.

Failure modes:

- Non-retryable failure: escalate.
- Retry exhausted: escalate.
- Task no longer active: no-op.

Dependencies:

- Leadsy extension task APIs.

## Workflow Visibility Requirements

Leadsy Settings -> Infrastructure -> Automation should display:

- Workflow name.
- Purpose.
- Trigger.
- Last execution.
- Last status.
- Failure count.
- Retry count.
- Linked n8n workflow.
- Linked n8n execution.
- Leadsy audit/event links.

## Testing Requirements

For each workflow:

- Test idempotency key handling.
- Test success path.
- Test Leadsy API 5xx retry path.
- Test validation failure no-retry path.
- Test approval-required pause path.
- Test audit/event write.
- Test execution metadata persistence.

## Restore Requirements

- Export n8n workflows after every production edit.
- Store exported workflow JSON in source control only after secrets are removed.
- Keep workflow credentials in Railway/n8n credential storage, not Git.
- Restore by importing workflow JSON, reconnecting credentials, then running dry-run triggers against staging/local data.
