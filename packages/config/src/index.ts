import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(24),
  AI_PROVIDER: z.enum(["deterministic", "gateway", "openai", "anthropic", "openrouter"]).default("deterministic"),
  AI_DEFAULT_MODEL: z.string().default("openrouter/free"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_RESEARCH_MODEL: z.string().default("openrouter/free"),
  OPENROUTER_DOSSIER_MODEL: z.string().optional(),
  OPENROUTER_SENTIMENT_MODEL: z.string().optional(),
  OPENROUTER_FAST_MODEL: z.string().default("openrouter/free"),
  LEADSY_SPEND_CAP_INR: z.coerce.number().positive().default(1),
  LEADSY_AI_PLANNER_ENABLED: z.coerce.boolean().default(false),
  BROWSER_WORKER_PROVIDER: z.enum(["local-fetch", "disabled"]).default("local-fetch"),
  REDIS_URL: z.string().optional(),
  LEAD_DISCOVERY_DAILY_LIMIT: z.coerce.number().int().positive().default(250),
  OUTBOUND_REQUIRE_APPROVED_SOURCE: z.coerce.boolean().default(true),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export function parseEnv(env: NodeJS.ProcessEnv) {
  return envSchema.safeParse(env);
}
