import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { runAiSettingsTest, type AiWorkspaceTask } from "@/lib/user-settings-store";

export const runtime = "nodejs";

const tasks = new Set<AiWorkspaceTask>([
  "qualification-reply",
  "message-draft",
  "calendar-reply",
  "lead-research-planner",
  "lead-dossier",
  "onboarding-options"
]);

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;
  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:settings-ai-test`, 20, 60_000);
  if (!limiter.ok) return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const task = typeof body.task === "string" && tasks.has(body.task as AiWorkspaceTask) ? (body.task as AiWorkspaceTask) : "message-draft";
  const result = await runAiSettingsTest({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    task,
    prompt: typeof body.prompt === "string" ? body.prompt : ""
  });
  audit({ tenantId: auth.session.tenantId, actorId: auth.session.id, action: "settings.ai.test", resource: `ai:${task}` });
  return NextResponse.json({ ok: true, result });
}
