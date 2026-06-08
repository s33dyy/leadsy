import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { createCrmFollowUpTask, listCrmFollowUpTasks, type CrmFollowUpTask } from "@/lib/crm-store";
import { urlForRequestHost } from "@/lib/request-url";
import { getTeamMember } from "@/lib/teamspace-store";

export const runtime = "nodejs";

type FollowUpTaskPayload = {
  leadId?: string;
  topic?: string;
  description?: string;
  priority?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueAt?: string;
  destination?: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:crm-followups-read`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId")?.trim() || undefined;
  const includeClosed = searchParams.get("includeClosed") === "true";
  const tasks = await listCrmFollowUpTasks(
    { tenantId: auth.session.tenantId, ownerId: auth.session.id },
    { leadId, includeClosed }
  );

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:crm-followups-write`, 120);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const isJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const payload = await readPayload(request);
  const leadId = payload.leadId?.trim();
  const topic = payload.topic?.trim();
  if (!leadId || !topic) {
    return NextResponse.json({ error: "invalid_follow_up_task" }, { status: 400 });
  }
  const member = payload.assigneeId
    ? await getTeamMember({
        tenantId: auth.session.tenantId,
        ownerId: auth.session.id,
        memberId: payload.assigneeId
      })
    : null;

  const task = await createCrmFollowUpTask({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    leadId,
    topic,
    description: payload.description,
    priority: priorityFromValue(payload.priority),
    destination: payload.destination === "ai_approvals" ? "ai_approvals" : "human_tasks",
    assigneeId: payload.assigneeId,
    assigneeName: payload.assigneeName || member?.name,
    dueAt: payload.dueAt
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "crm.follow_up_task.create",
    resource: task.id,
    metadata: { leadId }
  });

  if (isJson) return NextResponse.json({ task }, { status: 201 });

  const url = urlForRequestHost(request, "/app/leads");
  url.searchParams.set("contact", leadId);
  url.searchParams.set("tab", "tasks");
  url.searchParams.set("notice", "crm-follow-up-added");
  return NextResponse.redirect(url, 303);
}

async function readPayload(request: NextRequest): Promise<FollowUpTaskPayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as FollowUpTaskPayload;
  }
  const form = await request.formData();
  return {
    leadId: text(form.get("leadId")),
    topic: text(form.get("topic")),
    description: text(form.get("description")),
    priority: text(form.get("priority")),
    assigneeId: text(form.get("assigneeId")),
    assigneeName: text(form.get("assigneeName")),
    dueAt: text(form.get("dueAt")),
    destination: text(form.get("destination"))
  };
}

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() || undefined;
}

function priorityFromValue(value?: string): CrmFollowUpTask["priority"] {
  if (value === "low" || value === "normal" || value === "high" || value === "urgent") return value;
  return "normal";
}
