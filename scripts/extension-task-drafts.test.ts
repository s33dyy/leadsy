import assert from "node:assert/strict";

import { draftExtensionTaskMessage } from "../apps/web/src/lib/extension-task-drafts";

const schoolLead = {
  contact: {
    displayName: "School for Skills: Allied Health Sciences (SFS Academies) - West Bengal Academy"
  },
  summary:
    "Paramedical / Allied Health Sciences Training Institute asked about admissions.",
  nextAction: "Follow up on student enquiry quality.",
  channels: ["whatsapp"]
};

const opener = draftExtensionTaskMessage(schoolLead as never, "initiate_conversation");

assert.equal(
  opener,
  "Hi School for Skills: Allied Health Sciences (SFS Academies) - West Bengal Academy, I help education teams turn more student enquiries into qualified admissions conversations. Would it make sense to discuss this this week?"
);

for (const forbidden of [
  "Offer a",
  "Run program",
  "lead campaign",
  "lead funnels",
  "targeting",
  "qualification questions",
  "high-intent prospects",
  "preferred district"
]) {
  assert.equal(opener.includes(forbidden), false, `opener should not leak internal search intent: ${forbidden}`);
}

const realEstateLead = {
  contact: {
    displayName: "Radhika Realty"
  },
  summary: "Real Estate Agency asked about WhatsApp lead automation.",
  nextAction: "Follow up on property enquiry quality.",
  channels: ["whatsapp"]
};

assert.equal(
  draftExtensionTaskMessage(realEstateLead as never, "follow_up"),
  "Hi Radhika Realty, just following up to see if improving property enquiry quality is worth a quick conversation this week?"
);
