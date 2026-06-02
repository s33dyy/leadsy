import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  build_research_tool_recipe,
  classify_search_result,
  expand_directory_page,
  extract_contact_paths,
  follow_up_questions_for_research_run,
  generate_search_lanes,
  evaluate_research_tool_recipe,
  plan_lead_research,
  run_research_tool_recipe,
  save_owner_search_memory,
  score_lead_evidence,
  verify_business_fit,
  type RawLeadCandidate
} from "@leadsy/ai";
import { leadBriefFingerprint, type LeadBrief, type LeadBriefSnapshot, type LeadResearchSourceType } from "@leadsy/domain";

const fullSources: LeadResearchSourceType[] = [
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

function brief(input: Partial<LeadBrief> & Pick<LeadBrief, "service" | "idealCustomers" | "searchLocations">): LeadBrief {
  return {
    id: "brief_test",
    tenantId: "tenant_test",
    ownerId: "owner_test",
    service: input.service,
    idealCustomers: input.idealCustomers,
    searchLocations: input.searchLocations,
    leadGoal: input.leadGoal ?? 50,
    researchMode: input.researchMode ?? "focused",
    sources: input.sources ?? fullSources,
    aiAction: input.aiAction ?? "draft-only",
    excludedLeads: input.excludedLeads ?? "",
    ownerWebsiteUrl: input.ownerWebsiteUrl,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
}

function laneText(lanes: ReturnType<typeof generate_search_lanes>) {
  return lanes.map((lane) => `${lane.label} ${lane.locationFocus} ${lane.buyerSegment} ${lane.queries.join(" ")}`).join("\n").toLowerCase();
}

function laneModes(lanes: ReturnType<typeof generate_search_lanes>) {
  return new Set(lanes.map((lane) => (lane as { audienceMode?: string }).audienceMode).filter(Boolean));
}

function meaningfulTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4 && !/^(services?|business|companies|agency)$/.test(token));
}

const arbitraryBriefs = [
  brief({
    service: "Water purifiers",
    idealCustomers: "finance, real estate, education and healthcare institutions",
    searchLocations: "Africa",
    leadGoal: 1000,
    researchMode: "broad",
    excludedLeads: "big companies over 15cr revenue"
  }),
  brief({
    service: "B2B SaaS onboarding software",
    idealCustomers: "growing software companies with customer success teams",
    searchLocations: "English-speaking markets"
  }),
  brief({
    service: "Medical equipment servicing",
    idealCustomers: "diagnostic centres and private clinics",
    searchLocations: "India"
  }),
  brief({
    service: "Performance marketing agency",
    idealCustomers: "real estate developers and education institutes",
    searchLocations: "near Kolkata"
  }),
  brief({
    service: "Recruitment services",
    idealCustomers: "hospitality groups and retail chains",
    searchLocations: "Canada"
  }),
  brief({
    service: "Real estate legal services",
    idealCustomers: "property buyers agents and boutique developers",
    searchLocations: "Mumbai and Pune"
  })
];

for (const item of arbitraryBriefs) {
  const lanes = generate_search_lanes({ brief: item });
  assert.ok(lanes.length > 0, `No lanes generated for ${item.service}`);
  assert.ok(lanes.some((lane) => lane.queries.length > 0), `No lane queries generated for ${item.service}`);
  const text = laneText(lanes);
  assert.ok(meaningfulTokens(item.service).some((token) => text.includes(token)), `Lane text ignored offer for ${item.service}`);
  assert.ok(!/childcare early learning centres canada/i.test(text), `Stale Canada childcare lane leaked into ${item.service}`);
}

const africaLaneText = laneText(generate_search_lanes({ brief: arbitraryBriefs[0] }));
assert.match(africaLaneText, /\bnigeria\b|\bkenya\b|\bsouth africa\b|\bghana\b/, "Africa should expand into concrete country lanes.");

const englishMarketText = laneText(generate_search_lanes({ brief: arbitraryBriefs[1] }));
assert.match(englishMarketText, /\bunited states\b|\bunited kingdom\b|\bcanada\b|\baustralia\b/, "English-speaking markets should expand into concrete market lanes.");

const kolkataText = laneText(generate_search_lanes({ brief: arbitraryBriefs[3] }));
assert.match(kolkataText, /\bkolkata\b/, "Near Kolkata should retain Kolkata as a concrete lane.");

const creatorBrief = brief({
  service: "Skincare brand collaborations",
  idealCustomers: "Instagram influencers and skincare creators",
  searchLocations: "India"
});
const creatorModes = laneModes(generate_search_lanes({ brief: creatorBrief }));
assert.ok(
  creatorModes.has("creator-influencer") || creatorModes.has("b2c-public-profile"),
  `Creator searches should use B2C/profile mode, got ${[...creatorModes].join(", ")}`
);

