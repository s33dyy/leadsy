# Performance Report — Phase 4.5

Scope: investigate CRM truth surfaces only. Optimize only where the issue is measurable. No speculative memoization was added.

## Commands Timed

Measured after implementation on local machine:

| Command | Result | Real Time |
| --- | --- | --- |
| `npm run typecheck` | Passed | 1.74s |
| `npm run lint` | Passed with no errors | 5.49s |
| `npm run build` | Passed | 7.65s |
| Next production compilation inside build | Passed | 2.5s |
| TypeScript inside build | Passed | 3.2s |
| Static page generation | Passed, 62 pages | 97ms |

## Surface Investigation

| Surface | Findings | Optimization Applied |
| --- | --- | --- |
| Dashboard load | No Phase 4.5 dashboard feature work. Build confirms `/app` still compiles as dynamic route. | None |
| Lead page load | Lead Detail Workspace still groups/render messages in-page. Visible conversation surfaces now consume `conversationMessages`, preventing system records from expanding UI work. | Contract filter applied for visible conversation/timeline data |
| Inbox load | Inline inbox mapping previously read `lead.messages` directly and could preview notes/system records. It also had no explicit dedupe boundary. | Extracted `buildLeadBackedInboxItems`; dedupes by ID and only reads conversation messages |
| Lead detail load | Qualification card remains in Lead Detail Workspace. System/worker events are excluded from qualification inputs. | Input filtering only; no speculative memoization |
| Message grouping | Timeline grouping now receives customer conversation messages only. | Reduced grouping input set by contract |
| Qualification rendering | Qualification score is deterministic and receives customer message context only. | System/worker records no longer affect qualification facts |

## Loop / Filtering Review

Source inspection counts after stabilization:

| File | `.filter(` | `.sort(` | `.map(` | Note |
| --- | ---: | ---: | ---: | --- |
| `apps/web/src/app/app/communications/page.tsx` | 4 | 1 | 12 | Lead-backed inbox mapping moved to library helper |
| `apps/web/src/app/app/leads/page.tsx` | 17 | 2 | 27 | Existing workspace rendering retained; contract filter added |
| `apps/web/src/lib/lead-knowledge-store.ts` | 45 | 4 | 16 | Existing JSON store operations retained; no schema rewrite |
| `apps/web/src/lib/inbox-stabilization.ts` | 0 | 1 | 1 | New focused inbox helper |
| `apps/web/src/lib/conversation-contract.ts` | 4 | 1 | 0 | Centralized selector contract |

## O(n²) / Repeated Work Findings

- No new O(n²) loop was introduced.
- Inbox now dedupes in a single pass over visible messages before sorting.
- Timeline and qualification no longer process system/task records as visible conversation inputs.
- Existing store-level repeated filtering remains in the JSON-file store and was not broadly refactored to avoid speculative churn during stabilization.

## Optimization Decision

Only one measurable/necessary optimization was applied:

- centralize inbox construction and dedupe before rendering lead-backed previews.

No speculative memoization or broad data-layer rewrite was added.
