# Assignment Engine

Leadsy ownership is the human accountability layer for the CRM workflow:

Lead Source -> Conversation -> Qualification -> Assignment -> Follow-Up -> Conversion

## Ownership Contract

Every lead supports an owner state:

- `Unassigned`: no assignee is attached to the lead.
- `Assigned`: `assigneeId` and `assigneeName` are attached to the lead record.

The lead knowledge store remains the source of truth for the current owner. The CRM store records assignment history so manager decisions and routing outcomes can be audited without turning system events into conversation messages.

## Assignment Methods

Manual Assignment:

- Managers or admins select a lead owner.
- Leadsy updates the lead owner fields.
- Leadsy writes an assignment history record with method `manual`.

Round Robin:

- Leadsy receives a candidate list of agents or teams.
- Leadsy counts current assigned lead workload for each candidate.
- The lowest-workload candidate is selected, with candidate order as the tie breaker.
- Leadsy writes an assignment history record with method `round_robin`.

Source-Based Routing:

- Leadsy evaluates assignment rules against the lead source, campaign, and optional CRM status.
- Example routes:
  - Meta Leads -> Sales Team
  - Website Leads -> SDR Team
  - Manual Leads -> Owner Selected
- Leadsy writes an assignment history record with method `source_based` and includes the matched rule metadata.

## Assignment History

Each assignment history record stores:

- Lead ID
- Method
- Previous owner
- New owner
- Matched rule, when applicable
- Assigned by, when supplied
- Reason, when supplied
- Timestamp

History records are CRM audit records. They are not messages, tasks, worker events, or system conversation entries.

## Task Delegation

Task delegation keeps humans accountable for follow-up work. Supported task types:

- Call
- WhatsApp Follow-Up
- Meeting
- Site Visit
- Review Lead
- Custom

Each task stores:

- Owner
- Due date
- Lead ID
- Priority
- Status
- Manager or agent notes

Admins and managers can assign leads and tasks, then review workload. Agents can update task status, complete tasks, and add notes. Leadsy does not perform autonomous outreach.
