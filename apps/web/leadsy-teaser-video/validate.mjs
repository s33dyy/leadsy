import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import plan from "./ad-plan.json" with { type: "json" };

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "..");
const requiredSceneFiles = [
  "src/Scene1.tsx",
  "src/Scene2.tsx",
  "src/Scene3.tsx",
  "src/LeadsyTeaser.tsx"
];

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const exists = (relativePath) => fs.existsSync(path.resolve(dir, relativePath));
const assetExists = (assetPath) => {
  const cleaned = assetPath.replace(/^(\.\.\/)?public\//, "");
  return fs.existsSync(path.resolve(webRoot, "public", cleaned));
};

assert(plan.width === 1920, "width must be 1920");
assert(plan.height === 1080, "height must be 1080");
assert(plan.fps === 30, "fps must be 30");
assert(plan.durationFrames === 150, "durationFrames must be 150");
assert(plan.durationSeconds === 5, "durationSeconds must be 5");
assert(plan.production.pipeline === "openmontage/cinematic", "OpenMontage cinematic pipeline must be recorded");
assert(plan.production.renderRuntime === "remotion", "renderRuntime must be remotion");
assert(plan.scenes.length === 3, "expected exactly three scenes");
assert(plan.scenes[0].fromFrame === 0 && plan.scenes[0].durationFrames === 60, "scene 1 must cover frames 0-59");
assert(plan.scenes[1].fromFrame === 60 && plan.scenes[1].durationFrames === 60, "scene 2 must cover frames 60-119");
assert(plan.scenes[2].fromFrame === 120 && plan.scenes[2].durationFrames === 30, "scene 3 must cover frames 120-149");
assert(plan.scenes[0].text === "CLICK IT.", "scene 1 text mismatch");
assert(plan.scenes[1].text === "FORGET IT.", "scene 2 text mismatch");
assert(plan.scenes[2].headline === "GET YOUR NUMBER TODAY", "scene 3 headline mismatch");

for (const file of requiredSceneFiles) {
  assert(exists(file), `${file} is required`);
}
for (const scene of plan.scenes) {
  if (scene.asset) assert(assetExists(scene.asset), `missing scene asset: ${scene.asset}`);
}
assert(assetExists(plan.audio.ambientPad), "missing ambient pad audio");
assert(assetExists(plan.audio.clickImpact), "missing click impact audio");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("Leadsy teaser plan is valid.");
