import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { join } from "node:path";
import type { OpenRouterUsageCost } from "@leadsy/domain";
import { leadsyDataDir } from "./data-dir";

type Scope = {
  tenantId: string;
  ownerId: string;
};

type AiUsageRun = {
  id: string;
  tenantId: string;
  ownerId: string;
  cost?: OpenRouterUsageCost;
  scenarioLabel?: string;
  runLabel?: string;
  ownerSummary?: string;
  recommendation?: string;
};

type AiUsageAgentRun = {
  id: string;
  tenantId: string;
  ownerId: string;
  agent: string;
  cost?: OpenRouterUsageCost;
  displayTitle?: string;
  displaySummary?: string;
  outputSummary?: string;
  inputSummary?: string;
};

type AiUsageState = {
  runs?: AiUsageRun[];
  agentRuns?: AiUsageAgentRun[];
};

const dataFile = join(leadsyDataDir, "ai-usage.json");

async function readState(): Promise<AiUsageState> {
  try {
    const raw = await readFile(dataFile, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as AiUsageState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return {};
    throw error;
  }
}

async function writeState(state: AiUsageState) {
  await mkdir(dirname(dataFile), { recursive: true });
  const tempFile = `${dataFile}.${crypto.randomUUID()}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`);
  await rename(tempFile, dataFile);
}

let usageMutationQueue = Promise.resolve();

async function mutateState<T>(updater: (state: AiUsageState) => Promise<{ result: T; state?: AiUsageState }> | { result: T; state?: AiUsageState }) {
  const operation = usageMutationQueue.then(async () => {
    const state = await readState();
    const next = await updater(state);
    if (next.state) await writeState(next.state);
    return next.result;
  });
  usageMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
}

function scopeMatches(scope: Scope, item: { tenantId: string; ownerId: string }) {
  return item.tenantId === scope.tenantId && item.ownerId === scope.ownerId;
}

function tenantMatches(tenantId: string, item: { tenantId: string }) {
  return item.tenantId === tenantId;
}

export async function listAiUsageRuns(scope: Scope) {
  const state = await readState();
  return {
    runs: (Array.isArray(state.runs) ? state.runs : []).filter((run) => scopeMatches(scope, run)),
    agentRuns: (Array.isArray(state.agentRuns) ? state.agentRuns : []).filter((run) => scopeMatches(scope, run))
  };
}

export async function listTenantAiUsageRuns(tenantId: string) {
  const state = await readState();
  return {
    runs: (Array.isArray(state.runs) ? state.runs : []).filter((run) => tenantMatches(tenantId, run)),
    agentRuns: (Array.isArray(state.agentRuns) ? state.agentRuns : []).filter((run) => tenantMatches(tenantId, run))
  };
}

export async function appendAiUsageAgentRun(input: AiUsageAgentRun) {
  return mutateState((state) => {
    const agentRuns = Array.isArray(state.agentRuns) ? state.agentRuns : [];
    const nextRuns = agentRuns.some((run) => run.id === input.id)
      ? agentRuns.map((run) => (run.id === input.id ? input : run))
      : [...agentRuns, input];
    return {
      result: input,
      state: {
        runs: Array.isArray(state.runs) ? state.runs : [],
        agentRuns: nextRuns
      }
    };
  });
}
