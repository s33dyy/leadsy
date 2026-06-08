import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const planPath = resolve(root, "ad-plan.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(existsSync(planPath), "Missing ad-plan.json");

const plan = JSON.parse(readFileSync(planPath, "utf8"));

assert(plan.title === "Leadsy Product Spoiler", "Unexpected ad title");
assert(plan.fps === 30, "Ad must render at 30fps");
assert(plan.width === 1920 && plan.height === 1080, "Ad must render at 1920x1080");
assert(plan.durationFrames >= 540 && plan.durationFrames <= 780, "Ad should stay between 18s and 26s");
assert(Array.isArray(plan.voiceover) && plan.voiceover.length === 4, "Expected four voiceover phrases");

const expectedLines = ["Leadsy.", "Click it.", "Forget it.", "Get your number today."];
for (const [index, line] of expectedLines.entries()) {
  const phrase = plan.voiceover[index];
  assert(phrase.text === line, `Voiceover phrase ${index + 1} must be "${line}"`);
  assert(Number.isInteger(phrase.fromFrame), `Voiceover phrase ${index + 1} is missing fromFrame`);
  assert(Number.isInteger(phrase.durationFrames), `Voiceover phrase ${index + 1} is missing durationFrames`);
  assert(phrase.durationFrames >= 18, `Voiceover phrase ${index + 1} is too short`);
  assert(existsSync(resolve(root, phrase.audio)), `Missing voiceover file: ${phrase.audio}`);
}

assert(Array.isArray(plan.scenes) && plan.scenes.length >= 7, "Expected at least seven product scenes");
for (const scene of plan.scenes) {
  assert(scene.id && scene.title, "Every scene needs an id and title");
  assert(Number.isInteger(scene.fromFrame), `${scene.id} is missing fromFrame`);
  assert(Number.isInteger(scene.durationFrames), `${scene.id} is missing durationFrames`);
  assert(scene.durationFrames > 0, `${scene.id} must have a positive duration`);
  if (scene.screenshot) {
    assert(existsSync(resolve(root, scene.screenshot)), `Missing screenshot: ${scene.screenshot}`);
  }
}

const ordered = [...plan.scenes].sort((left, right) => left.fromFrame - right.fromFrame);
for (let index = 1; index < ordered.length; index += 1) {
  const previous = ordered[index - 1];
  const current = ordered[index];
  assert(
    current.fromFrame >= previous.fromFrame + previous.durationFrames - 30,
    `${current.id} overlaps ${previous.id} too aggressively`
  );
}

console.log("Product spoiler video plan is valid.");
