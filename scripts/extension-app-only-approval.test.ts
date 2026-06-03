import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = readFileSync("apps/extension/src/content/index.ts", "utf8");
const sidepanel = readFileSync("apps/extension/src/sidepanel/index.ts", "utf8");
const background = readFileSync("apps/extension/src/background/index.ts", "utf8");

assert(content.includes("prepareTaskForApproval"), "content worker should prepare queued tasks instead of sending immediately");
assert(content.includes("sendApprovedAt"), "content worker should send only after Leadsy app approval is reflected on the task");
assert(!content.includes("controller.executeTask(task)"), "queued tasks should not execute/send immediately");

assert(!sidepanel.includes("Approve send"), "extension side panel should not contain send approval controls");
assert(!sidepanel.includes("leadsy:approveTaskSend"), "extension side panel should not approve sends");

assert(background.includes("runTaskQueueOnce"), "background worker should poll/rerun approved or queued tasks without extension-side human approval");
assert(!background.includes("type: \"leadsy:approveTaskSend\""), "extension runtime should not expose an approval command");

console.log("extension app-only approval regression passed");
