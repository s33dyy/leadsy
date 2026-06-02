import type { OverlayState } from "../core/types";

export interface OverlayHandlers {
  onArm(): void;
  onPause(): void;
  onResume(): void;
  onApprove(): void;
  onReject(): void;
  onClearLogs(): void;
}

export interface OverlayController {
  mount(parent: HTMLElement): void;
  setState(state: OverlayState): void;
  destroy(): void;
}

export function createOverlay(handlers: OverlayHandlers): OverlayController {
  const host = document.createElement("aside");
  host.setAttribute("data-leadsy-overlay-host", "true");
  const shadow = host.attachShadow({ mode: "open" });
  let state: OverlayState = {
    mode: "unarmed",
    statusText: "Not armed"
  };

  const render = () => {
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .panel {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 2147483647;
          width: min(340px, calc(100vw - 36px));
          box-sizing: border-box;
          border: 1px solid rgba(20, 31, 43, 0.18);
          border-radius: 8px;
          background: #ffffff;
          color: #17202a;
          box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
          line-height: 1.35;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          background: #0f172a;
          color: #ffffff;
        }
        .title {
          font-weight: 700;
          letter-spacing: 0;
        }
        .mode {
          border-radius: 999px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.14);
          font-size: 11px;
          text-transform: uppercase;
        }
        .body {
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .status {
          color: #334155;
          overflow-wrap: anywhere;
        }
        .reply {
          padding: 10px;
          border: 1px solid #d6dee8;
          border-radius: 6px;
          background: #f8fafc;
          color: #0f172a;
          max-height: 160px;
          overflow: auto;
          white-space: pre-wrap;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        button {
          appearance: none;
          border: 1px solid #b8c2d1;
          border-radius: 6px;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
          font: inherit;
          min-height: 32px;
          padding: 6px 10px;
        }
        button.primary {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
        }
        button.danger {
          border-color: #d43f3a;
          color: #b42318;
        }
        button:disabled {
          cursor: default;
          opacity: 0.52;
        }
      </style>
      <section class="panel" aria-label="Leadsy auto responder controls">
        <div class="header">
          <div class="title">Leadsy Auto Responder</div>
          <div class="mode">${escapeHtml(labelForMode(state.mode))}</div>
        </div>
        <div class="body">
          <div class="status">${escapeHtml(state.statusText)}</div>
          ${state.pendingReply ? `<div class="reply">${escapeHtml(state.pendingReply)}</div>` : ""}
          ${state.lastReason ? `<div class="status">${escapeHtml(state.lastReason)}</div>` : ""}
          <div class="actions">
            ${state.mode === "unarmed" || state.mode === "error" ? `<button class="primary" data-action="arm">Arm chat</button>` : ""}
            ${state.mode === "needs_approval" ? `<button class="primary" data-action="approve">Approve</button><button data-action="reject">Reject</button>` : ""}
            ${state.mode === "auto_active" ? `<button data-action="pause">Pause</button>` : ""}
            ${state.mode === "paused" ? `<button class="primary" data-action="resume">Resume</button>` : ""}
            <button class="danger" data-action="clear">Clear logs</button>
          </div>
        </div>
      </section>
    `;
  };

  shadow.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    switch (target.getAttribute("data-action")) {
      case "arm":
        handlers.onArm();
        break;
      case "pause":
        handlers.onPause();
        break;
      case "resume":
        handlers.onResume();
        break;
      case "approve":
        handlers.onApprove();
        break;
      case "reject":
        handlers.onReject();
        break;
      case "clear":
        handlers.onClearLogs();
        break;
    }
  });

  render();

  return {
    mount(parent: HTMLElement) {
      if (!host.isConnected) {
        parent.append(host);
      }
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

function labelForMode(mode: OverlayState["mode"]): string {
  return mode.replace("_", " ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
