# Deployment Guide

## Local Dependencies

```bash
docker compose up -d
npm install
cp .env.example .env.local
npm run dev
```

## Production Environment

Required:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`

Recommended:

- `REDIS_URL`
- `AI_PROVIDER`
- `AI_DEFAULT_MODEL`
- `AI_GATEWAY_BASE_URL` / `AI_GATEWAY_API_KEY`
- `OPENROUTER_API_KEY`
- `LEAD_DISCOVERY_DAILY_LIMIT`
- `OUTBOUND_REQUIRE_APPROVED_SOURCE`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Database

The default schema is in `packages/db/prisma/schema.prisma` and targets PostgreSQL with pgvector.

Production checklist:

- provision managed PostgreSQL with point-in-time recovery
- enable pgvector
- add migrations
- generate Prisma client or swap to Drizzle repositories
- enforce tenant scoping in repositories and policies
- ship audit logs to immutable storage

## Workers

Move workflow execution, enrichment, outreach, and analytics aggregation to workers backed by Redis, BullMQ, Trigger.dev, Temporal, or a cloud-native queue. Route handlers should enqueue work and stream status over WebSocket or Server-Sent Events.

## Observability

Structured logs are emitted by `@leadsy/observability`. Connect to OpenTelemetry by replacing the span helper with SDK instrumentation and exporting traces to your observability vendor.

## Security

- Replace `getDemoSession()` with Auth.js, Clerk Enterprise, WorkOS, or custom OIDC.
- Store sessions in Redis or encrypted cookies.
- Use organization-level RBAC and permission checks from `@leadsy/security`.
- Keep API keys server-only.
- Rotate enrichment and messaging provider credentials.
- Add webhook signature verification for capture and outreach integrations.
