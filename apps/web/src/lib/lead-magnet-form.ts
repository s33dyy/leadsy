import { LEAD_MAGNET_MAX_LEAD_GOAL, type LeadResearchSourceType } from "@leadsy/domain";
import type { LeadBriefInput } from "./lead-magnet-store";

export const fullLeadResearchSources: LeadResearchSourceType[] = [
  "openrouter-web-search",
  "directory-osint",
  "social-osint",
  "website-contact-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint",
  "browser-public-page",
  "manual-import"
];

export const lightLeadResearchSources: LeadResearchSourceType[] = [
  "openrouter-web-search",
  "browser-public-page",
  "manual-import"
];

const supportedSources = new Set<LeadResearchSourceType>(fullLeadResearchSources);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function sourcesFromForm(formData: FormData) {
  const preset = text(formData, "sourcePreset");
  if (preset === "light") {
    return lightLeadResearchSources;
  }
  if (preset === "full") {
    return fullLeadResearchSources;
  }

  const selected = formData
    .getAll("sources")
    .map((source) => String(source))
    .filter((source): source is LeadResearchSourceType => supportedSources.has(source as LeadResearchSourceType));
  return selected.length ? [...new Set(selected)] : fullLeadResearchSources;
}

export function parseLeadBriefForm(formData: FormData): { input: LeadBriefInput; sourcePreset: string } {
  const leadGoal = Number(text(formData, "leadGoal") || 25);
  const aiAction = text(formData, "aiAction");
  const sourcePreset = text(formData, "sourcePreset");
  const mode = text(formData, "researchMode");
  const researchMode =
    sourcePreset === "full" || mode === "broad"
      ? "broad"
      : sourcePreset === "light" || mode === "focused"
        ? "focused"
        : leadGoal >= 25
          ? "broad"
          : "focused";

  return {
    sourcePreset,
    input: {
      service: text(formData, "service"),
      ownerWebsiteUrl: text(formData, "ownerWebsiteUrl"),
      idealCustomers: text(formData, "idealCustomers"),
      searchLocations: text(formData, "searchLocations"),
      leadGoal: Number.isFinite(leadGoal) ? Math.max(1, Math.min(LEAD_MAGNET_MAX_LEAD_GOAL, Math.round(leadGoal))) : 25,
      researchMode,
      sources: sourcesFromForm(formData),
      aiAction: aiAction === "follow-up-plan" ? "follow-up-plan" : "draft-only",
      excludedLeads: text(formData, "excludedLeads")
    }
  };
}

export function hasMinimumBrief(input: LeadBriefInput) {
  return input.service.length >= 2 && input.idealCustomers.length >= 2 && input.searchLocations.length >= 2;
}

export function magnetRedirect(request: Request, params: Record<string, string>) {
  const url = new URL("/app/magnet", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}
