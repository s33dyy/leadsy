# Leadsy Revenue OS

Leadsy is an AI-powered Lead Operating System for agencies, Indian SMBs, real estate teams, and revenue operators. It finds prospects from approved sources, turns expensive Meta leads into qualified WhatsApp conversations, books appointments, manages follow-ups, and produces client-ready reporting.

## Stack

- Monorepo: npm workspaces
- App: Next.js App Router, React, TypeScript, Tailwind CSS
- Data plane: PostgreSQL + pgvector schema, Redis-ready queue/cache layer
- AI plane: typed provider abstraction with deterministic local provider and gateway-ready environment contract
- Backend: Next.js route handlers, domain packages, event bus, rate limits, audit logging, RBAC
- UI: dark-mode first product workspace with command center, lead magnet, CRM, enrichment, outreach, workflows, analytics, capture, onboarding

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local Data

Leadsy keeps visible local development data inside `./data` in the local project:

- `data/app`: first-party auth, owner/client records, lead briefs, research history, lead dossiers, drafts, and agent activity logs.
- `data/postgres`: PostgreSQL + pgvector files when Docker Compose is running.
- `data/redis`: Redis append-only data when Docker Compose is running.

You can point the local app at another app-data directory with:

```bash
LEADSY_DATA_DIR=/absolute/path/to/leadsy-data npm run dev
```

Docker Compose mounts `./data/app` into the web container at `/data/leadsy`, so the local app and Docker app use the same local JSON store during development.

## Lead Magnet Spend Guard

For real local research, set `OPENROUTER_API_KEY` in `.env.local`. Leadsy previews concrete search lanes first, runs free public search/fetch tools, and only spends AI credit on dossier work after promising public candidates exist. The default local cap is `LEADSY_SPEND_CAP_INR=1`; keep `LEADSY_AI_PLANNER_ENABLED=false` unless you explicitly want OpenRouter to generate the search plan too.

Lead Magnet public research uses a compliant OSINT fetch policy: optional configured search APIs first, then throttled public HTML search, then transparent website fetches with robots checks, per-domain caps, `Retry-After` backoff, cache, and alternate public-source recovery when a direct site blocks.

Lead goals can be set up to 1000. Leadsy treats goals above 100 as staged campaigns: each run works a 50-100 prospect batch, avoids domains already saved for that campaign, reports discarded search noise separately from blocked/rejected pages, and only marks a lead Good when identity, public evidence, location proof, buyer fit, and a contact path are present.

## Docker

Docker Desktop must be running first.

```bash
npm run docker:up
```

This starts the Next.js app on [http://localhost:3000](http://localhost:3000), PostgreSQL with pgvector on port `5432`, and Redis on port `6379`.

```bash
npm run docker:down
```

## Scripts

```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # TypeScript
npm run seed       # prints clean seed counts for the empty workspace
npm run docker:up   # app + postgres + redis through Docker Compose
npm run docker:down # stop Docker Compose services
```

## Package Map

- `apps/web`: product UI, API routes, onboarding, command center
- `packages/domain`: typed agency, Meta lead, WhatsApp, qualification, CRM, and analytics domain model
- `packages/ai`: copilot, lead discovery, Meta qualification, WhatsApp reply, enrichment, and scoring interfaces
- `packages/security`: RBAC, tenant guards, rate limits, audit logs
- `packages/events`: event bus contract
- `packages/workflows`: workflow definition, validation, execution
- `packages/observability`: structured logging and span helper
- `packages/config`: environment validation
- `packages/db`: Prisma PostgreSQL + pgvector schema

## Docs

- [Architecture](./docs/architecture.md)
- [Modules](./docs/modules.md)
- [Deployment](./docs/deployment.md)
- [Roadmap](./docs/roadmap.md)
- [API](./docs/api.md)
- [Lead Magnet SOP](./docs/lead-magnet-sop.md)

## Current Core Flow

0. Lead Magnet scans approved sources and creates prospect candidates.
1. Instagram/Facebook lead arrives through Meta webhook.
2. Leadsy maps it to the correct agency client workspace.
3. AI qualifies budget, location, intent, timeline, language, sentiment, urgency, and spam risk.
4. WhatsApp first reply is queued immediately.
5. Hot leads are escalated to human closers or booked for meetings/site visits.
6. Follow-ups and client reports are generated from the same lifecycle data.
