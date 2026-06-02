import { describe, expect, it, vi } from "vitest";
import { createStatusChip } from "../src/content/status-chip";

describe("createStatusChip", () => {
  it("mounts a tiny non-blocking chip instead of a large sticky control panel", () => {
    const chip = createStatusChip({
      onOpenPanel: vi.fn(),
      onPause: vi.fn()
    });

    chip.mount(document.body);
    chip.setState({
      mode: "auto_active",
      statusText: "Leadsy worker active"
    });

    const host = document.querySelector<HTMLElement>("[data-leadsy-status-chip]");
    const panel = host?.shadowRoot?.querySelector<HTMLElement>(".chip");

    expect(host).not.toBeNull();
    expect(panel?.textContent).toContain("Leadsy");
    expect(panel?.style.position).toBe("fixed");
    expect(panel?.style.width).toBe("");
    expect(host?.shadowRoot?.textContent).not.toContain("Clear logs");
    expect(host?.shadowRoot?.textContent).not.toContain("Approve first reply");
  });
});
