import assert from "node:assert/strict";

import { draftExtensionTaskMessage } from "../apps/web/src/lib/extension-task-drafts";

const schoolLead = {
  businessName: "School for Skills: Allied Health Sciences (SFS Academies) - West Bengal Academy",
  city: "Siliguri",
  category: "Paramedical / Allied Health Sciences Training Institute",
  outreachAngle:
    "Offer a West Bengal-focused student-lead campaign segmented by course (EMT/MLT/Dialysis/OT) with call-driven and form-driven leads, plus basic lead qualification and follow-up automation to reduce drop-offs.",
  nextAction:
    "Run program-specific lead funnels (B.Ed/D.El.Ed/Nursing) targeting North Bengal/Siliguri and wider West Bengal, with qualification questions (eligibility, budget, preferred district) to deliver high-intent prospects."
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
  businessName: "Radhika Realty",
  city: "Mumbai",
  category: "Real Estate Agency",
  outreachAngle: "Offer to optimize Mumbai event funnel: landing page CRO and targeted campaigns.",
  nextAction: "Find owner and pitch WhatsApp lead automation."
};

assert.equal(
  draftExtensionTaskMessage(realEstateLead as never, "follow_up"),
  "Hi Radhika Realty, just following up to see if improving property enquiry quality is worth a quick conversation this week?"
);
