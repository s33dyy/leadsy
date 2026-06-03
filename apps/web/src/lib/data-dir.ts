import { isAbsolute, resolve } from "node:path";

function resolveDataDir() {
  const configured = process.env.LEADSY_DATA_DIR?.trim();
  const root = process.env.INIT_CWD?.trim() || process.cwd();
  if (!configured) return resolve(root, "data/app");
  return isAbsolute(configured) ? configured : resolve(root, configured);
}

export const leadsyDataDir = resolveDataDir();
