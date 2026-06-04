# Leadsy Web App - Codex Agent Instructions

## Project Context

This is the **Leadsy AI Lead Intelligence & Operations Platform** web application. It researches prospects, builds lead knowledge, generates tasks for human operators, drafts outreach for approval, and supports qualification work for agencies and revenue teams.

**NOT** a generic Next.js template — this is a domain-specific product with:
- Lead research engine (OSINT discovery + evidence tracking)
- Meta lead ingestion + WhatsApp qualification flow
- Multi-client agency workspaces
- AI-powered outreach drafting with approval workflow
- Qualification pipeline and CRM-adjacent lead management
- Worker/task workflows with human approval gates

## Architecture Overview

```
apps/web/                ← Next.js app (UI + API routes)
packages/domain/         ← Lead, Meta, WhatsApp, CRM models
packages/ai/             ← Lead research, scoring, drafting
packages/workflows/      ← DAG workflow engine
packages/security/       ← RBAC, tenant guards, audit logs
packages/db/             ← Prisma schema + migrations
```

## Key Conventions

### 1. Domain First
- All business logic lives in `packages/domain` types
- Never invent new lead/Meta/WhatsApp models — use existing types
- Lead discovery flows through `LeadBrief → LeadDossier → LeadScore`

### 2. AI Guardrails
- Public sources only (no private profiles, logins, CAPTCHAs)
- Evidence-backed data only (no invented phone/email/URLs)
- Unknown-consent leads stay in manual review queue
- `AI_PROVIDER=deterministic` works without API keys

### 3. Multi-Tenant Design
- Every record carries `tenantId` and often `clientId`
- UI surfaces support agency owner + client view switching
- RBAC guards tenant-scoped operations

### 4. Component Structure
- `src/components/` - Feature components (lead-magnet-lab, workflow-canvas, copilot-dock)
- `src/app/` - Next.js app router pages + API routes
- `src/lib/` - Business logic helpers, stores, auth

### 5. Workflow Pattern
Components follow this pattern:
1. Source (lead brief, Meta webhook, CRM import)
2. Enrich (OSINT, scoring, dedupe)
3. Draft (AI message or AI qualifier)
4. Approve (human review gate)
5. Execute (send/escalate/nurture)

## Critical Files

| File | Purpose |
|------|---------|
| `src/components/lead-magnet-lab.tsx` | Lead research UI with source selection |
| `src/components/workflow-canvas.tsx` | Visual workflow builder |
| `src/components/copilot-dock.tsx` | System-wide AI assistant |
| `src/components/meta-lead-lab.tsx` | Meta webhook ingestion UI |
| `src/components/whatsapp-inbox.tsx` | WhatsApp conversation thread |
| `src/components/pipeline-board.tsx` | CRM deal pipeline |
| `src/app/api/copilot/route.ts` | Copilot endpoint |
| `src/app/api/workflows/run/route.ts` | Workflow execution endpoint |

## Workflow Nodes (from `packages/workflows`)

**Meta Qualification Flow**:
1. `meta_trigger` — Meta lead received
2. `meta_normalize` — Normalize and dedupe
3. `meta_qualify` — AI qualification (budget/location/timeline/spam)
4. `meta_whatsapp` — WhatsApp first reply
5. `meta_route` — Book or escalate

**Intent to Meeting Flow**:
1. `node_trigger` — Intent surge detected
2. `node_enrich` — Waterfall enrichment
3. `node_score` — ICP + timing score
4. `node_route` — Route to owner
5. `node_message` — Personalized cadence

## Lead Source Types

When working with lead discovery, these are the valid `LeadResearchSourceType` values:

- `openrouter-web-search` — Broad public web search
- `directory-osint` — Justdial, Sulekha, local listings
- `social-osint` — Public Instagram/Facebook/LinkedIn
- `website-contact-osint` — Business pages with contact info
- `review-reputation-osint` — Public ratings/reviews
- `content-gap-osint` — Weak content signals
- `hiring-news-osint` — Hiring/launch/event signals
- `competitor-osint` — Competitor analysis
- `browser-public-page` — Local page extractor
- `manual-import` — Owner-provided lists

## AI Integration Pattern

```typescript
// Example from packages/ai
import { runLeadResearch, draftLeadMessage } from '@leadsy/ai';

const result = await runLeadResearch({
  tenantId,
  ownerId,
  brief: {
    service: 'performance marketing',
    idealCustomers: 'real estate developers',
    searchLocations: 'Bangalore, Mumbai',
    leadGoal: 50,
    sources: ['openrouter-web-search', 'directory-osint'],
    aiAction: 'draft-only',
    excludedLeads: 'job agencies, consultancies'
  }
});
```

## Environment Variables (from `.env.example`)

必看 environment contract:
- `DATABASE_URL` — PostgreSQL connection (required)
- `AUTH_SECRET` — Session cryptography
- `OPENROUTER_API_KEY` — Agentic planning, scoring, extraction, and drafts; Leadsy's local tools perform public search/fetch
- `META_APP_SECRET`, `META_VERIFY_TOKEN` — Webhook verification
- `WHATSAPP_BUSINESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp Cloud API
- `AI_PROVIDER` — `deterministic` (default) or gateway mode

## Testing & Development

```bash
# Dev server (Next.js)
npm run dev

# Type check
npm run typecheck

# Seed data (empty workspace counts)
npm run seed
```

## What NOT to Assume

- ❌ No Firebase/Supabase — PostgreSQL only
- ❌ No generic CRM — this is lead-magnet-first
- ❌ No single-tenant design — agency multi-client core
- ❌ No direct outreach auto-send — approval gate required
- ❌ No fake leads — all data needs evidence sources

## Docs to Read First

- `../../CLAUDE.md` — Complete project overview
- `../../docs/architecture.md` — System design decisions
- `../../docs/modules.md` — Feature modules
- `../../docs/lead-magnet-sop.md` — Lead magnet operating procedure
- `../../packages/domain/src/index.ts` — Full domain model (read this!)

## When Adding New Features

1. Check `packages/domain/src/index.ts` first — existing types likely cover your use case
2. Check `packages/ai/src/index.ts` for AI interface patterns
3. Follow the component naming convention: `*-lab.tsx` (experimental), `*-inbox.tsx` (revenue-critical), `*-canvas.tsx` (builder)
4. Always include tenant scoping for new data models
5. Add evidence/source tracking for any discovery-related feature
