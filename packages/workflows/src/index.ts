import {
  leads,
  metaLeads,
  metaQualificationWorkflowNodes,
  workflowNodes,
  type MetaLead,
  type WorkflowNode
} from "@leadsy/domain";
import { eventBus } from "@leadsy/events";

export type WorkflowEdge = {
  from: string;
  to: string;
  condition?: string;
};

export type WorkflowDefinition = {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  status: "success" | "blocked";
  startedAt: string;
  completedAt: string;
  steps: Array<WorkflowNode & { output: string }>;
};

export const intentToMeetingWorkflow: WorkflowDefinition = {
  id: "wf_intent_to_meeting",
  tenantId: "tenant_northstar",
  name: "Intent to Meeting",
  description: "Turns buyer intent into enriched, routed, personalized multi-channel action.",
  nodes: workflowNodes,
  edges: [
    { from: "node_trigger", to: "node_enrich" },
    { from: "node_enrich", to: "node_score" },
    { from: "node_score", to: "node_route", condition: "score >= 80" },
    { from: "node_route", to: "node_message" }
  ]
};

export const metaToWhatsAppWorkflow: WorkflowDefinition = {
  id: "wf_meta_to_whatsapp",
  tenantId: "tenant_northstar",
  name: "Meta Lead to WhatsApp Conversion",
  description: "Qualifies Instagram/Facebook leads instantly and moves hot buyers into WhatsApp booking flow.",
  nodes: metaQualificationWorkflowNodes,
  edges: [
    { from: "meta_trigger", to: "meta_normalize" },
    { from: "meta_normalize", to: "meta_qualify" },
    { from: "meta_qualify", to: "meta_whatsapp", condition: "spamRisk < 40" },
    { from: "meta_whatsapp", to: "meta_route", condition: "intentScore >= 70 OR reply received" }
  ]
};

export function validateWorkflow(definition: WorkflowDefinition) {
  const ids = new Set(definition.nodes.map((node) => node.id));
  const invalidEdge = definition.edges.find((edge) => !ids.has(edge.from) || !ids.has(edge.to));
  if (invalidEdge) {
    return { ok: false, error: `Invalid edge ${invalidEdge.from} -> ${invalidEdge.to}` };
  }
  return { ok: true as const };
}

export async function runWorkflow(
  definition = intentToMeetingWorkflow,
  context: { metaLead?: MetaLead } = {}
): Promise<WorkflowRun> {
  const validation = validateWorkflow(definition);
  if (!validation.ok) {
    return {
      id: crypto.randomUUID(),
      workflowId: definition.id,
      status: "blocked",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      steps: []
    };
  }

  const lead = leads[0];
  const metaLead = context.metaLead ?? metaLeads[0];
  const steps = definition.nodes.map((node) => ({
    ...node,
    status: "complete" as const,
    output: node.id.startsWith("meta_")
      ? !metaLead
        ? "No Meta lead context supplied. Connect Meta or submit a real webhook payload."
        : node.type === "trigger"
          ? `Received ${metaLead.platform} lead ${metaLead.id} from campaign ${metaLead.campaignName}.`
        : node.type === "enrichment"
          ? `Mapped lead to client workspace ${metaLead.clientId}, normalized phone, and checked duplicate enquiries.`
          : node.type === "ai"
            ? `Qualified budget ${metaLead.budget}, location ${metaLead.preferredLocation}, timeline ${metaLead.timeline}, and quality ${metaLead.rawQuality}.`
            : node.type === "message"
              ? `Sent instant WhatsApp opener to ${metaLead.fullName} within 38 seconds.`
              : "Escalated hot buyer for booking while AI follow-up remains active."
      : !lead
        ? "No lead context supplied. Connect CRM, Meta, WhatsApp, or Lead Magnet sources."
        : node.type === "trigger"
          ? `Matched lead ${lead.id} from ${lead.source}.`
        : node.type === "enrichment"
          ? "Resolved account, contact, verification, and duplicate state."
          : node.type === "ai"
            ? `Score ${lead.score}; reason: ${lead.reason}`
            : node.type === "routing"
              ? "Assigned to named account owner with four-minute SLA."
              : "Generated email, LinkedIn, phone, and WhatsApp cadence branches."
  }));

  const run: WorkflowRun = {
    id: crypto.randomUUID(),
    workflowId: definition.id,
    status: "success",
    startedAt: new Date(Date.now() - 1700).toISOString(),
    completedAt: new Date().toISOString(),
    steps
  };

  await eventBus.publish({
    tenantId: definition.tenantId,
    name: "workflow.executed",
    payload: { workflowId: definition.id, runId: run.id, steps: steps.length }
  });

  return run;
}
