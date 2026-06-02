#!/usr/bin/env node

const baseUrl = process.env.LEADSY_BASE_URL || "http://localhost:3000";
const email = process.env.LEADSY_TEST_EMAIL;
const password = process.env.LEADSY_TEST_PASSWORD;

if (!email || !password) {
  if (process.env.LEADSY_REQUIRE_API_REGRESSION === "1") {
    throw new Error("Set LEADSY_TEST_EMAIL and LEADSY_TEST_PASSWORD before running Lead Magnet regression.");
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: "authenticated-api-regression",
        reason: "Set LEADSY_TEST_EMAIL and LEADSY_TEST_PASSWORD to run browser/API-backed Lead Magnet regression."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const fullSources = [
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

const liveCollectorSources = [
  "openrouter-web-search",
  "directory-osint",
  "social-osint",
  "website-contact-osint",
  "review-reputation-osint",
  "content-gap-osint",
  "hiring-news-osint",
  "competitor-osint"
];

let cookie = "";

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function rememberCookies(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  const fallback = headers.get("set-cookie") ? [headers.get("set-cookie")] : [];
  for (const value of raw.length ? raw : fallback) {
    const pair = value.split(";")[0];
    if (!pair) continue;
    const name = pair.split("=")[0];
    const existing = cookie
      .split("; ")
      .filter(Boolean)
      .filter((item) => item.split("=")[0] !== name);
    cookie = [...existing, pair].join("; ");
  }
}

async function request(path, options = {}) {
  const headers = {
    ...(options.body === undefined ? {} : { "content-type": "application/json" }),
    ...(cookie ? { cookie } : {}),
    ...(options.headers ?? {})
  };
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
    redirect: "manual"
  });
  rememberCookies(response.headers);
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { response, status: response.status, text, json };
}

async function login() {
  const health = await request("/api/health");
  assert(health.status === 200 && health.json?.ok === true, "Health check failed", health.json ?? health.text);

  const result = await request("/api/auth/login", {
    body: { emailOrPhone: email, password, next: "/app/magnet" }
  });
  assert(result.status === 200, "Login failed", result.json ?? result.text);
  assert(cookie.includes("leadsy_session="), "Login did not set a session cookie.");
}

async function saveBrief(input) {
  const result = await request("/api/lead-magnet/brief", { body: input });
  assert(result.status === 200, "Brief save failed", result.json ?? result.text);
  assert(result.json?.brief?.leadGoal === input.leadGoal, "Saved brief leadGoal mismatch", result.json?.brief);
  return result.json;
}

async function previewPlan() {
  const result = await request("/api/lead-magnet/plan-preview", { body: { budgetCapInr: 1, fullRun: false } });
  assert(result.status === 200 && result.json?.preview, "Plan preview failed", result.json ?? result.text);
  return result.json.preview;
}

async function startSearchSession(input) {
  const result = await request("/api/lead-magnet/search/start", { body: input, timeoutMs: 240_000 });
  assert(result.status === 200 && result.json?.searchSession, "Agent search start failed", result.json ?? result.text);
  assert(result.json.searchSession.briefFingerprint, "Search session missing brief fingerprint", result.json.searchSession);
  assert(result.json.searchSession.planPreview?.briefFingerprint === result.json.searchSession.briefFingerprint, "Search session plan fingerprint mismatch", result.json.searchSession);
  return result.json;
}

async function validateSourcePreview(preview) {
  assert(preview.estimatedSearches > 1, "Preview did not create multiple searches", preview);
  const sources = new Set(preview.lanes.flatMap((lane) => lane.sourceTypes ?? []));
  for (const source of liveCollectorSources) {
    assert(sources.has(source), `Preview missing collector ${source}`, { sources: [...sources], lanes: preview.lanes.slice(0, 3) });
  }
  const plannedSearches = preview.lanes.flatMap((lane) => lane.searches ?? []);
  assert(plannedSearches.length >= preview.estimatedSearches, "Preview did not expose source-specific searches", { plannedSearches, preview });
  assert(new Set(plannedSearches.map((item) => item.sourceType)).size > 3, "Preview collapsed searches into too few sources", plannedSearches);
}

function leadText(lead) {
  return [
    lead.businessName,
    lead.category,
    lead.city,
    lead.area,
    lead.address,
    lead.location?.country,
    lead.location?.evidence,
    lead.website,
    ...(lead.evidence ?? []).flatMap((item) => [item.label, item.url, item.note])
  ].filter(Boolean).join(" ");
}

function assertNoAustraliaInCampaign(workspace, campaignId) {
  const campaignLeads = (workspace.leads ?? []).filter((lead) => lead.campaignId === campaignId);
  const australiaLeak = campaignLeads.find((lead) => /\b(australia|sydney|melbourne|brisbane|perth|adelaide)\b|\.com\.au\b/i.test(leadText(lead)));
  assert(!australiaLeak, "Canada campaign included an Australia/test lead", { campaignId, australiaLeak });
  return campaignLeads;
}

async function importQaLeads() {
  const rawText = [
    "QA Regression Dental Clinic, Sydney Australia, +61255550123, qa-dental@example.com, https://qa-dental.example.com",
    "QA Regression Learning Centre, Melbourne Australia, +61355550123, hello@qa-learning.example.com, https://qa-learning.example.com"
  ].join("\n");
  const result = await request("/api/lead-magnet/import", {
    body: {
      rawText,
      runLabel: "QA Scenario",
      scenarioLabel: "Lead Magnet Regression Import"
    }
  });
  assert(result.status === 200, "Manual import failed", result.json ?? result.text);
  assert(result.json?.latestRun?.runLabel === "QA Scenario", "Manual import did not keep QA run label", result.json?.latestRun);
  assert(result.json?.latestRun?.scenarioLabel === "Lead Magnet Regression Import", "Manual import did not keep scenario label", result.json?.latestRun);
  assert((result.json?.latestRun?.found ?? 0) + (result.json?.latestRun?.needsReview ?? 0) >= 1, "Manual import did not save any inspectable record", result.json?.latestRun);
  return result.json;
}

async function updateImportedLead(workspace) {
  const touchedId = workspace.latestRun?.events?.find((event) => event.leadId)?.leadId;
  const lead = workspace.leads?.find((candidate) => candidate.id === touchedId);
  assert(lead, "Could not find imported lead to update", workspace.latestRun);
  const payload = {
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    area: "QA regression verified area",
    phone: lead.phone ?? "",
    whatsapp: lead.whatsapp ?? "",
    email: lead.email ?? "",
    website: lead.website ?? "",
    instagram: lead.instagram ?? "",
    facebook: lead.facebook ?? "",
    linkedin: lead.linkedin ?? "",
    address: lead.address ?? "",
    contentQualitySignal: lead.contentQualitySignal,
    whyTheyMayNeedAgency: lead.whyTheyMayNeedAgency,
    outreachAngle: lead.outreachAngle,
    nextAction: lead.nextAction
  };
  const result = await request(`/api/lead-magnet/leads/${encodeURIComponent(lead.id)}`, {
    method: "PATCH",
    body: payload
  });
  assert(result.status === 200, "Lead update failed", result.json ?? result.text);
  assert(result.json?.lead?.area === "QA regression verified area", "Lead update did not persist", result.json?.lead);
}

async function parseSse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];
  let finalPayload;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const packets = buffer.split("\n\n");
    buffer = packets.pop() ?? "";
    for (const packet of packets) {
      const name = packet.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
      const data = packet
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (!data) continue;
      const payload = JSON.parse(data);
      if (name === "progress") events.push(payload);
      if (name === "final") finalPayload = payload;
      if (name === "error") throw new Error(payload.message ?? "SSE stream returned an error.");
    }
  }
  return { events, finalPayload };
}

