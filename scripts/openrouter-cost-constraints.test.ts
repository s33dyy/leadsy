import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const heavyModelDefaults = [
  "\"openai/gpt-5.2\"",
  "openai/gpt-5.2",
  "\"anthropic/claude",
  "\"openai/o1",
  "\"openai/o3",
  "\"openai/o4"
];

const requiredPolicyPhrases = [
  "Existing API keys stay intact",
  "Use existing env vars exactly as named",
  "Maintain provider abstraction",
  "Prefer free/cheap models for routine tasks",
  "Use heavy reasoning models only when explicitly required",
  "search first -> cached knowledge second -> AI generation last",
  "Never waste tokens on reformatting structured data",
  "Batch AI calls where possible"
];

async function read(root: string, path: string) {
  return readFile(join(root, path), "utf8");
}

function assertNoHardcodedHeavyDefault(source: string, label: string) {
  for (const marker of heavyModelDefaults) {
    assert(!source.includes(marker), `${label} should not hardcode heavy routine model default ${marker}`);
  }
}

async function main() {
  const root = process.cwd();
  const policy = await read(root, "OPENROUTER_COST_CONSTRAINTS.md");
  for (const phrase of requiredPolicyPhrases) {
    assert(policy.includes(phrase), `cost policy should include: ${phrase}`);
  }

  const envExample = await read(root, ".env.example");
  assert(envExample.includes("AI_PROVIDER=deterministic"), "local AI provider should default to deterministic");
  assert(envExample.includes("OPENROUTER_API_KEY="), "OpenRouter key env name should stay intact and empty in examples");
  assert(envExample.includes("OPENROUTER_BASE_URL=https://openrouter.ai/api/v1"), "OpenRouter base URL env name should stay intact");
  assert(envExample.includes("AI_DEFAULT_MODEL=openrouter/free"), "default model example should prefer the free OpenRouter route");
  assert(envExample.includes("OPENROUTER_RESEARCH_MODEL=openrouter/free"), "research model example should prefer the free OpenRouter route");
  assert(envExample.includes("OPENROUTER_FAST_MODEL=openrouter/free"), "fast model example should prefer the free OpenRouter route");
  assert(envExample.includes("LEADSY_SPEND_CAP_INR=1"), "local spend cap should remain tiny by default");
  assert(envExample.includes("LEADSY_AI_PLANNER_ENABLED=false"), "AI planning should remain explicitly opt-in");
  assertNoHardcodedHeavyDefault(envExample, ".env.example");

  const config = await read(root, "packages/config/src/index.ts");
  assert(config.includes('AI_DEFAULT_MODEL: z.string().default("openrouter/free")'), "config should default routine AI model to free route");
  assert(config.includes('OPENROUTER_RESEARCH_MODEL: z.string().default("openrouter/free")'), "config should default research model to free route");
  assert(config.includes('OPENROUTER_FAST_MODEL: z.string().default("openrouter/free")'), "config should default fast model to free route");
  assert(config.includes("LEADSY_SPEND_CAP_INR"), "config should preserve spend cap env");
  assert(config.includes("LEADSY_AI_PLANNER_ENABLED"), "config should preserve AI planner opt-in env");
  assertNoHardcodedHeavyDefault(config, "packages/config");

  const dockerCompose = await read(root, "docker-compose.yml");
  assert(dockerCompose.includes("AI_DEFAULT_MODEL: ${AI_DEFAULT_MODEL:-openrouter/free}"), "Docker default model should prefer the free OpenRouter route");
  assert(dockerCompose.includes("OPENROUTER_RESEARCH_MODEL: ${OPENROUTER_RESEARCH_MODEL:-openrouter/free}"), "Docker research model should prefer the free OpenRouter route");
  assert(dockerCompose.includes("OPENROUTER_FAST_MODEL: ${OPENROUTER_FAST_MODEL:-openrouter/free}"), "Docker fast model should prefer the free OpenRouter route");
  assertNoHardcodedHeavyDefault(dockerCompose, "docker-compose.yml");

  const ai = await read(root, "packages/ai/src/index.ts");
  assert(ai.includes('const defaultRoutineOpenRouterModel = "openrouter/free"'), "AI package should centralize free routine model fallback");
  assert(ai.includes("process.env.OPENROUTER_FAST_MODEL ||"), "planner should preserve env-based model override");
  assert(ai.includes("process.env.OPENROUTER_DOSSIER_MODEL ||"), "dossier generation should preserve env-based model override");
  assert(ai.includes("expensiveResearchModel"), "AI package should still detect expensive models");
  assert(ai.includes("LEADSY_AI_PLANNER_ENABLED === \"false\""), "AI planner should stay explicitly opt-in");
  assert(ai.includes("searchPublicWeb({ query"), "research should use public search tooling before AI dossier work");
  assert(ai.includes("fetchPublicPage({ url"), "research should use public fetch tooling before AI dossier work");
  assert(ai.includes("max_tokens"), "OpenRouter calls should keep token ceilings");
  assertNoHardcodedHeavyDefault(ai, "packages/ai");

  const researchTools = await read(root, "packages/ai/src/research-tools.ts");
  assert(researchTools.includes("fetchCache"), "research fetch tooling should keep a cache");
  assert(researchTools.includes("cache-hit"), "research fetch tooling should report cache hits");
  assert(researchTools.includes("LEADSY_RESEARCH_FETCH_CACHE_TTL_MS"), "research fetch cache TTL env should stay intact");
  assert(researchTools.includes("LEADSY_RESEARCH_MAX_PAGES_PER_DOMAIN"), "domain fetch caps should stay intact");
  assert(researchTools.includes("LEADSY_RESEARCH_RETRY_AFTER_MAX_MS"), "Retry-After cap should stay intact");

  const extensionSettings = await read(root, "apps/extension/src/core/settings.ts");
  assert(extensionSettings.includes('modelId: import.meta.env.VITE_OPENROUTER_MODEL || "openrouter/free"'), "extension should default to the free OpenRouter route");
  assert(extensionSettings.includes("fallbackModelIds"), "extension should preserve cheap fallback model routing");
  assert(extensionSettings.includes("maxTokens: 350"), "extension should preserve a low routine token ceiling");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
