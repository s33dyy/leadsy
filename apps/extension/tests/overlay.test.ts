import { describe, expect, it } from "vitest";
import { createOverlay } from "../src/content/overlay";

describe("createOverlay", () => {
  it("injects a shadow-dom control surface without page CSS dependencies", () => {
    const overlay = createOverlay({
      onArm: () => undefined,
      onPause: () => undefined,
      onResume: () => undefined,
      onApprove: () => undefined,
      onReject: () => undefined,
      onClearLogs: () => undefined
    });

    overlay.mount(document.body);
    overlay.setState({
      mode: "needs_approval",
      statusText: "Approve first reply",
      pendingReply: "Hello from Leadsy"
    });

    const host = document.querySelector("[data-leadsy-overlay-host]");

    expect(host).not.toBeNull();
    expect(host?.shadowRoot?.textContent).toContain("Approve first reply");
    expect(host?.shadowRoot?.textContent).toContain("Hello from Leadsy");
  });
});
