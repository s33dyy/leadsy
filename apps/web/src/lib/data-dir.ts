import { isAbsolute, resolve } from "node:path";

export function resolveDataDir(input: {
  configured?: string;
  initCwd?: string;
  cwd?: string;
  railwayEnvironment?: string;
} = {}) {
  const configured = input.configured?.trim() ?? process.env.LEADSY_DATA_DIR?.trim();
  const root = input.initCwd?.trim() || process.env.INIT_CWD?.trim() || input.cwd || process.cwd();
  const railwayEnvironment = input.railwayEnvironment ?? process.env.RAILWAY_ENVIRONMENT;
  if (!configured && railwayEnvironment) return "/data/leadsy";
  if (!configured) return resolve(root, "data/app");
  return isAbsolute(configured) ? configured : resolve(root, configured);
}

export const leadsyDataDir = resolveDataDir();
