import type { OverlayState } from "../core/types";

export interface StatusChipHandlers {
  onOpenPanel(): void;
  onPause(): void;
}

export interface StatusChipController {
  mount(parent: HTMLElement): void;
  setState(state: OverlayState): void;
  destroy(): void;
}

export function createStatusChip(handlers: StatusChipHandlers): StatusChipController {
  const host = document.createElement("aside");
  host.setAttribute("data-leadsy-status-chip", "true");
  const shadow = host.attachShadow({ mode: "open" });
  let state: OverlayState = {
    mode: "unarmed",
    statusText: "Leadsy worker idle"
  };

  function render() {
    shadow.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .chip {
        align-items: center;
        background: rgba(8, 13, 18, 0.92);
        border: 1px solid rgba(32, 230, 190, 0.35);
        border-radius: 999px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
        color: #d8fff6;
        display: inline-flex;
        font: 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        gap: 8px;
        max-width: min(260px, calc(100vw - 28px));
        padding: 7px 9px 7px 10px;
      }
      .dot {
        background: #20e6be;
        border-radius: 999px;
        flex: 0 0 auto;
        height: 7px;
        width: 7px;
      }
      .text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      button {
        appearance: none;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 999px;
        color: #ffffff;
        cursor: pointer;
        font: inherit;
        min-height: 22px;
        padding: 2px 7px;
      }
    `;
    const chip = document.createElement("section");
    chip.className = "chip";
    chip.setAttribute("aria-label", "Leadsy worker status");
    chip.style.position = "fixed";
    chip.style.right = "14px";
    chip.style.bottom = "14px";
    chip.style.zIndex = "2147483647";
    chip.innerHTML = `
      <span class="dot"></span>
      <span class="text">Leadsy: ${escapeHtml(labelForMode(state.mode))}</span>
      <button type="button" data-action="open">Open</button>
      ${state.mode === "auto_active" ? `<button type="button" data-action="pause">Pause</button>` : ""}
    `;
    shadow.append(style, chip);
  }

  shadow.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.getAttribute("data-action") === "open") handlers.onOpenPanel();
    if (target.getAttribute("data-action") === "pause") handlers.onPause();
  });

  render();

  return {
    mount(parent: HTMLElement) {
      if (!host.isConnected) parent.append(host);
    },
    setState(nextState: OverlayState) {
      state = nextState;
      render();
    },
    destroy() {
      host.remove();
    }
  };
}

function labelForMode(mode: OverlayState["mode"]) {
  return mode.replace("_", " ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
