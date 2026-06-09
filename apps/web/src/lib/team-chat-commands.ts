import { assignLeadOwner } from "./crm-store";
import { listLeadKnowledgeRecords, type LeadKnowledgeRecord } from "./lead-knowledge-store";
import { listTeamMembers, type TeamMember } from "./teamspace-store";

type Scope = {
  tenantId: string;
  ownerId: string;
};

type AssignmentCommand = {
  leadQuery?: string;
  memberQuery: string;
};

export type TeamChatAssignmentCommandResult =
  | { action: "not_assignment" }
  | { action: "lead_required"; memberQuery: string }
  | { action: "lead_not_found"; leadQuery?: string; memberQuery: string }
  | { action: "member_not_found"; leadQuery?: string; memberQuery: string }
  | { action: "assigned"; lead: LeadKnowledgeRecord; member: TeamMember; leadQuery?: string; memberQuery: string };

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function cleanMentionValue(value: string) {
  return compact(value)
    .replace(/^@+/, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

export function looksLikeTeamChatAssignmentCommand(body: string) {
  return /^\s*(?:please\s+)?(?:assign|reassign)\b/i.test(body) && /\s(?:to|->)\s/i.test(body);
}

export function parseTeamChatAssignmentCommand(body: string, selectedLeadId?: string): AssignmentCommand | undefined {
  if (!looksLikeTeamChatAssignmentCommand(body)) return undefined;
  const cleanBody = compact(body);
  const match = /^(?:please\s+)?(?:assign|reassign)\s+(?:(.*?)\s+)?(?:to|->)\s+(.+)$/i.exec(cleanBody);
  if (!match) return undefined;

  const rawLeadQuery = cleanMentionValue(match[1] ?? "");
  const memberQuery = cleanMentionValue(match[2] ?? "");
  const leadQuery = rawLeadQuery && !/^(this\s+)?lead$/i.test(rawLeadQuery) ? rawLeadQuery : undefined;
  if (!memberQuery) return undefined;

  return {
    leadQuery: selectedLeadId ? undefined : leadQuery,
    memberQuery
  };
}

function searchableLeadText(lead: LeadKnowledgeRecord) {
  return [
    lead.id,
    lead.contact.displayName,
    lead.contact.phone,
    lead.contact.email,
    lead.contact.handle,
    lead.summary,
    lead.lastMessagePreview
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function searchableMemberText(member: TeamMember) {
  return [member.id, member.name, member.emailOrPhone, member.role, member.type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchLead(leads: LeadKnowledgeRecord[], query?: string, selectedLeadId?: string) {
  if (selectedLeadId) return leads.find((lead) => lead.id === selectedLeadId);
  const cleanQuery = cleanMentionValue(query ?? "").toLowerCase();
  if (!cleanQuery) return undefined;
  const exact = leads.find((lead) => {
    const names = [lead.id, lead.contact.displayName, lead.contact.phone, lead.contact.email]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return names.includes(cleanQuery);
  });
  if (exact) return exact;
  return leads.find((lead) => searchableLeadText(lead).includes(cleanQuery));
}

function matchMember(members: TeamMember[], query: string) {
  const cleanQuery = cleanMentionValue(query).toLowerCase();
  const activeMembers = members.filter((member) => member.status === "active");
  const exact = activeMembers.find((member) => {
    const names = [member.id, member.name, member.emailOrPhone]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return names.includes(cleanQuery);
  });
  if (exact) return exact;
  return activeMembers.find((member) => searchableMemberText(member).includes(cleanQuery));
}

export async function handleTeamChatAssignmentCommand(input: Scope & {
  body: string;
  leadId?: string;
  assignedById?: string;
  assignedByName?: string;
}): Promise<TeamChatAssignmentCommandResult> {
  const parsed = parseTeamChatAssignmentCommand(input.body, input.leadId);
  if (!parsed) return { action: "not_assignment" };

  const [leads, members] = await Promise.all([
    listLeadKnowledgeRecords(input),
    listTeamMembers(input)
  ]);
  const lead = matchLead(leads, parsed.leadQuery, input.leadId);
  if (!lead) {
    return parsed.leadQuery
      ? { action: "lead_not_found", leadQuery: parsed.leadQuery, memberQuery: parsed.memberQuery }
      : { action: "lead_required", memberQuery: parsed.memberQuery };
  }
  const member = matchMember(members, parsed.memberQuery);
  if (!member) return { action: "member_not_found", leadQuery: parsed.leadQuery, memberQuery: parsed.memberQuery };

  const updatedLead = await assignLeadOwner({
    tenantId: input.tenantId,
    ownerId: input.ownerId,
    leadId: lead.id,
    assigneeId: member.id,
    assigneeName: member.name,
    assignedById: input.assignedById,
    assignedByName: input.assignedByName,
    reason: `Assigned from Team Chat command: "${input.body.slice(0, 160)}"`
  });

  return {
    action: "assigned",
    lead: updatedLead,
    member,
    leadQuery: parsed.leadQuery,
    memberQuery: parsed.memberQuery
  };
}
