import assert from "node:assert/strict";

async function main() {
  const ai = await import("../packages/ai/src/index");
  assert.equal(typeof ai.selectLeadsyAiModel, "function", "AI package should expose a central model selector");
  assert.equal(typeof ai.shouldUseRemoteAi, "function", "AI package should expose a remote AI gate");

  const baseEnv = {
    OPENROUTER_API_KEY: "configured",
    OPENROUTER_FAST_MODEL: "openai/gpt-5",
    OPENROUTER_RESEARCH_MODEL: "anthropic/claude-4-opus",
    OPENROUTER_DOSSIER_MODEL: "openai/o3",
    AI_DEFAULT_MODEL: "openai/gpt-4o-mini"
  };

  assert.equal(
    ai.shouldUseRemoteAi({ ...baseEnv }),
    false,
    "presence of an API key alone should not trigger paid remote AI"
  );

  assert.equal(
    ai.shouldUseRemoteAi({ ...baseEnv, AI_PROVIDER: "deterministic", LEADSY_ENABLE_REMOTE_AI: "true" }),
    false,
    "deterministic provider should override remote AI opt-in flags"
  );

  assert.deepEqual(
    ai.selectLeadsyAiModel("onboarding-options", { ...baseEnv }),
    {
      task: "onboarding-options",
      provider: "deterministic",
      model: undefined,
      costTier: "zero",
      reason: "remote_ai_not_enabled"
    },
    "onboarding options should stay deterministic unless remote AI is explicitly enabled"
  );

  assert.deepEqual(
    ai.selectLeadsyAiModel("lead-research-planner", {
      ...baseEnv,
      AI_PROVIDER: "openrouter"
    }),
    {
      task: "lead-research-planner",
      provider: "openrouter",
      model: "google/gemini-2.5-flash:free",
      costTier: "free",
      reason: "blocked_paid_or_expensive_model"
    },
    "planner should fall back to free when configured models are paid or premium"
  );

  assert.deepEqual(
    ai.selectLeadsyAiModel("lead-dossier", {
      ...baseEnv,
      AI_PROVIDER: "openrouter",
      OPENROUTER_DOSSIER_MODEL: "openai/gpt-4o-mini",
      LEADSY_ALLOW_PAID_AI_MODELS: "true"
    }),
    {
      task: "lead-dossier",
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      costTier: "paid",
      reason: "paid_model_allowed"
    },
    "paid non-premium dossier model should require explicit paid-model opt-in"
  );

  assert.deepEqual(
    ai.selectLeadsyAiModel("lead-dossier", {
      ...baseEnv,
      AI_PROVIDER: "openrouter",
      LEADSY_ALLOW_PAID_AI_MODELS: "true"
    }),
    {
      task: "lead-dossier",
      provider: "openrouter",
      model: "google/gemini-2.5-flash:free",
      costTier: "free",
      reason: "blocked_paid_or_expensive_model"
    },
    "premium/reasoning models should remain blocked unless premium models are explicitly allowed"
  );

  assert.deepEqual(
    ai.selectLeadsyAiModel("lead-dossier", {
      ...baseEnv,
      AI_PROVIDER: "openrouter",
      LEADSY_ALLOW_EXPENSIVE_AI_MODELS: "true"
    }),
    {
      task: "lead-dossier",
      provider: "openrouter",
      model: "openai/o3",
      costTier: "premium",
      reason: "premium_model_allowed"
    },
    "premium models should require a separate explicit opt-in"
  );

  console.log("minimal-cost model selection passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
