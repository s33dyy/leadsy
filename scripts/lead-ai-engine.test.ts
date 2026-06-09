import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function main() {
  const tempDir = await mkdtemp(join(tmpdir(), "leadsy-lead-ai-engine-"));
  process.env.LEADSY_DATA_DIR = tempDir;
  process.env.NODE_ENV = "test";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.AI_PROVIDER = "openrouter";
  process.env.LEADSY_ENABLE_REMOTE_AI = "true";
  process.env.LEADSY_FREE_AI_MODEL = "openrouter/free";
  process.env.USD_INR_RATE = "80";

  const originalFetch = globalThis.fetch;
  const openRouterCalls: Array<Record<string, unknown>> = [];
  globalThis.fetch = (async (url, init) => {
    if (!String(url).includes("/chat/completions")) {
      return originalFetch(url, init);
    }
    const payload = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    openRouterCalls.push(payload);
    return new Response(
      JSON.stringify({
        id: "gen_qualification_contextual",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                reply: "Thanks Rohan, NovaFit’s ₹80k/month content plan sounds clear. When would you like the first SEO blog batch to go live?",
                extractedFields: {
                  company: "NovaFit",
                  need: "12 SEO blogs and LinkedIn posts every month",
                  budget: "₹80k monthly",
                  timeline: "this month",
                  authority: "Rohan approves content spends"
                },
                crmNote: "Rohan from NovaFit wants monthly SEO blogs and LinkedIn posts with an ₹80k/month budget.",
                nextMissingField: "",
                shouldEscalate: false,
                confidence: 0.92
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 240,
          completion_tokens: 80,
          total_tokens: 320,
          cost: 0.00125
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const { runAgentForInboundLead } = await import("../apps/web/src/lib/agent-runtime");
    const { createTeamMember } = await import("../apps/web/src/lib/teamspace-store");
    const { saveTwilioInboundMessage, listLeadKnowledgeRecords } = await import("../apps/web/src/lib/lead-knowledge-store");
    const { getCostReceipt } = await import("../apps/web/src/lib/cost-receipt");
    const { updateAiWorkspaceSettings, updateWorkspaceBusinessSettings, updateOperatorProfileSettings } = await import("../apps/web/src/lib/user-settings-store");

    const scope = { tenantId: "tenant_lead_ai_engine", ownerId: "owner_lead_ai_engine" };
    await updateWorkspaceBusinessSettings({
      ...scope,
      businessName: "XYZ Company",
      industry: "Content marketing",
      services: ["SEO blogs", "LinkedIn content", "Content calendars"],
      qualificationFields: ["company", "need", "budget", "timeline", "authority"]
    });
    await updateOperatorProfileSettings({
      ...scope,
      communicationStyle: "Warm, concise, and specific to content marketing",
      knowledgeBase: "XYZ Company sells monthly content retainers, SEO blog production, LinkedIn ghostwriting, and editorial calendars."
    });
    await updateAiWorkspaceSettings({
      ...scope,
      providerMode: "openrouter",
      remoteAiEnabled: true,
      costMode: "free",
      responseStyle: "Warm and specific",
      maxTokens: 500
    });

    const qualificationAgent = await createTeamMember({
      ...scope,
      type: "ai_agent_full",
      name: "Qualification AI",
      role: "agent",
      pipelineStages: ["new", "collecting"],
      behaviorInstructions: "Qualify content marketing leads for XYZ Company. Ask one focused question per turn.",
      autoReplyEnabled: true,
      escalationKeywords: ["human", "manager"]
    });
    const closer = await createTeamMember({
      ...scope,
      type: "human",
      name: "Sales Manager",
      emailOrPhone: "sales@example.com",
      role: "manager",
      pipelineStages: ["qualified"],
      autoReplyEnabled: false
    });

    const inbound = await saveTwilioInboundMessage({
      ...scope,
      source: "twilio_simulator",
      messageSid: "SIMIN_CONTEXTUAL_AI",
      from: "whatsapp:+919000001111",
      to: "whatsapp:leadsy-simulator",
      profileName: "Rohan",
      body: "Hi, I’m Rohan from NovaFit. We need 12 SEO blogs and LinkedIn posts every month. Budget is around ₹80k monthly and I approve content spends. Want to start this month.",
      receivedAt: "2026-06-08T05:00:00.000Z"
    });

    const run = await runAgentForInboundLead({
      ...scope,
      leadId: inbound.lead.id,
      conversationId: inbound.conversation.id,
      triggerMessageId: inbound.saved[0].id,
      now: "2026-06-08T05:01:00.000Z"
    });

    assert.equal(openRouterCalls.length, 1, "qualification replies should call OpenRouter when AI settings enable remote AI");
    const callMessages = openRouterCalls[0].messages as Array<{ role: string; content: string }>;
    assert.doesNotMatch(callMessages[0].content, /inside Leadsy|Leadsy Qualification/i, "lead-facing AI prompt should not frame the agent as Leadsy");
    const promptedContext = JSON.parse(callMessages[1].content) as {
      workspace: { businessName?: string; services?: string[] };
      ownerBusiness?: { businessName?: string; services?: string[]; externalIdentity?: string };
    };
    assert.equal(promptedContext.ownerBusiness?.businessName, "XYZ Company");
    assert(promptedContext.ownerBusiness?.services?.some((service) => /SEO blogs/i.test(service)), "owner business context should include saved services");
    assert.doesNotMatch(JSON.stringify(promptedContext.ownerBusiness), /WhatsApp follow-up|Appointment booking|Lead qualification/i, "owner business context should strip platform placeholders");
    assert.equal(run.memberId, qualificationAgent.id);
    assert.match(run.replyBody ?? "", /NovaFit/i);
    assert.match(run.replyBody ?? "", /SEO blog|LinkedIn|content/i);
    assert.doesNotMatch(run.replyBody ?? "", /Leadsy|qualification|follow-up|assignment|bookings/i);
    assert.equal((run.replyBody?.match(/\?/g) ?? []).length <= 1, true, "AI reply should ask at most one question");

    const lead = (await listLeadKnowledgeRecords(scope)).find((record) => record.id === inbound.lead.id);
    assert.equal(lead?.qualificationFields.company, "NovaFit");
    assert.match(lead?.qualificationFields.budget ?? "", /80k/i);
    assert.match(lead?.qualificationFields.authority ?? "", /approve|Rohan/i);
    assert(lead?.facts.some((fact) => /Rohan from NovaFit/i.test(fact)), "AI should write a CRM note into lead knowledge");

    const receipt = await getCostReceipt(scope);
    assert.equal(receipt.summary.openrouter.requests, 1);
    assert.equal(receipt.summary.openrouter.totalTokens, 320);
    assert(receipt.lineItems.some((item) => item.category === "openrouter" && /Qualification/i.test(item.label)));

    assert.equal(closer.name, "Sales Manager");

    const fallbackScope = { tenantId: "tenant_owner_fallback", ownerId: "owner_owner_fallback" };
    await updateWorkspaceBusinessSettings({
      ...fallbackScope,
      businessName: "XYZ Company",
      industry: "Content marketing",
      services: ["SEO blogs", "LinkedIn ghostwriting", "Content calendars"],
      qualificationFields: ["company", "need", "budget", "timeline", "authority"]
    });
    await updateOperatorProfileSettings({
      ...fallbackScope,
      communicationStyle: "Warm and direct",
      knowledgeBase: "XYZ Company helps founders turn expertise into SEO blogs, LinkedIn posts, and monthly content calendars."
    });
    await updateAiWorkspaceSettings({
      ...fallbackScope,
      providerMode: "deterministic",
      remoteAiEnabled: false
    });
    await createTeamMember({
      ...fallbackScope,
      type: "ai_agent_full",
      name: "Qualification AI",
      role: "agent",
      pipelineStages: ["new", "collecting"],
      behaviorInstructions: "Represent XYZ Company and answer service questions directly.",
      autoReplyEnabled: true
    });
    const serviceQuestion = await saveTwilioInboundMessage({
      ...fallbackScope,
      source: "twilio_simulator",
      messageSid: "SIMIN_OWNER_SERVICES",
      from: "whatsapp:+919000002222",
      to: "whatsapp:leadsy-simulator",
      profileName: "Devika",
      body: "what are your services?",
      receivedAt: "2026-06-08T06:00:00.000Z"
    });
    const fallbackRun = await runAgentForInboundLead({
      ...fallbackScope,
      leadId: serviceQuestion.lead.id,
      conversationId: serviceQuestion.conversation.id,
      triggerMessageId: serviceQuestion.saved[0].id,
      now: "2026-06-08T06:01:00.000Z"
    });
    assert.equal(fallbackRun.action, "auto_replied");
    assert.match(fallbackRun.replyBody ?? "", /XYZ Company|SEO blogs|LinkedIn ghostwriting|Content calendars/i);
    assert.doesNotMatch(fallbackRun.replyBody ?? "", /Leadsy|Qualification AI|WhatsApp follow-up|Appointment booking|qualification|assignment|bookings/i);
    assert(((fallbackRun.replyBody ?? "").match(/\?/g) ?? []).length <= 1, "fallback service reply should ask at most one question");
  } finally {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
