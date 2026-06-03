import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const content = readFileSync("apps/extension/src/content/index.ts", "utf8");
const sidepanel = readFileSync("apps/extension/src/sidepanel/index.ts", "utf8");
const background = readFileSync("apps/extension/src/background/index.ts", "utf8");

assert(content.includes("batchRunId"), "content worker should only execute active tasks that belong to an explicit batch run");
assert(content.includes("sendTaskWithoutApproval"), "selected batch tasks should send automatically after one deliberate Run selected action");
assert(!content.includes("if (activeTask && taskCanBeHandled(activeTask))"), "content worker should not auto-handle stored tasks on page boot");

assert(!sidepanel.includes("Approve send"), "extension side panel should not contain send approval controls");
assert(!sidepanel.includes("leadsy:approveTaskSend"), "extension side panel should not approve sends");
assert(sidepanel.includes("Run selected tasks"), "extension side panel should expose selected-task batch execution");
assert(sidepanel.includes("data-task-checkbox"), "extension side panel should render task checkboxes");
assert(sidepanel.includes("Select all visible"), "extension side panel should support selecting all visible tasks");
assert(sidepanel.includes("Clear selection"), "extension side panel should support clearing selected tasks");

assert(!background.includes("startTaskRunner"), "background worker should not start an automatic queued-task runner");
assert(!background.includes("runTaskQueueOnce"), "background worker should not auto-pick queued tasks on a timer");
assert(!background.includes("setInterval"), "background worker should not poll tasks on an interval");
assert(background.includes("leadsy:runSelectedTasks"), "background worker should expose an explicit selected batch command");
assert(background.includes("runSelectedTasks"), "background worker should run only selected task ids");
assert(!background.includes("type: \"leadsy:approveTaskSend\""), "extension runtime should not expose an approval command");

console.log("extension selected batch execution regression passed");