const consumerIntentModes = laneModes(
  generate_search_lanes({
    brief: brief({
      service: "Home tutor matching",
      idealCustomers: "people asking for home tutors near Kolkata",
      searchLocations: "Kolkata"
    })
  })
);
assert.ok(consumerIntentModes.has("consumer-intent"), `Consumer-intent searches should be mode-tagged, got ${[...consumerIntentModes].join(", ")}`);

const candidateModes = laneModes(
  generate_search_lanes({
    brief: brief({
      service: "Recruitment shortlisting",
      idealCustomers: "React developers looking for jobs",
      searchLocations: "India"
    })
  })
);
assert.ok(candidateModes.has("recruiting-candidate"), `Recruiting/candidate searches should be mode-tagged, got ${[...candidateModes].join(", ")}`);

const directoryClassification = classify_search_result({
  result: {
    title: "India Dental Clinics Directory - contact phone and websites",
    url: "https://example-directory.test/india/dental-clinics",
    snippet: "Browse clinics with contact details."
  },
  brief: arbitraryBriefs[2],
  sourceType: "directory-osint"
});
assert.equal(directoryClassification.classification, "directory");
assert.equal(directoryClassification.shouldExpandDirectory, true);

const articleClassification = classify_search_result({
  result: {
    title: "Article: How India diagnostic centres choose equipment vendors",
    url: "https://publisher.test/india/blog/how-diagnostic-centres-choose-equipment-vendors",
    snippet: "A general guide, not a prospect page."
  },
  brief: arbitraryBriefs[2]
});
assert.equal(articleClassification.classification, "article");

const creatorClassification = classify_search_result({
  result: {
    title: "Anika Skin - Instagram photos and videos",
    url: "https://www.instagram.com/anika.skin",
    snippet: "Public profile for skincare routines, reels and brand collaborations in India."
  },
  brief: creatorBrief,
  sourceType: "social-osint"
});
assert.equal(creatorClassification.classification, "creator-profile");

const snippetLocatedSocialProfile = classify_search_result({
  result: {
    title: "Smile Care Clinic - Instagram photos and videos",
    url: "https://www.instagram.com/smilecarebkp",
    snippet: "Public profile for Smile Care Clinic in Barrackpore, West Bengal with appointment and WhatsApp contact details."
  },
  brief: brief({
    service: "Performance marketing",
    idealCustomers: "clinics",
    searchLocations: "Barrackpore West Bengal"
  }),
  sourceType: "social-osint"
});
assert.equal(snippetLocatedSocialProfile.classification, "social-profile");
assert.equal(snippetLocatedSocialProfile.reason, undefined, "Snippet location evidence should keep social business profiles in the candidate pool.");

const expanded = expand_directory_page({
  brief: arbitraryBriefs[2],
  page: {
    url: "https://example-directory.test/kolkata/dental-clinics",
    title: "Kolkata Dental Clinics Directory",
    text: [
      "Alpha Dental Clinic contact phone +91 98300 11111 website https://alpha-dental.example",
      "Beta Diagnostics Centre email hello@beta-diagnostics.example services contact",
      "Generic health article about dental care"
    ].join("\n"),
    emails: ["hello@beta-diagnostics.example"],
    phones: ["+91 98300 11111"],
    socialLinks: []
  },
  query: "diagnostic centres Kolkata directory contact",
  maxLeads: 5
});
assert.ok(expanded.length >= 2, "Directory expansion should produce individual business candidates.");
assert.ok(expanded.every((lead) => lead.evidence?.some((item) => item.sourceType === "directory-osint")), "Expanded leads need directory evidence.");
assert.ok(expanded.some((lead) => lead.website === "https://alpha-dental.example"), "Directory expansion should preserve individual business website URLs.");

const briefSnapshot: LeadBriefSnapshot = {
  service: "Lead generation",
  idealCustomers: "clinics",
  searchLocations: "Kolkata",
  leadGoal: 25,
  researchMode: "focused",
  sources: fullSources,
  aiAction: "draft-only",
  excludedLeads: ""
};
assert.notEqual(
  leadBriefFingerprint({ ...briefSnapshot, ownerWebsiteUrl: "https://agency-a.example" }),
  leadBriefFingerprint({ ...briefSnapshot, ownerWebsiteUrl: "https://agency-b.example" }),
  "Owner website changes must invalidate stale search sessions."
);

const goodRaw: RawLeadCandidate = {
  businessName: "Alpha Dental Clinic",
  category: "Dental clinic",
  city: "Kolkata",
  phone: "+91 98300 11111",
  website: "https://alpha-dental.example/contact",
  contentQualitySignal: "Dental clinic in Kolkata with appointment booking and patient services.",
  whyTheyMayNeedAgency: "Dental clinic in Kolkata offering appointments and public patient enquiry paths.",
  outreachAngle: "Reference their appointment page and propose a practical patient acquisition improvement.",
  evidence: [
    {
      sourceType: "website-contact-osint",
      label: "Alpha Dental Clinic contact page",
      url: "https://alpha-dental.example/contact",
      note: "Kolkata dental clinic appointment and contact page."
    }
  ],
  sourceTypes: ["website-contact-osint", "browser-public-page"]
};

