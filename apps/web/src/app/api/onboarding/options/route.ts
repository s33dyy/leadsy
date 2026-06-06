import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@leadsy/security";
import { requireApiSession } from "@/lib/api-auth";

export const runtime = "nodejs";

type OptionGroupKey =
  | "role"
  | "industry"
  | "teamSize"
  | "leadSources"
  | "assignmentPreferences"
  | "followUpPreferences"
  | "services"
  | "markets"
  | "targetQuestion0"
  | "targetQuestion1"
  | "targetQuestion2";

type OptionGroups = Record<OptionGroupKey, string[]>;

const fallbackOptions: OptionGroups = {
  role: ["Founder", "Sales Manager", "Marketing Manager", "Operations Manager", "Admissions Lead", "Customer Support Lead"],
  industry: ["Real Estate", "Education", "Healthcare", "Local Services", "Retail", "Hospitality", "SaaS", "Financial Services"],
  teamSize: ["1-5", "6-15", "16-50", "51-100", "100+"],
  leadSources: ["WhatsApp Ads", "Website", "Instagram", "Facebook", "Google Business Profile", "Manual Imports", "Referrals"],
  assignmentPreferences: ["Unassigned queue", "Round robin", "Source-based routing", "Manager assigns manually", "Assign to current owner"],
  followUpPreferences: ["Reply within 5 minutes", "Same-day follow-up", "Reminder after 24 hours", "Escalate hot leads", "Create task after missed reply"],
  services: ["Lead qualification", "WhatsApp follow-up", "Appointment booking", "Sales handoff", "Site visit coordination", "Customer support triage"],
  markets: ["Local city", "Statewide", "Pan-India", "International", "Tier 1 cities", "Tier 2 cities"],
  targetQuestion0: ["Solo buyers", "Small businesses", "Mid-market teams", "Enterprise teams", "Families/consumers", "Students/parents"],
  targetQuestion1: ["Under ₹10k", "₹10k-₹50k", "₹50k-₹2L", "₹2L-₹10L", "₹10L+"],
  targetQuestion2: ["Same day", "1-7 days", "2-4 weeks", "1-3 months", "3+ months"]
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

function normalizeGroups(value: unknown): OptionGroups | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Partial<Record<OptionGroupKey, unknown>>;
  const entries = Object.keys(fallbackOptions).map((key) => {
    const typedKey = key as OptionGroupKey;
    const options = Array.isArray(record[typedKey])
      ? record[typedKey]
          ?.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
          .map((item) => item.trim().slice(0, 64))
          .slice(0, 8)
      : undefined;
    return [typedKey, options?.length ? options : fallbackOptions[typedKey]] as const;
  });
  return Object.fromEntries(entries) as OptionGroups;
}

async function aiOptions(input: Record<string, unknown>): Promise<OptionGroups | undefined> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey || process.env.AI_PROVIDER === "deterministic") return undefined;
  const model = process.env.OPENROUTER_FAST_MODEL || process.env.AI_DEFAULT_MODEL || "openrouter/free";
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
      model,
      messages: [
        {
          role: "system",
          content: "Return compact JSON only. Generate practical onboarding chip options for an SMB CRM. Keys: role, industry, teamSize, leadSources, assignmentPreferences, followUpPreferences, services, markets, targetQuestion0, targetQuestion1, targetQuestion2. Values are arrays of short strings."
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
  return normalizeGroups(parsed);
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
    options: options ?? fallbackOptions
  });
}
