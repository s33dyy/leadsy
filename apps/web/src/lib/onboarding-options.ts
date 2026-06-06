export type OnboardingOptionGroupKey =
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

export type OnboardingOptionGroups = Record<OnboardingOptionGroupKey, string[]>;

export const onboardingFallbackOptions: OnboardingOptionGroups = {
  role: ["Founder", "Sales Manager", "Marketing Manager", "Operations Manager", "Admissions Lead", "Customer Support Lead"],
  industry: ["Real Estate", "Education", "Healthcare", "Local Services", "Retail", "Hospitality", "SaaS", "Financial Services"],
  teamSize: ["1-5", "6-15", "16-50", "51-100", "100+"],
  leadSources: ["WhatsApp Ads", "Website", "Instagram", "Facebook", "Google Business Profile", "Manual Imports", "Referrals"],
  assignmentPreferences: ["Unassigned queue", "Round robin", "Source-based routing", "Manager assigns manually", "Assign to current owner"],
  followUpPreferences: ["Reply within 5 minutes", "Same-day follow-up", "Reminder after 24 hours", "Escalate hot leads", "Create task after missed reply"],
  services: ["Lead qualification", "WhatsApp follow-up", "Appointment booking", "Sales handoff", "Site visit coordination", "Customer support triage"],
  markets: ["Local city", "Statewide", "Pan-India", "International", "Tier 1 cities", "Tier 2 cities"],
  targetQuestion0: ["Consumers", "Small businesses", "Mid-market", "Enterprise", "Parents/students"],
  targetQuestion1: ["Under ₹10k", "₹10k-₹50k", "₹50k-₹2L", "₹2L+"],
  targetQuestion2: ["Same day", "1-7 days", "2-4 weeks", "1-3 months"]
};

export function questionLikeOption(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.endsWith("?") ||
    /^(what|who|where|when|why|how|do|does|can|should|which)\b/.test(normalized)
  );
}

export function sanitizeOptionGroup(key: OnboardingOptionGroupKey, options: string[] | undefined) {
  const answers = (options ?? []).filter((option) => !questionLikeOption(option));
  return answers.length ? answers : onboardingFallbackOptions[key];
}

export function normalizeOnboardingOptionGroups(value: unknown): OnboardingOptionGroups | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Partial<Record<OnboardingOptionGroupKey, unknown>>;
  const entries = Object.keys(onboardingFallbackOptions).map((key) => {
    const typedKey = key as OnboardingOptionGroupKey;
    const options = Array.isArray(record[typedKey])
      ? record[typedKey]
          ?.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
          .map((item) => item.trim().slice(0, 64))
          .slice(0, 8)
      : undefined;
    const sanitizedOptions = sanitizeOptionGroup(typedKey, options);
    return [typedKey, sanitizedOptions?.length ? sanitizedOptions : onboardingFallbackOptions[typedKey]] as const;
  });
  return Object.fromEntries(entries) as OnboardingOptionGroups;
}
