# OpenRouter Cost Constraints

Step 4 cost boundary: OpenRouter usage must remain cheap by default, explicit when expensive, and subordinate to real evidence already available in Leadsy.

## Non-Negotiables

1. Existing API keys stay intact. Never generate, rotate, hardcode, or rename OpenRouter keys during UI refactors.
2. Use existing env vars exactly as named: `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_DOSSIER_MODEL`, `OPENROUTER_SENTIMENT_MODEL`, `OPENROUTER_FAST_MODEL`, `AI_DEFAULT_MODEL`, `LEADSY_SPEND_CAP_INR`, and `LEADSY_AI_PLANNER_ENABLED`.
3. Maintain provider abstraction in `packages/ai` and the browser extension `OpenRouterClient`; do not bypass the router with direct one-off calls from UI code.
4. Prefer free/cheap models for routine tasks: research planning, summaries, note drafting, task generation, profile detection, and reply classification should default to `openrouter/free` unless an operator explicitly configures another model.
5. Use heavy reasoning models only when explicitly required for complex qualification decisions or operator-approved analysis. Heavy models must be configured through the existing env vars, not hardcoded.
6. Research pipeline order is search first -> cached knowledge second -> AI generation last. Leadsy should run public search/fetch tools, use cache hits and stored lead knowledge, and only spend tokens once there is useful evidence to summarize or draft from.
7. Never waste tokens on reformatting structured data. If route handlers, stores, or workers already have structured JSON, pass that data directly or render it without an AI call.
8. Batch AI calls where possible. Avoid per-row/per-card redundant calls; prefer one compact prompt over many repeated prompts when the same context can be processed together.

## Default Cost Posture

- Local development stays deterministic by default through `AI_PROVIDER=deterministic`.
- OpenRouter keys remain blank in `.env.example`.
- `LEADSY_SPEND_CAP_INR=1` remains the local default cap.
- `LEADSY_AI_PLANNER_ENABLED=false` keeps AI planning opt-in. The fallback planner and public search tools should handle normal research without token spend.
- Routine model examples default to `openrouter/free`; teams can opt into paid or heavy models by setting the existing env vars deliberately.

## UI Refactor Rules

- UI components may display model/status choices, but must not create new API keys, env vars, or direct provider clients.
- UI components must not trigger AI calls merely to rephrase text already available from APIs or stores.
- Draft outreach remains human-in-the-loop. Cost changes must never be used as a reason to enable autonomous sends.
- New AI-powered UI should state which existing API route or worker owns the call, and should prefer cached lead knowledge over fresh generation.
