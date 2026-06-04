import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

type ProtectedSurface = {
  label: string;
  path: string;
  markers: string[];
};

const protectedSurfaces: ProtectedSurface[] = [
  {
    label: "Meta unified webhook",
    path: "apps/web/src/app/api/meta/webhook/route.ts",
    markers: [
      "verifyMetaWebhookChallenge",
      "verifyMetaWebhookSignature",
      "saveRoutedMetaWebhookMessages",
      "process.env.META_APP_SECRET",
      'rateLimit("meta:unified:webhook"'
    ]
  },
  {
    label: "Meta OAuth callback",
    path: "apps/web/src/app/api/meta/oauth/callback/route.ts",
    markers: [
      'const callbackPath = "/api/meta/oauth/callback"',
      "getSessionFromRequest",
      "exchangeMetaOAuthCode",
      "saveMetaOAuthConnection",
      "integrations.meta.oauth.connected"
    ]
  },
  {
    label: "Meta OAuth storage",
    path: "apps/web/src/lib/meta-oauth-store.ts",
    markers: [
      "https://graph.facebook.com/oauth/access_token",
      "process.env.META_APP_ID",
      "process.env.META_APP_SECRET",
      "delete safe.accessToken",
      "tenantId",
      "ownerId"
    ]
  },
  {
    label: "Meta webhook routing",
    path: "apps/web/src/lib/meta-webhook-routing.ts",
    markers: [
      "findMetaOAuthConnectionForAssets",
      "saveUnifiedMetaWebhookMessages",
      "whatsappBusinessAccountId",
      "instagramBusinessAccountId",
      "facebookPageId"
    ]
  },
  {
    label: "WhatsApp webhook",
    path: "apps/web/src/app/api/meta/whatsapp/webhook/route.ts",
    markers: [
      "verifyMetaWebhookChallenge",
      "verifyMetaWebhookSignature",
      "saveRoutedMetaWebhookMessages",
      "process.env.META_APP_SECRET",
      'rateLimit("meta:whatsapp:webhook"'
    ]
  },
  {
    label: "WhatsApp webhook store",
    path: "apps/web/src/lib/meta-whatsapp-webhook-store.ts",
    markers: [
      "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      "timingSafeEqual",
      "extractMetaWhatsAppInboundMessages",
      "saveMetaWhatsAppInboundMessages",
      "whatsappConversationUrl"
    ]
  },
  {
    label: "Browser extension auth",
    path: "apps/web/src/lib/extension-auth.ts",
    markers: ["requireExtensionToken", "resolveExtensionBearerToken", "unauthorized_extension"]
  },
  {
    label: "Browser extension conversation sync",
    path: "apps/web/src/app/api/extension/conversations/sync/route.ts",
    markers: [
      "requireExtensionToken",
      "syncLeadsyExtensionConversation",
      "syncExtensionConversation",
      'rateLimit(`${auth.tenantId}:${auth.ownerId}:extension-sync`',
      "extension.conversation.sync"
    ]
  },
  {
    label: "Browser extension reply endpoint",
    path: "apps/web/src/app/api/extension/reply/route.ts",
    markers: [
      "requireExtensionToken",
      "buildLeadKnowledgeContext",
      "decideExtensionReply",
      "syncLeadsyExtensionConversation",
      "extension.reply.decide"
    ]
  },
  {
    label: "Browser extension task list",
    path: "apps/web/src/app/api/extension/tasks/route.ts",
    markers: ["requireExtensionToken", "listExtensionTasks", "activeWorkerStatuses", "extension.tasks.list"]
  },
  {
    label: "OpenRouter extension client",
    path: "apps/extension/src/core/openrouter.ts",
    markers: [
      "OpenRouterClient",
      "fallbackModelIds",
      "maxTokens",
      "https://openrouter.ai/api/v1/chat/completions",
      "response_format"
    ]
  },
  {
    label: "AI provider abstraction",
    path: "packages/ai/src/index.ts",
    markers: ["RevenueAIModel", "OpenRouterUsageCost", "searchPublicWeb", "fetchPublicPage", "runLeadResearch"]
  },
  {
    label: "Workers and workflow event publication",
    path: "packages/workflows/src/index.ts",
    markers: ["metaToWhatsAppWorkflow", "intentToMeetingWorkflow", "eventBus.publish", "workflow.executed"]
  },
  {
    label: "Knowledge store",
    path: "apps/web/src/lib/lead-knowledge-store.ts",
    markers: [
      'const knowledgeFile = join(leadsyDataDir, "lead-knowledge.json")',
      "scopeMatches",
      "saveUnifiedMetaWebhookMessages",
      "syncLeadsyExtensionConversation",
      "buildLeadKnowledgeContext"
    ]
  },
  {
    label: "Event system",
    path: "packages/events/src/index.ts",
    markers: ["RevenueEventName", "InMemoryEventBus", "subscribe", "publish", "eventBus"]
  },
  {
    label: "Security layer",
    path: "packages/security/src/index.ts",
    markers: ["assertPermission", "enforceTenant", "rateLimit", "audit", "tenantId"]
  },
  {
    label: "Session auth",
    path: "apps/web/src/lib/auth.ts",
    markers: ["SESSION_COOKIE_NAME", "AUTH_SECRET", "timingSafeEqual", "httpOnly", "sameSite"]
  },
  {
    label: "API auth",
    path: "apps/web/src/lib/api-auth.ts",
    markers: ["requireApiSession", "assertPermission", "unauthorized", "forbidden", "canAccessClient"]
  },
  {
    label: "Database schema",
    path: "packages/db/prisma/schema.prisma",
    markers: ["model Tenant", "model User", "model AuthSession", "@@index([tenantId", 'url      = env("DATABASE_URL")']
  },
  {
    label: "Railway GitHub Actions workflow",
    path: ".github/workflows/railway-web.yml",
    markers: ["Deploy Web To Railway", "RAILWAY_TOKEN", "railway up", "npm run typecheck", "npm run build"]
  }
];

