import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("apps/web/src/components/extension-task-board.tsx", "utf8");

assert(!source.includes("xl:grid-cols-4"), "Operations task board must not squeeze five statuses into four grid columns.");
assert(source.includes("2xl:grid-cols-5"), "Operations task board should expose five stable columns on wide screens.");
assert(source.includes("min-w-0"), "Grid children and task rows must opt into shrinking inside CSS grid tracks.");
assert(source.includes("break-words"), "Task text must wrap long names, URLs, and draft snippets instead of widening columns.");
assert(source.includes("CompactEmptyState"), "Board columns should use a compact empty state, not large overlay-like empty cards.");
assert(source.includes("approvePreparedSend"), "Leadsy app task board should own prepared-send approval.");
assert(source.includes("/api/extension/tasks/"), "Leadsy app task board should call task APIs for approvals.");
assert(source.includes("Reject"), "Leadsy app task board should let users reject prepared sends.");

console.log("extension task board layout regression passed");
