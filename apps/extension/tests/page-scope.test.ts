import { describe, expect, it } from "vitest";
import { shouldArmOnPage } from "../src/content/page-scope";

describe("shouldArmOnPage", () => {
  it("does not arm the worker on the Leadsy app URL", () => {
    expect(shouldArmOnPage(new URL("http://localhost:3000/"), { leadsyBaseUrl: "http://localhost:3000" })).toBe(false);
    expect(shouldArmOnPage(new URL("http://localhost:3000/app/extension"), { leadsyBaseUrl: "http://localhost:3000" })).toBe(false);
  });

  it("arms the worker on supported chat URLs", () => {
    expect(shouldArmOnPage(new URL("https://web.whatsapp.com/"), { leadsyBaseUrl: "http://localhost:3000" })).toBe(true);
    expect(shouldArmOnPage(new URL("https://www.instagram.com/direct/inbox/"), { leadsyBaseUrl: "http://localhost:3000" })).toBe(true);
    expect(shouldArmOnPage(new URL("https://www.facebook.com/messages/t/123"), { leadsyBaseUrl: "http://localhost:3000" })).toBe(true);
  });

  it("stays quiet on unrelated web pages", () => {
    expect(shouldArmOnPage(new URL("https://example.com/"), { leadsyBaseUrl: "http://localhost:3000" })).toBe(false);
  });
});