async function runProtectedDiscovery({
  runLabel = "QA Scenario",
  scenarioLabel = "Lead Magnet Regression Protected Stream"
} = {}) {
  const response = await fetch(`${baseUrl}/api/lead-magnet/discover/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie
    },
	    body: JSON.stringify({
	      budgetCapInr: 1,
	      fullRun: false,
	      runLabel,
	      scenarioLabel
	    }),
    signal: AbortSignal.timeout(240_000)
  });
  if (response.status !== 200) {
    const text = await response.text();
    assert(false, "Discovery stream failed to start", { status: response.status, text });
  }
  const { events, finalPayload } = await parseSse(response);
  const latestRun = finalPayload?.latestRun;
  assert(latestRun, "Discovery stream did not return latestRun", finalPayload);
  assert(latestRun.runLabel === runLabel, "Discovery run label was not retained", latestRun);
  assert(latestRun.scenarioLabel === scenarioLabel, "Discovery scenario label was not retained", latestRun);
  const eventSources = new Set(events.map((event) => event.sourceType).filter(Boolean));
  assert(eventSources.has("website-contact-osint"), "Discovery did not emit website/contact events", { eventSources: [...eventSources] });
  assert(eventSources.has("directory-osint") || eventSources.has("social-osint"), "Discovery did not emit secondary collector events", { eventSources: [...eventSources] });
  const breakdown = latestRun.metrics?.sourceBreakdown ?? {};
  assert(Object.keys(breakdown).length >= 2, "Discovery did not persist sourceBreakdown", latestRun.metrics);
  assert((latestRun.metrics?.searchesRun ?? 0) > 0, "Discovery metrics did not record searches", latestRun.metrics);
  assert((latestRun.metrics?.candidateCount ?? 0) >= (latestRun.metrics?.dedupedCount ?? 0), "Candidate metrics are inconsistent", latestRun.metrics);
  return { events, latestRun };
}

async function validateCanadaCampaignIsolation(stamp) {
  await saveBrief({
    service: `QA Regression Ownership ${stamp}`,
    idealCustomers: "finance, real estate and education businesses",
    searchLocations: "Canada",
    leadGoal: 1000,
    researchMode: "broad",
    sources: fullSources,
    aiAction: "draft-only",
    excludedLeads: "large enterprise brands"
  });
  const preview = await previewPlan();
  await validateSourcePreview(preview);
  assert(preview.targetLeadGoal === 1000, "Canada preview did not keep the 1000 lead target", preview);
  assert(preview.lanes.every((lane) => /canada/i.test(`${lane.locationFocus} ${lane.queries?.join(" ")}`)), "Canada preview created non-Canada lanes", preview.lanes);
  const discovery = await runProtectedDiscovery({
    runLabel: "Live Campaign",
    scenarioLabel: `Lead Magnet Regression Canada Ownership ${stamp}`
  });
  assert(discovery.latestRun.metrics?.targetLeadGoal === 1000, "Canada run target was not 1000", discovery.latestRun.metrics);
  assert(discovery.latestRun.metrics?.batchNumber === 1, "Fresh Canada campaign should start at batch 1", discovery.latestRun.metrics);
  const workspace = discovery.latestRun ? (await request("/api/lead-magnet/brief")).json : null;
  assert(workspace, "Could not reload workspace after Canada campaign.");
  assertNoAustraliaInCampaign(workspace, discovery.latestRun.campaignId);
  return discovery;
}

async function validateDynamicLeadGoal(stamp) {
  await saveBrief({
    service: `QA Regression Dynamic Target ${stamp}`,
    idealCustomers: "local education and finance businesses",
    searchLocations: "Canada",
    leadGoal: 37,
    researchMode: "focused",
    sources: ["website-contact-osint", "directory-osint", "browser-public-page"],
    aiAction: "draft-only",
    excludedLeads: "large enterprise brands"
  });
  const preview = await previewPlan();
  assert(preview.targetLeadGoal === 37, "Preview did not use dynamic leadGoal=37", preview);
  assert((preview.batchSize ?? 0) <= 37, "Focused leadGoal=37 should not use a 1000-style batch", preview);
}

async function validateArbitraryBriefPlanning(stamp) {
  const cases = [
    {
      service: `QA Water Purifiers ${stamp}`,
      idealCustomers: "finance, real estate, education and healthcare institutions",
      searchLocations: "Africa",
      leadGoal: 1000,
      researchMode: "broad",
      expectedLocation: /\bnigeria\b|\bkenya\b|\bsouth africa\b|\bghana\b/i
    },
    {
      service: `QA SaaS Onboarding ${stamp}`,
      idealCustomers: "growing software companies with customer success teams",
      searchLocations: "English-speaking markets",
      leadGoal: 50,
      researchMode: "broad",
      expectedLocation: /\bunited states\b|\bunited kingdom\b|\bcanada\b|\baustralia\b/i
    },
    {
      service: `QA Medical Equipment ${stamp}`,
      idealCustomers: "diagnostic centres and private clinics",
      searchLocations: "India",
      leadGoal: 40,
      researchMode: "focused",
      expectedLocation: /\bindia\b/i
    },
    {
      service: `QA Marketing Agency ${stamp}`,
      idealCustomers: "real estate developers and education institutes",
      searchLocations: "near Kolkata",
      leadGoal: 30,
      researchMode: "focused",
      expectedLocation: /\bkolkata\b/i
    },
    {
      service: `QA Recruitment ${stamp}`,
      idealCustomers: "hospitality groups and retail chains",
      searchLocations: "Canada",
      leadGoal: 30,
      researchMode: "focused",
      expectedLocation: /\bcanada\b/i
    },
    {
      service: `QA Real Estate Services ${stamp}`,
      idealCustomers: "property buyers agents and boutique developers",
      searchLocations: "Mumbai and Pune",
      leadGoal: 30,
      researchMode: "focused",
      expectedLocation: /\bmumbai\b|\bpune\b/i
    }
  ];
  for (const item of cases) {
    await saveBrief({
      service: item.service,
      idealCustomers: item.idealCustomers,
      searchLocations: item.searchLocations,
      leadGoal: item.leadGoal,
      researchMode: item.researchMode,
      sources: fullSources,
      aiAction: "draft-only",
      excludedLeads: "large enterprise brands unless explicitly targeted"
    });
    const preview = await previewPlan();
    const text = preview.lanes.map((lane) => `${lane.label} ${lane.locationFocus} ${lane.buyerSegment} ${lane.queries?.join(" ")}`).join("\n");
    assert(preview.briefFingerprint && preview.briefSnapshot, "Preview did not store brief fingerprint/snapshot", preview);
    assert(preview.lanes.length > 0, `No lanes generated for ${item.service}`, preview);
    assert(item.expectedLocation.test(text), `Preview did not expand or retain expected market for ${item.searchLocations}`, { text });
    assert(!/childcare early learning centres Canada/i.test(text), "Stale childcare/Canada lane leaked into arbitrary brief", { service: item.service, text });
  }
}

async function validateAgentMcqAndStaleSession(stamp) {
  const vague = {
    service: `QA Agentic Offer ${stamp}`,
    idealCustomers: "businesses and companies",
    searchLocations: "Africa",
    leadGoal: 200,
    researchMode: "broad",
    sources: fullSources,
    aiAction: "draft-only",
    excludedLeads: "companies with unclear public contact details"
  };
  const vagueStart = await startSearchSession(vague);
  const vagueSession = vagueStart.searchSession;
  assert(vagueSession.status === "needs-input", "Vague brief should pause for MCQ input", vagueSession);
  assert(vagueSession.strategy?.questions?.length >= 1 && vagueSession.strategy.questions.length <= 3, "Vague brief should ask 1-3 MCQ questions", vagueSession.strategy);
  for (const question of vagueSession.strategy.questions) {
    assert(question.options?.length >= 2, "MCQ question missing options", question);
    assert(question.defaultOptionId, "MCQ question missing default option", question);
  }

  const specific = {
    service: `QA Appointment Automation ${stamp}`,
    idealCustomers: "orthodontic clinics with appointment pages",
    searchLocations: "Kolkata",
    leadGoal: 25,
    researchMode: "focused",
    sources: ["website-contact-osint", "directory-osint", "browser-public-page"],
    aiAction: "draft-only",
    excludedLeads: "hospitals and generic directories"
  };
  const specificStart = await startSearchSession(specific);
  assert(specificStart.searchSession.status === "ready", "Specific brief should start directly without MCQs", specificStart.searchSession);

  const staleBase = await startSearchSession({
    service: `QA Stale Canada ${stamp}`,
    idealCustomers: "commercial mortgage brokers",
    searchLocations: "Canada",
    leadGoal: 20,
    researchMode: "focused",
    sources: ["website-contact-osint", "directory-osint", "browser-public-page"],
    aiAction: "draft-only",
    excludedLeads: "banks"
  });
  await saveBrief({
    service: `QA Stale Africa ${stamp}`,
    idealCustomers: "private clinics",
    searchLocations: "Africa",
    leadGoal: 20,
    researchMode: "focused",
    sources: ["website-contact-osint", "directory-osint", "browser-public-page"],
    aiAction: "draft-only",
    excludedLeads: "government hospitals"
  });
  const stale = await request(`/api/lead-magnet/search/stream?sessionId=${encodeURIComponent(staleBase.searchSession.id)}`, {
    method: "GET"
  });
  assert(stale.status === 409 && stale.json?.error === "stale_session", "Old session should be rejected after brief edit", stale.json ?? stale.text);
}

async function expectBadRequests() {
  const invalidBrief = await request("/api/lead-magnet/brief", {
    body: {
      service: "QA test",
      idealCustomers: "clinics",
      searchLocations: "Australia",
      leadGoal: 1001,
      researchMode: "focused",
      sources: ["website-contact-osint"],
      aiAction: "draft-only",
      excludedLeads: ""
    }
  });
  assert(invalidBrief.status === 400, "leadGoal=1001 should be rejected", invalidBrief.json ?? invalidBrief.text);

  const invalidImport = await request("/api/lead-magnet/import", { body: { rawText: "" } });
  assert(invalidImport.status === 400, "Invalid import should return 400", invalidImport.json ?? invalidImport.text);

  const invalidDraft = await request("/api/lead-magnet/draft", { body: {} });
  assert(invalidDraft.status === 400, "Invalid draft request should return 400", invalidDraft.json ?? invalidDraft.text);

  const invalidOutreach = await request("/api/lead-magnet/outreach", { body: {} });
  assert(invalidOutreach.status === 400, "Invalid outreach request should return 400", invalidOutreach.json ?? invalidOutreach.text);
}

async function main() {
  const started = Date.now();
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  await login();
  const initial = await request("/api/lead-magnet/brief");
  assert(initial.status === 200, "Could not read initial workspace", initial.json ?? initial.text);
  const originalBrief = initial.json.brief;
  let discovery;

	  try {
	    await expectBadRequests();
	    await validateArbitraryBriefPlanning(stamp);
	    await validateAgentMcqAndStaleSession(stamp);
	    await validateCanadaCampaignIsolation(stamp);
	    await validateDynamicLeadGoal(stamp);

	    await saveBrief({
      service: "QA Regression Communication Devices",
      idealCustomers: "finance, healthcare, education businesses",
      searchLocations: "Australia",
      leadGoal: 1000,
      researchMode: "broad",
      sources: fullSources,
      aiAction: "draft-only",
      excludedLeads: "large enterprise brands"
    });
    await validateSourcePreview(await previewPlan());

    await saveBrief({
      service: "QA Regression Communication Devices",
      idealCustomers: "dental clinics and tutoring centres",
      searchLocations: "Sydney Australia",
      leadGoal: 8,
      researchMode: "focused",
      sources: ["website-contact-osint", "directory-osint", "social-osint", "browser-public-page", "manual-import"],
      aiAction: "draft-only",
      excludedLeads: "large enterprise brands"
    });
    const imported = await importQaLeads();
    await updateImportedLead(imported);
    discovery = await runProtectedDiscovery();
  } finally {
    if (originalBrief) {
      await saveBrief({
        service: originalBrief.service,
        idealCustomers: originalBrief.idealCustomers,
        searchLocations: originalBrief.searchLocations,
        leadGoal: originalBrief.leadGoal,
        researchMode: originalBrief.researchMode,
        sources: originalBrief.sources,
        aiAction: originalBrief.aiAction,
        excludedLeads: originalBrief.excludedLeads
      });
    }
  }

  assert(discovery, "Protected discovery did not complete.");
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    JSON.stringify(
      {
        ok: true,
        seconds: Number(seconds),
        protectedRun: {
          id: discovery.latestRun.id,
          found: discovery.latestRun.found,
          needsReview: discovery.latestRun.needsReview,
          blocked: discovery.latestRun.blocked,
          sourcesUsed: discovery.latestRun.sourcesUsed,
          sourceBreakdown: Object.keys(discovery.latestRun.metrics?.sourceBreakdown ?? {})
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
