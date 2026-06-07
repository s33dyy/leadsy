import { NextResponse, type NextRequest } from "next/server";
import { selectLeadsyAiModel, shouldUseRemoteAi } from "@leadsy/ai";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";
import {
  normalizeOnboardingOptionGroups,
  onboardingFallbackOptions,
  type OnboardingOptionGroups
} from "@/lib/onboarding-options";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

async function aiOptions(input: Record<string, unknown>): Promise<OnboardingOptionGroups | undefined> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const modelSelection = selectLeadsyAiModel("onboarding-options");
  if (!apiKey || !shouldUseRemoteAi() || modelSelection.provider !== "openrouter" || !modelSelection.model) return undefined;
  const prompt = {
    businessName: cleanText(input.businessName),
    industry: cleanText(input.industry),
    website: cleanText(input.website),
    leadSources: cleanText(input.leadSources)
  };
  const response = await fetch(`${process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelSelection.model,
      messages: [
        {
          role: "system",
          content: "Return compact JSON only. Generate practical onboarding chip options for an SMB CRM. Keys: role, industry, teamSize, leadSources, assignmentPreferences, followUpPreferences, services, markets, targetQuestion0, targetQuestion1, targetQuestion2. Values are arrays of short answer strings. Never return questions as options for any key; return selectable answers only."
        },
        {
          role: "user",
          content: JSON.stringify(prompt)
        }
      ],
      temperature: 0.3
    })
  });
  if (!response.ok) return undefined;
  const payload = (await response.json().catch(() => undefined)) as { choices?: Array<{ message?: { content?: string } }> } | undefined;
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) return undefined;
  const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, ""));
  return normalizeOnboardingOptionGroups(parsed);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!auth.ok) return auth.response;

  const limiter = rateLimit(`${auth.session.tenantId}:${auth.session.id}:onboarding:options`, 30, 60_000);
  if (!limiter.ok) {
    return NextResponse.json({ error: "rate_limited", resetAt: limiter.resetAt }, { status: 429 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const options = await aiOptions(body).catch(() => undefined);
  return NextResponse.json({
    ok: true,
    source: options ? "ai" : "fallback",
    options: options ?? onboardingFallbackOptions
  });
}
