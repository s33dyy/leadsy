import { ApprovalsConsole, type ApprovalConsoleItem } from "@/components/approvals-console";
import { getCurrentSession } from "@/lib/auth";
import { listCrmFollowUpTasks, type CrmFollowUpTask } from "@/lib/crm-store";
import { listLeadKnowledgeRecords, type LeadKnowledgeRecord } from "@/lib/lead-knowledge-store";

export const dynamic = "force-dynamic";

function relativeTime(value?: string) {
  if (!value) return "now";
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs) || diffMs < 0) return "now";
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function leadName(lead: LeadKnowledgeRecord) {
  return lead.contact.displayName || lead.contact.handle || lead.contact.phone || lead.contact.email || "Unknown lead";
}

function leadApproval(lead: LeadKnowledgeRecord): ApprovalConsoleItem {
  const name = leadName(lead);
  return {
    id: lead.id,
    kind: "Research",
    priority: lead.crmStatus === "human_review" ? "P1" : "P2",
    subject: `${name} qualification review`,
    preview: lead.summary || lead.lastMessagePreview || "Lead intelligence needs a human decision before automation continues.",
    worker: "qualifier-v3",
    leadName: name,
    createdAt: relativeTime(lead.updatedAt),
    href: `/app/leads?contact=${lead.id}`
  };
}

function taskApproval(task: CrmFollowUpTask, lead?: LeadKnowledgeRecord): ApprovalConsoleItem {
  return {
    id: task.id,
    kind: "Task",
    priority: task.priority === "urgent" ? "P0" : task.priority === "high" ? "P1" : "P2",
    subject: task.topic,
    preview: task.description || "AI-routed task is waiting for operator review.",
    worker: task.assigneeName || "AI agent",
    leadName: lead ? leadName(lead) : "Lead",
    createdAt: relativeTime(task.createdAt),
    href: `/app/leads?contact=${task.leadId}&tab=tasks`
  };
}

export default async function ApprovalsPage() {
  const session = await getCurrentSession();
  const scope = session ? { tenantId: session.tenantId, ownerId: session.id } : undefined;
  const [leads, aiTasks] = scope
    ? await Promise.all([
        listLeadKnowledgeRecords(scope),
        listCrmFollowUpTasks(scope, { includeClosed: false, destination: "ai_approvals" })
      ])
    : [[], []];

  const reviewLeads = leads.filter((lead) => lead.crmStatus === "human_review").slice(0, 6);
  const approvals = [
    ...aiTasks.map((task) => taskApproval(task, leads.find((lead) => lead.id === task.leadId))),
    ...reviewLeads.map(leadApproval)
  ];
  return <ApprovalsConsole approvals={approvals} />;
}
