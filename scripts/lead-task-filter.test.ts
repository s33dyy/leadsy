import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const leadsPage = readFileSync("apps/web/src/app/app/leads/page.tsx", "utf8");

assert(leadsPage.includes("listExtensionTasks"), "leads page should read extension tasks for the selected lead workspace");
assert(leadsPage.includes("listExtensionTaskEvents"), "leads page should read worker task events for selected lead tasks");
assert(leadsPage.includes("function tasksForLead"), "leads page should have an explicit selected-lead task filter");
assert(leadsPage.includes("task.leadId === lead.id"), "selected-lead task filter should match task leadId");
assert(leadsPage.includes("if (task.leadId) return task.leadId === lead.id;"), "task leadId should be authoritative before fallback identity matching");
assert(leadsPage.includes("taskMatchesLead"), "selected-lead task filter should use a reusable task identity matcher");
assert(leadsPage.includes("identityValuesForLead"), "selected-lead task filter should derive fallback identity keys from the lead");
assert(leadsPage.includes("identityValuesForTask"), "selected-lead task filter should derive fallback identity keys from the task");
assert(leadsPage.includes("backfillLeadIdsForTasks"), "leads page should reconcile task leadIds before rendering selected lead tasks");
assert(leadsPage.includes("SelectedLeadTasks"), "leads page should render selected lead tasks in the Tasks tab");
assert(!leadsPage.includes("ExtensionTaskBoard initialTasks={tasks}"), "leads page should not embed the global worker board");

console.log("lead task filter regression passed");