const preservedSections = [
  "Meta Lead Ads",
  "Meta OAuth",
  "Meta Webhooks",
  "WhatsApp",
  "OpenRouter / AI providers",
  "Browser Extension endpoints",
  "Workers",
  "Knowledge Systems",
  "Event System",
  "Security/Auth",
  "Tenant Logic"
];

const protectedEnvKeys = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "SESSION_COOKIE_NAME",
  "AI_PROVIDER",
  "AI_GATEWAY_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "META_APP_ID",
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "META_WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "META_LEAD_ADS_PAGE_ACCESS_TOKEN",
  "WHATSAPP_BUSINESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "BROWSER_WORKER_PROVIDER"
];

async function fileExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function read(root: string, path: string) {
  return readFile(join(root, path), "utf8");
}

async function assertSurface(root: string, surface: ProtectedSurface) {
  const absolutePath = join(root, surface.path);
  assert.equal(await fileExists(absolutePath), true, `${surface.label} should keep ${surface.path}`);
  const source = await readFile(absolutePath, "utf8");
  for (const marker of surface.markers) {
    assert(source.includes(marker), `${surface.label} should preserve marker: ${marker}`);
  }
}

async function main() {
  const root = process.cwd();
  const preservationDoc = await read(root, "PRESERVED_INTEGRATIONS.md");
  for (const section of preservedSections) {
    assert(preservationDoc.includes(`## ${section}`), `preservation doc should cover ${section}`);
  }
  assert(preservationDoc.includes("UI-only refactors must not change integration logic"), "preservation doc should state the Step 3 boundary");

  for (const surface of protectedSurfaces) {
    await assertSurface(root, surface);
  }

  const envExample = await read(root, ".env.example");
  for (const key of protectedEnvKeys) {
    assert(envExample.includes(`${key}=`), `.env.example should preserve ${key}`);
  }

  const packageJson = await read(root, "package.json");
  assert(packageJson.includes('"test:preserved-integrations"'), "package scripts should expose the Step 3 preservation guard");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
