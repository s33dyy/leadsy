# Developer Automation Guide

Status: founder-readable guide for the planned n8n automation layer.

## Plain-English Overview

Leadsy has three different responsibilities:

1. The Leadsy app decides who is allowed to do what, stores the business data, and shows the product UI.
2. Postgres stores the durable business record.
3. n8n runs timed and multi-step automations.

n8n should behave like an operations coordinator. It can say, "this lead needs qualification," "this follow-up is due," or "this failed worker task should be retried." It should not become the place where leads, notes, messages, tasks, tenants, permissions, or customer records live.

## Where Automations Live

Planned n8n workflows:

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

Workflow documentation lives in:

- `N8N_WORKFLOWS.md`

Railway setup documentation lives in:

- `RAILWAY_MIGRATION_PLAN.md`

Frontend/backend audit references live in:

- `UI_AUDIT.md`
- `BACKEND_AUDIT.md`

## What Stays in Leadsy

Leadsy keeps:

- Login and sessions.
- User permissions.
- Workspace and tenant rules.
- Lead records.
- Knowledge records.
- Communications.
- CRM tasks.
- Notes.
- Meta webhook verification.
- WhatsApp message handling.
- OpenRouter provider routing.
- Browser extension authentication.
- Audit logs.

## What n8n Does

n8n handles:

- Scheduled follow-up checks.
- Research pipelines.
- Qualification pipelines.
- Approval routing.
- Retry timing.
- Notification orchestration.
- Multi-step workflow status.

n8n calls Leadsy APIs to read or change business state.

## Railway Services

Existing service:

- Leadsy web app.

New planned service:

- `n8n`.

Existing databases/services:

- Postgres.
- Redis if present.

Important rule:

- Do not change or redeploy the existing web service just to create n8n.
- n8n is a separate service in the same Railway project.

## Railway Variables

Existing Leadsy variables stay where they are.

n8n-specific variables belong on the n8n service:

- `N8N_ENCRYPTION_KEY`
- `N8N_HOST`
- `N8N_PORT`
- `N8N_PROTOCOL`
- `N8N_EDITOR_BASE_URL`
- `WEBHOOK_URL`
- `GENERIC_TIMEZONE`
- `DB_TYPE`
- `DB_POSTGRESDB_HOST`
- `DB_POSTGRESDB_PORT`
- `DB_POSTGRESDB_DATABASE`
- `DB_POSTGRESDB_USER`
- `DB_POSTGRESDB_PASSWORD`
- `DB_POSTGRESDB_SCHEMA`
- `EXECUTIONS_MODE`
- Redis queue variables if queue mode is enabled.

Leadsy may later receive additive n8n visibility variables:

- `N8N_INTERNAL_URL`
- `N8N_PUBLIC_URL`
- `N8N_API_KEY`
- `N8N_HEALTH_TIMEOUT_MS`

These are for the admin dashboard only.

## How Workflows Are Deployed

Planned process:

1. Build or edit workflow in n8n.
2. Test with non-production data.
3. Export workflow JSON from n8n.
4. Remove secrets from exported JSON.
5. Commit workflow JSON to the repo if the team chooses source-controlled workflows.
6. Import/update workflow in production n8n.
7. Verify the workflow appears in Leadsy Settings -> Infrastructure -> Automation.

## How Workflows Are Edited

Edit in n8n when changing:

- Schedule timing.
- Step order.
- Retry timing.
- Notification routing.
- Approval routing.

Edit in Leadsy code when changing:

- Authentication.
- Authorization.
- Database writes.
- Lead/task/knowledge APIs.
- Webhook verification.
- OpenRouter provider behavior.
- How the UI displays automation state.

## How Workflows Are Tested

Every workflow should have:

- A dry-run trigger.
- A known safe lead/task/conversation fixture.
- A success-path test.
- A duplicate/idempotency test.
- A retry test.
- A validation-failure test.
- An approval-required test.

For a founder/non-technical operator, the test result should answer:

- Did it run?
- What did it touch?
- Did it create anything?
- Did it spend AI credits?
- Did it require approval?
- What failed, if anything?

## How Workflows Are Monitored

Leadsy should show:

- n8n health.
- Workflow count.
- Last execution.
- Failed executions.
- Queue status.
- Per-workflow status.
- Links to open n8n dashboard.
- Links to open workflow.
- Links to open execution.

n8n should show:

- Execution logs.
- Failed nodes.
- Retry attempts.
- Workflow versions.

Railway should show:

- n8n service health.
- Logs.
- Restart history.
- Database/Redis connectivity.

## How Workflows Are Restored

If a workflow is accidentally changed or deleted:

1. Open the last exported workflow JSON.
2. Import it into n8n.
3. Reconnect credentials in n8n.
4. Disable it first.
5. Run a dry-run/manual trigger.
6. Confirm Leadsy logs the execution.
7. Enable it only after the test succeeds.

If n8n itself fails:

1. Pause workflow triggers from Leadsy.
2. Keep Leadsy web app running.
3. Use Leadsy manually for leads/tasks/communications.
4. Inspect Railway n8n logs.
5. Restore n8n from Railway service/database backups if needed.

## Common Founder Questions

### Where is my lead data?

In Leadsy/Postgres, not n8n.

### Where are automations?

In n8n, visible from Leadsy Settings -> Infrastructure -> Automation once implemented.

### Can n8n send WhatsApp messages by itself?

No. It can suggest or route approvals. Existing Leadsy/extension/WhatsApp handling remains the controlled execution path.

### Can I turn off automation?

The implementation should include an automation trigger toggle or pause strategy. Until then, pause workflows directly in n8n.

### What happens if AI fails?

The workflow should retry transient failures, then create a visible failed execution or approval/escalation item in Leadsy.

### What happens if n8n is down?

Leadsy should still work. Manual lead, task, knowledge, and communication workflows remain in the Next.js app.
