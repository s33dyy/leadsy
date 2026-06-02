# API

## `GET /api/health`

Returns application status and current module counts.

## `POST /api/copilot`

Request:

```json
{
  "prompt": "Forecast at-risk deals and next actions",
  "accountId": "acc_quantum"
}
```

Response:

```json
{
  "intent": "forecast",
  "answer": "...",
  "actions": [
    {
      "label": "Create risk review",
      "command": "tasks.create"
    }
  ],
  "citations": ["deals", "activities"]
}
```

## `POST /api/intelligence/enrich`

Request:

```json
{
  "leadId": "lead_001"
}
```

Runs the enrichment abstraction and returns contact/account confidence, verification state, route recommendation, and buying signals.

## `POST /api/workflows/run`

Runs the `Meta Lead to WhatsApp Conversion` workflow and returns step outputs. Production execution should move this into a queue-backed worker with idempotency keys.

## `POST /api/meta/leads`

Simulates a Meta webhook payload, maps it to a client workspace, runs the Meta to WhatsApp workflow, and returns first-response action state.

## `GET /api/lead-magnet/brief`

Returns the agency owner's saved lead brief, lead dossiers, discovery runs, message drafts, and source connection health.

## `POST /api/lead-magnet/brief`

Request:

```json
{
  "service": "Content marketing and reels",
  "idealCustomers": "Clinics, coaching centers, and local shops",
  "searchLocations": "Barasat, Kolkata",
  "leadGoal": 25,
  "researchMode": "broad",
  "sources": [
    "openrouter-web-search",
    "directory-osint",
    "social-osint",
    "website-contact-osint",
    "review-reputation-osint",
    "content-gap-osint",
    "hiring-news-osint",
    "competitor-osint",
    "browser-public-page",
    "manual-import"
  ],
  "aiAction": "draft-only",
  "excludedLeads": "Agencies and businesses outside Kolkata"
}
```

Saves the plain-language lead brief used by all research agents. `researchMode` can be `broad` or `focused`; broad is the default for larger goals and full-source sweeps.

## `POST /api/lead-magnet/discover`

Runs free public research across configured source lanes. OpenRouter plans the search and converts gathered evidence into dossiers; Leadsy owns the actual public search/fetch tools. Broad mode runs more searches and page checks, builds a candidate pool, dedupes URLs/business names, then saves only evidence-backed records. Goals up to 1000 are handled as staged campaign batches, not one giant burst; each batch avoids already-saved domains. Existing leads are merged by phone, WhatsApp, website, or business-name-plus-city so repeated discovery runs do not create duplicate rows. The route returns lead dossiers, source evidence, quality counts, run metrics (`targetLeadGoal`, `batchNumber`, `batchSize`, `searchesRun`, `pagesFetched`, `candidateCount`, `dedupedCount`, `rawResultsDiscarded`, `usableProspects`, `properDataCount`, `missingContactCount`, `savedCount`), connection messages, and the latest run summary. It never fabricates leads and does not use paid OSINT vendors or data brokers.

## `POST /api/lead-magnet/import`

Request:

```json
{
  "rawText": "ABC Clinic, Barasat, +91..., https://abcclinic.example"
}
```

Imports real owner-provided records, dedupes them, scores them, and adds manual evidence notes.

## `POST /api/lead-magnet/draft`

Request:

```json
{
  "leadId": "lead_..."
}
```

Creates a WhatsApp, Instagram DM, or email draft for approval. It does not send the message.

## `POST /api/lead-magnet/outreach`

Request:

```json
{
  "leadId": "disc_001"
}
```

Compatibility route for older UI paths. It now creates an approval-only message draft instead of auto-sending.

## `POST /api/qualification/score`

Request:

```json
{
  "leadId": "meta_001"
}
```

Returns budget, location, urgency, intent, spam risk, recommended route, and next best action.

## `POST /api/whatsapp/reply`

Request:

```json
{
  "conversationId": "wa_001"
}
```

Returns an AI-generated WhatsApp reply, tone, escalation decision, and next action.
