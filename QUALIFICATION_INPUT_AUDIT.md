# Qualification Input Audit — Phase 4.5

Scope: qualification fields must trace back to real customer conversation records. Unknown values remain `Not Yet Collected`. Values with no traceable customer source are marked invalid/uncertain rather than trusted.

## Input Contract

Qualification uses `conversationMessages` only:

- inbound customer messages
- outbound customer messages
- no worker events
- no task events
- no sync events
- no user/AI notes
- no hidden records

The qualification engine remains deterministic and decision-support-only. It does not auto-close, auto-win, or auto-reject leads.

## Field Trace Rules

| Field | Value | Source Message | Message ID | Confidence | Extraction Method | Validity Rule |
| --- | --- | --- | --- | --- | --- | --- |
| Need | Stored value or `Not Yet Collected` | Customer message containing label/value or deterministic pattern | Source message ID | high/medium/none | deterministic-label or deterministic-pattern | Invalid if no customer message supports it |
| Budget | Stored value or `Not Yet Collected` | Customer message containing budget label/value or numeric budget pattern | Source message ID | high/medium/none | deterministic-label or deterministic-pattern | Invalid if no customer message supports it |
| Timeline | Stored value or `Not Yet Collected` | Customer message containing timeline label/value or time-window pattern | Source message ID | high/medium/none | deterministic-label or deterministic-pattern | Invalid if no customer message supports it |
| Authority | Stored value or `Not Yet Collected` | Customer message mentioning owner/founder/decision maker/approver | Source message ID | high/medium/none | deterministic-pattern | Invalid if only worker/system text supports it |
| Location | Stored value or `Not Yet Collected` | Customer message containing city/location label/value | Source message ID | high/medium/none | deterministic-label or deterministic-pattern | Invalid if no customer message supports it |
| Company | Stored value or `Not Yet Collected` | Customer message containing company/business label/value | Source message ID | high/medium/none | deterministic-label or deterministic-pattern | Invalid if no customer message supports it |
| Service Interest | Stored value or `Not Yet Collected` | Customer message containing service interest or service-related pattern | Source message ID | high/medium/none | deterministic-label or deterministic-pattern | Invalid if no customer message supports it |
| Intent | Stored value or `Not Yet Collected` | Customer message containing intent signals such as need/want/budget/timeline/decision-maker language | Source message ID | medium/none | derived-from-conversation | Invalid if only task/system records support it |

## Implementation

Added `buildQualificationInputAudit(lead)` in `apps/web/src/lib/lead-knowledge-store.ts`.

For every audited field it returns:

- field
- value
- state: Collected, Missing, or Uncertain
- sourceMessage
- messageId
- confidence
- extractionMethod
- valid

Fields without traceable customer conversation support return:

- value: `Not Yet Collected` for missing values, or the stored value with `state: Uncertain`
- confidence: `none`
- extractionMethod: `not-traced`
- valid: `false`

## Stabilization Test Evidence

`scripts/crm-truth-stabilization.test.ts` verifies:

- WhatsApp customer text can trace Budget, Timeline, Authority, Location, Company, Service Interest, Need, and Intent.
- A budget value manually injected from a worker/system-only event is marked invalid.
- Worker task events do not affect qualification facts or scoring inputs.

## Remaining Traceability Notes

- Existing historical leads may contain manually edited qualification fields without message-level provenance. Those values are not destroyed, but the audit marks them invalid/uncertain when no supporting customer message exists.
- No new database schema or audit table was added. This phase uses existing lead messages and existing event/timeline systems.
