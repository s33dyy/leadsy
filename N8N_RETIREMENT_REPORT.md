# N8N Retirement Report

## Summary

Leadsy has retired n8n as an application runtime dependency. Automation remains part of the product, but it now runs through Leadsy-native Next.js, API, and app-owned data flows instead of a separate workflow runner.

This retirement keeps Leadsy as the source of truth for auth, users, CRM state, leads, conversations, messages, assignments, tasks, reminders, escalations, audit history, WhatsApp/Twilio transport, simulator transport, and operator notifications.

## Removed app surfaces

- Removed `/api/automation/agent`.
- Removed `/api/automation/executions`.
- Removed `apps/web/src/lib/n8n-automation-gateway.ts`.
- Removed n8n workflow blueprints and exported workflow JSON from `packages/workflows`.
- Removed n8n workflow export and gateway test scripts.
- Removed n8n dashboard links, service status rows, setup cards, provider ownership copy, and backend-agent copy from the app UI.
- Removed package scripts for n8n workflow export and n8n-specific tests.

## Leadsy-native replacements

- Follow-up scheduling is represented by the Leadsy automation catalog and task APIs.
- Reminder generation is represented by Leadsy-native task and notification configuration.
- Task creation remains accountable to human owners in Leadsy.
- Escalation rules remain stored and surfaced in Leadsy.
- Audit events stay in the Leadsy security/event boundary.
- Email/operator notification settings are web-service configuration, not external runner provider config.

## Preserved boundaries

- No autonomous outreach was introduced.
- Worker events, system events, and task events remain separate from conversation messages.
- CRM data stays in Leadsy-owned stores and Postgres-ready app architecture.
- Twilio and WhatsApp routes stay in Leadsy.
- Meta and extension backend routes are preserved independently of this retirement.

## Railway cleanup checklist

After the web service deployment for this retirement is verified on `main`:

- Disable or remove the separate Railway `n8n` service.
- Remove n8n-only web-service variables if present:
  - `N8N_PUBLIC_URL`
  - `N8N_INTERNAL_URL`
  - `N8N_BACKEND_AGENT_WORKFLOW_ID`
  - `N8N_HEALTH_TIMEOUT_MS`
  - `LEADSY_N8N_WEBHOOK_SECRET`
- Confirm production readiness no longer depends on `https://n8n-production-3749.up.railway.app`.
- Keep Postgres and Leadsy web variables untouched.

## Verification

Run these checks after implementation:

```bash
rg -n "n8n|N8N|LEADSY_N8N" apps/web/src packages scripts package.json
npm run test:automation-retirement
npm run typecheck
npm run lint
npm run test
npm run build
```

The first command should return no runtime references. This report is intentionally outside that runtime scan.

## Rollback note

Rollback should restore the last production commit before this retirement if a real dependency on n8n is discovered. Do not reintroduce n8n piecemeal into user-facing setup. If an external workflow runner becomes necessary later, add it behind a new explicit integration boundary and document why Leadsy-native automation is insufficient.
