import assert from "node:assert/strict";
import { normalizeOnboardingOptionGroups, questionLikeOption, sanitizeOptionGroup } from "../apps/web/src/lib/onboarding-options";

function main() {
  assert.equal(questionLikeOption("What is your main goal?"), true, "question text should be detected");
  assert.equal(questionLikeOption("Round robin"), false, "answer text should be allowed");

  assert.deepEqual(
    sanitizeOptionGroup("leadSources", ["Where do most leads come from?", "WhatsApp Ads"]),
    ["WhatsApp Ads"],
    "all option groups should reject question-like chips"
  );
  assert.deepEqual(
    sanitizeOptionGroup("assignmentPreferences", ["Who should new leads go to?"]),
    ["Unassigned queue", "Round robin", "Source-based routing", "Manager assigns manually", "Assign to current owner"],
    "groups with only question-like chips should fall back to deterministic answer options"
  );

  const normalized = normalizeOnboardingOptionGroups({
    role: ["What is your title?", "Founder"],
    industry: ["Which industry are you in?"],
    targetQuestion0: ["Consumers", "What company size do you sell to?"],
    targetQuestion2: ["Same day", "How fast should sales happen?"]
  });

  assert.equal(normalized.role.includes("What is your title?"), false, "role options should not include questions");
  assert.deepEqual(normalized.industry, ["Real Estate", "Education", "Healthcare", "Local Services", "Retail", "Hospitality", "SaaS", "Financial Services"]);
  assert.deepEqual(normalized.targetQuestion0, ["Consumers"]);
  assert.deepEqual(normalized.targetQuestion2, ["Same day"]);
}

main();
