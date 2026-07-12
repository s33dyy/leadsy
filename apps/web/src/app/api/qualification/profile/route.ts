import { NextResponse, type NextRequest } from "next/server";
import { audit, rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import { getQualificationProfile, updateQualificationProfile, type QualificationProfile } from "@/lib/crm-store";

export const runtime = "nodejs";

type ProfilePayload = {
  businessGoal?: string;
  introBehavior?: QualificationProfile["introBehavior"];
  requiredFields?: string[] | string;
  questionOrder?: string[] | string;
  scoreThreshold?: number | string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:read");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:qualification-profile-read`, 240);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const profile = await getQualificationProfile({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id
  });

  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request, "crm:write");
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:qualification-profile-write`, 40);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const payload = await readPayload(request);
  const profile = await updateQualificationProfile({
    tenantId: auth.session.tenantId,
    ownerId: auth.session.id,
    businessGoal: payload.businessGoal,
    introBehavior: introBehaviorFromValue(payload.introBehavior),
    requiredFields: listFromValue(payload.requiredFields),
    questionOrder: listFromValue(payload.questionOrder),
    scoreThreshold: payload.scoreThreshold !== undefined ? Number(payload.scoreThreshold) : undefined
  });

  audit({
    tenantId: auth.session.tenantId,
    actorId: auth.session.id,
    action: "crm.qualification_profile.update",
    resource: profile.id
  });

  return NextResponse.json({ profile });
}

async function readPayload(request: NextRequest): Promise<ProfilePayload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as ProfilePayload;
  }
  const form = await request.formData();
  return {
    businessGoal: text(form.get("businessGoal")),
    introBehavior: text(form.get("introBehavior")) as QualificationProfile["introBehavior"],
    requiredFields: text(form.get("requiredFields")),
    questionOrder: text(form.get("questionOrder")),
    scoreThreshold: text(form.get("scoreThreshold"))
  };
}

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() || undefined;
}

function listFromValue(value?: string[] | string) {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (!value) return undefined;
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function introBehaviorFromValue(value?: string) {
  if (value === "educate_then_qualify" || value === "qualify_first" || value === "human_first") return value;
  return undefined;
}
