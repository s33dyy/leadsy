import { describe, expect, it } from "vitest";
import { censorProfanity } from "../src/core/profanity";

describe("censorProfanity", () => {
  it("censors profanity-like words while keeping the sentence readable", () => {
    expect(censorProfanity("This is a fucking bad idea, shit happens.")).toBe(
      "This is a f***ing bad idea, s*** happens."
    );
  });
});