const goodScore = score_lead_evidence({ raw: goodRaw, brief: arbitraryBriefs[2] });
assert.equal(goodScore.decision.status, "good", goodScore.decision.summary);
assert.ok(goodScore.contactPaths.some((path) => path.type === "phone"), "Good lead should expose a contact path.");

const deterministicFallbackGood = score_lead_evidence({
  raw: {
    ...goodRaw,
    forceNeedsProof: true,
    evidence: [
      {
        sourceType: "website-contact-osint",
        label: "Alpha Dental Clinic contact page",
        url: "https://alpha-dental.example/contact",
        note: "Deterministic public page fallback with visible Kolkata dental clinic phone and appointment contact."
      }
    ],
    sourceTypes: ["website-contact-osint", "browser-public-page"]
  },
  brief: arbitraryBriefs[2]
});
assert.equal(
  deterministicFallbackGood.decision.status,
  "good",
  "Deterministic public evidence should not be blanket-quarantined when all Good gates pass."
);

const directoryGood = score_lead_evidence({
  raw: expanded.find((lead) => lead.website === "https://alpha-dental.example") ?? expanded[0]!,
  brief: arbitraryBriefs[2]
});
assert.equal(directoryGood.decision.status, "good", "Directory-expanded individual businesses with contact and website proof can become Good.");

const needsProof = score_lead_evidence({
  raw: {
    ...goodRaw,
    phone: undefined,
    email: undefined,
    website: "https://alpha-dental.example/about",
    evidence: [{ sourceType: "website-contact-osint", label: "Alpha Dental Clinic about page", url: "https://alpha-dental.example/about" }],
    sourceTypes: ["website-contact-osint"]
  },
  brief: arbitraryBriefs[2]
});
assert.equal(needsProof.decision.status, "needs-proof");

const creatorProfileScore = score_lead_evidence({
  raw: {
    businessName: "Anika Skin",
    category: "Skincare creator",
    city: "India",
    instagram: "https://www.instagram.com/anika.skin",
    audienceMode: "creator-influencer",
    contentQualitySignal: "Indian skincare creator with public beauty routines and collaboration highlights.",
    whyTheyMayNeedAgency: "Creator is a fit for skincare brand collaborations and public profile review.",
    outreachAngle: "Review public creator fit before any manual outreach.",
    evidence: [
      {
        sourceType: "social-osint",
        label: "Anika Skin public Instagram profile",
        url: "https://www.instagram.com/anika.skin",
        note: "Public profile indicates skincare creator in India."
      }
    ],
    sourceTypes: ["social-osint"]
  } as RawLeadCandidate,
  brief: creatorBrief
});
assert.equal(creatorProfileScore.decision.status, "good", creatorProfileScore.decision.summary);

const privateProfileScore = score_lead_evidence({
  raw: {
    businessName: "Private Beauty Profile",
    category: "Skincare creator",
    city: "India",
    instagram: "https://www.instagram.com/private-beauty",
    audienceMode: "creator-influencer",
    contentQualitySignal: "Private profile, followers only and login required.",
    evidence: [
      {
        sourceType: "social-osint",
        label: "Private profile",
        url: "https://www.instagram.com/private-beauty",
        note: "Login required."
      }
    ],
    sourceTypes: ["social-osint"]
  } as RawLeadCandidate,
  brief: creatorBrief
});
assert.notEqual(privateProfileScore.decision.status, "good", privateProfileScore.decision.summary);

const rejected = score_lead_evidence({
  raw: {
    businessName: "Top 10 Medical Equipment Suppliers",
    category: "Marketplace suppliers",
    city: "Kolkata",
    website: "https://supplier-marketplace.test/top-10-medical-equipment-suppliers",
    evidence: [{ sourceType: "openrouter-web-search", label: "Supplier marketplace", url: "https://supplier-marketplace.test/top-10-medical-equipment-suppliers" }]
  },
  brief: arbitraryBriefs[2]
});
assert.equal(rejected.decision.status, "rejected");

const fit = verify_business_fit({ raw: goodRaw, brief: arbitraryBriefs[2] });
assert.equal(fit.status, "fit");
assert.ok(extract_contact_paths({ raw: goodRaw, brief: arbitraryBriefs[2] }).length >= 2);

