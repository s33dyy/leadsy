# Leadsy - AI Lead Intelligence & Operations Platform

## Machine Safety Rules

This project is developed on an 8 GB Mac. The machine can hang when multiple Codex/Claude chats, Next/Turbopack, Docker, and browser automation run together. Develop conservatively.

**Working directory**

- Use `/Users/pratikchoudhuri/Documents/leadsy` as the command path.
- That path is the canonical local project directory.
- Do not start dev servers from `/Volumes/Pratik's SSD/Projects/leadsy`; that external copy is archival.

**Process discipline**

- Before starting the app, check whether port `3000` is already listening.
- Keep only one Leadsy dev server running at a time.
- Do not leave duplicate `next dev`, `next build`, `npm`, `screen`, Docker, or browser verification processes running.
- Use `npm run dev`, not bare `next dev`. The dev script forces Webpack because Turbopack dev has panicked/hung on this machine.
- Keep `npm run build` as the normal production build command.
- If a command hangs, inspect and stop the stuck process before starting another copy.
- Avoid running more than one heavy verification command at once.

**Verification order**

Run checks sequentially:

```bash
npm run typecheck
npm run lint
npm run build
```

Do not run typecheck, lint, build, Docker Compose, and browser automation in parallel unless the user explicitly asks for speed over machine stability.

**Browser and Docker**

- Use browser automation sparingly. Prefer source/API verification first, then one browser pass if needed.
- Docker is optional for most UI/product work. Do not start `docker compose up` unless the task specifically needs Postgres/Redis or Docker validation.
- If Docker is running, remember it adds memory pressure.

**Local data**

- App JSON data: `data/app`
- PostgreSQL data: `data/postgres`
- Redis data: `data/redis`
- Do not create duplicate hidden data stores. `apps/web/.leadsy-data` should point to `data/app`.

**Known hang cause**

The old external-drive copy under `/Volumes/Pratik's SSD/Projects/leadsy` caused random dev-server failures when the drive unmounted or Next resolved paths with the apostrophe in the volume name. Keep active development on `/Users/pratikchoudhuri/Documents/leadsy`.

## Product Identity

Leadsy is an **AI Lead Intelligence & Operations Platform** that researches prospects, builds durable lead knowledge, generates tasks for human operators, drafts outreach for approval, and supports qualification without autonomous sends.

**Core loop**: Research → Knowledge → Task → Draft → Approve → Qualify → Support

## Stack Architecture

- **Monorepo**: npm workspaces (Next.js + domain packages)
- **Frontend**: Next.js App Router, React, TypeScript, Tailwind CSS
- **Data**: PostgreSQL + pgvector, Redis (queue/cache)
- **AI Plane**: OpenRouter web search/fetch, deterministic local provider fallback
- **Backend**: Next.js route handlers, event-driven workers, RBAC, audit logging

## Package Map

| Package | Purpose |
|---------|---------|
| `apps/web` | Product UI, API routes, authentication, lead intelligence workspace, extension support, and connection setup |
| `packages/domain` | Lead, agency, Meta, WhatsApp, CRM, enrichment models |
| `packages/ai` | Lead research, scoring, message drafting, copilot interfaces |
| `packages/db` | Prisma schema with pgvector support |
| `packages/security` | RBAC, tenant guards, rate limits, audit logs |
| `packages/workflows` | DAG workflow definitions and execution engine |
| `packages/events` | Event bus contracts (in-memory for dev) |
| `packages/observability` | Structured logging, span helpers |
| `packages/config` | Environment validation |

## Core Data Models

**Lead Research** (`packages/domain/src/index.ts`):
- `LeadBrief` - Owner's search criteria (service, ICP, locations, goal, sources)
- `LeadDossier` - Evidence-backed lead with contacts, scores, outreach angle
- `LeadScore` - fit/urgency/contactability/evidence/overall/confidence
- `EvidenceUrl` - Public source attribution for every claim

**Meta Lead Flow**:
- `MetaLead` - Instagram/Facebook webhook data normalized
- `QualificationSnapshot` - budget/location/urgency/spam scores
- `WhatsAppConversation` - AI-reply thread with summary

**Workflow Engine**:
- `WorkflowDefinition` - nodes + edges as typed DAG
- `WorkflowRun` - execution trace with step outputs

## Development Commands

```bash
npm install              # Install all workspaces
cp .env.example .env.local  # Create local env
npm run dev              # Next.js dev server using Webpack, not Turbopack
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript check
npm run seed             # Print seed counts
```

## AI Integration Pattern

1. **Local-first**: Works with `AI_PROVIDER=deterministic` (no API keys)
2. **OpenRouter + Leadsy tools**: OpenRouter plans, scores, extracts, and drafts; Leadsy runs the actual free public search/fetch tools and stores source evidence.
3. **Provider abstraction**: existing model interface for swapping providers
4. **Guardrails**: Public sources only, no fake data, manual review for unknown-consent

Key AI flows:
- `runLeadResearch()` - Broad/focused OSINT discovery with candidate-pool metrics, evidence tracking, and duplicate merging
- `draftLeadMessage()` - Channel-specific outreach drafts
- Qualification scoring from WhatsApp replies

## Lead Research Sources

| Source Type | Description |
|-------------|-------------|
| `openrouter-web-search` | Web discovery across public business pages |
| `directory-osint` | Justdial, Sulekha, Indiamart, local listings |
| `social-osint` | Public Instagram/Facebook/LinkedIn profiles |
| `website-contact-osint` | Business home/about/contact/service pages |
| `review-reputation-osint` | Rating/review extraction from public pages |
| `content-gap-osint` | Weak content signals (stale posts, no reels, poor CTAs) |
| `hiring-news-osint` | Hiring, launch, event, partnership signals |
| `competitor-osint` | Nearby/competitor analysis for angles |
| `browser-public-page` | Local page extractor for visible contact info |
| `manual-import` | Owner-provided CSV/list import |

## Workflow Types

1. **Meta → WhatsApp**: Ingest → Normalize → Qualify → WhatsApp → Route
2. **Intent → Meeting**: Trigger → Enrich → Score → Route → Personalized Cadence

## Guardrails & Compliance

- **Public-only**: No private profiles, logins, CAPTCHAs, or paywalls
- **Evidence-backed**: Every lead needs source URLs, no invented details
- **Consent-aware**: Unknown-consent prospects stay in manual review queue
- **Rate-limited**: Daily discovery limits per client/workspace

## Key Files to Know

- `packages/domain/src/index.ts` - Full domain model (500+ lines)
- `packages/ai/src/*.ts` - Lead research, scoring, drafting logic
- `packages/workflows/src/index.ts` - Workflow definitions and runner
- `apps/web/src/components/lead-magnet-lab.tsx` - Lead research UI
- `apps/web/src/components/workflow-canvas.tsx` - Visual workflow builder
- `apps/web/src/components/copilot-dock.tsx` - System-wide AI assistant
- `docs/lead-magnet-sop.md` - Operating procedure for lead magnet flow
- `.env.example` - Complete environment contract

## Current Development Focus

- Lead magnet discovery engine with OSINT integration
- Multi-channel outreach drafting with approval workflow
- AI qualification from WhatsApp/DM conversations
- Agency multi-client workspace support
- Pipeline management (CRM) with deal stages
- Automation builder for typed workflows