async function runAsyncAssertions() {
  process.env.LEADSY_AI_PLANNER_ENABLED = "false";
  const ambiguousPlan = await plan_lead_research({
    tenantId: "tenant_test",
    ownerId: "owner_test",
    brief: brief({
      service: "Gym membership growth",
      idealCustomers: "find customers for gym",
      searchLocations: "Kolkata",
      leadGoal: 100
    })
  });
  assert.ok(
    ambiguousPlan.strategy.questions.some((question) => question.category === "audience-mode"),
    "Ambiguous customer searches should ask an audience-mode MCQ."
  );
  assert.ok(
    ambiguousPlan.strategy.questions
      .find((question) => question.category === "audience-mode")
      ?.options.some((option) => option.id === "all-relevant-modes"),
    "Audience-mode MCQ should allow all relevant modes."
  );

  const checkpointQuestions = follow_up_questions_for_research_run({
    brief: arbitraryBriefs[0],
    strategy: generate_search_lanes({ brief: arbitraryBriefs[0] }).length
      ? {
          offer: arbitraryBriefs[0].service,
          buyerTypes: ["institutions"],
          markets: ["Africa"],
          buyingTriggers: [],
          disqualifiers: [],
          evidenceRules: [],
          assumptions: [],
          questions: [],
          audienceModes: ["b2b-company"],
          lanes: generate_search_lanes({ brief: arbitraryBriefs[0] })
        }
      : undefined,
    run: {
      found: 0,
      needsReview: 13,
      blocked: 0,
      metrics: {
        searchesRun: 18,
        pagesFetched: 0,
        candidateCount: 0,
        dedupedCount: 0,
        savedCount: 0,
        sourceDeferred: 6
      }
    }
  });
  assert.ok(checkpointQuestions.length >= 1, "Poor checkpoints should ask the owner a recovery MCQ.");
  assert.ok(["source-priority", "blocked-source-recovery", "proof-strictness"].includes(checkpointQuestions[0]?.category ?? ""));

  const ownerSiteBrief = brief({
    service: "Growth consulting",
    idealCustomers: "businesses that match my offer",
    searchLocations: "Kolkata",
    ownerWebsiteUrl: "https://owner.example"
  });
  const recipe = build_research_tool_recipe({
    brief: ownerSiteBrief,
    ownerWebsiteContext: {
      summary: "Owner sells dental patient acquisition systems with WhatsApp booking funnels.",
      offerTerms: ["dental patient acquisition", "WhatsApp booking funnels"],
      buyerTypes: ["dental clinics", "implant centres"],
      marketTerms: ["Kolkata"],
      disqualifiers: ["marketing agencies"],
      proofTerms: ["appointment", "contact", "clinic"]
    },
    diagnostics: {
      zeroGoodRuns: 1,
      gateBlockers: { weakFit: 4, missingContact: 2 },
      failedQueries: ["businesses Kolkata contact"]
    }
  });
  assert.ok(recipe.id.startsWith("recipe_"), "Runtime recipe should have a stable generated id.");
  assert.ok(recipe.steps.some((step) => step.primitive === "search_public_web"), "Runtime recipe should use existing safe primitives.");
  assert.ok(
    recipe.queries.join(" ").toLowerCase().includes("dental") || recipe.queries.join(" ").toLowerCase().includes("whatsapp"),
    "Runtime recipe should use owner website context instead of generic search text."
  );
  assert.ok(run_research_tool_recipe({ recipe }).length >= 1, "Runtime recipe should compile into executable safe search steps.");
  const evaluation = evaluate_research_tool_recipe({
    recipe,
    metrics: {
      searchesRun: 3,
      pagesFetched: 4,
      candidateCount: 5,
      dedupedCount: 4,
      savedCount: 2,
      usableProspects: 2,
      properDataCount: 2,
      qualityGateBreakdown: { savedGood: 2, missingContact: 1 }
    }
  });
  assert.equal(evaluation.status, "keep", evaluation.reason);
  const memory = save_owner_search_memory({
    ownerId: "owner_test",
    brief: ownerSiteBrief,
    recipe,
    evaluation
  });
  assert.equal(memory.recipeId, recipe.id);

  const labSource = readFileSync("apps/web/src/components/lead-magnet-lab.tsx", "utf8");
  const answerFunctionStart = labSource.indexOf("async function answerAgentQuestions()");
  const answerFunctionEnd = labSource.indexOf("async function stopSearch()", answerFunctionStart);
  const answerFunction = labSource.slice(answerFunctionStart, answerFunctionEnd);
  const clearIndex = answerFunction.indexOf("setAgentQuestions([])");
  const submitIndex = answerFunction.indexOf('submitJson("/api/lead-magnet/search/answer"');
  assert.ok(clearIndex >= 0 && submitIndex >= 0 && clearIndex < submitIndex, "MCQ modal should close before answer submission starts.");
}

runAsyncAssertions()
  .then(() => console.log(JSON.stringify({ ok: true, agentToolTests: arbitraryBriefs.length }, null, 2)))
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
