import { defaultConnectionSettings, type LeadsyConnectionSettings } from "../core/connection-settings";

type RuntimeResponse<T> = { ok: true; value: T } | { ok: false; error: string };

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Side panel root was not found.");
}

app.innerHTML = `
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #07090b;
      color: #eef4f8;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell { display: grid; gap: 14px; padding: 14px; }
    .header { border-bottom: 1px solid #26313b; padding-bottom: 12px; }
    h1 { font-size: 18px; line-height: 1.25; margin: 0; }
    p { color: #b6c0ca; font-size: 13px; line-height: 1.55; margin: 6px 0 0; }
    label { color: #87919e; display: grid; font-size: 11px; gap: 6px; letter-spacing: 0; text-transform: uppercase; }
    input {
      background: rgba(255,255,255,0.04);
      border: 1px solid #26313b;
      border-radius: 6px;
      color: #fff;
      font: inherit;
      min-height: 36px;
      outline: none;
      padding: 7px 9px;
      text-transform: none;
    }
    .row { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
    .card {
      background: rgba(255,255,255,0.035);
      border: 1px solid #26313b;
      border-radius: 8px;
      display: grid;
      gap: 12px;
      padding: 12px;
    }
    button, a.button {
      align-items: center;
      background: rgba(32,230,190,0.12);
      border: 1px solid rgba(32,230,190,0.32);
      border-radius: 6px;
      color: #d8fff6;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-size: 13px;
      justify-content: center;
      min-height: 34px;
      padding: 7px 10px;
      text-decoration: none;
    }
    button.secondary, a.secondary { background: rgba(255,255,255,0.04); border-color: #34414d; color: #dce6ef; }
    .status { color: #b6c0ca; font-size: 13px; line-height: 1.5; min-height: 20px; }
    .ok { color: #a6ff6a; }
    .error { color: #ff8da0; }
    .toggle { align-items: center; display: flex; gap: 8px; text-transform: none; }
  </style>
  <section class="shell">
    <div class="header">
      <h1>Leadsy Worker</h1>
      <p>Leadsy is the operation layer. This extension is the field worker that sends and reports conversations.</p>
    </div>
    <form class="card" id="settings-form">
      <label>
        Leadsy URL
        <input id="base-url" name="baseUrl" autocomplete="off" />
      </label>
      <label>
        Extension token
        <input id="token" name="token" autocomplete="off" type="password" />
      </label>
      <label class="toggle">
        <input id="fallback" name="fallback" type="checkbox" />
        Use local OpenRouter fallback when Leadsy is offline
      </label>
      <div class="row">
        <button type="submit">Save</button>
        <button class="secondary" id="check" type="button">Check</button>
      </div>
      <div class="status" id="status"></div>
    </form>
    <section class="card">
      <div>
        <strong>Current mode</strong>
        <p>Full-auto replies are allowed only when Leadsy returns a safe send decision. Pauses and errors are reported back to Leadsy.</p>
      </div>
      <a class="button secondary" href="http://localhost:3000/app/extension" target="_blank" rel="noreferrer">Open pairing page</a>
    </section>
  </section>
`;

const form = app.querySelector<HTMLFormElement>("#settings-form")!;
const baseUrlInput = app.querySelector<HTMLInputElement>("#base-url")!;
const tokenInput = app.querySelector<HTMLInputElement>("#token")!;
const fallbackInput = app.querySelector<HTMLInputElement>("#fallback")!;
const status = app.querySelector<HTMLElement>("#status")!;
const checkButton = app.querySelector<HTMLButtonElement>("#check")!;

void load();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

checkButton.addEventListener("click", () => {
  void checkConnection();
});

async function load() {
  const settings = await send<LeadsyConnectionSettings>({ type: "leadsy:getSettings" });
  baseUrlInput.value = settings.baseUrl || defaultConnectionSettings.baseUrl;
  tokenInput.value = settings.token;
  fallbackInput.checked = settings.fallbackEnabled;
}

async function save() {
  const settings: LeadsyConnectionSettings = {
    baseUrl: baseUrlInput.value,
    token: tokenInput.value,
    fallbackEnabled: fallbackInput.checked
  };
  await send<LeadsyConnectionSettings>({ type: "leadsy:saveSettings", settings });
  setStatus("Saved. Leadsy will be used first for replies.", "ok");
}

async function checkConnection() {
  try {
    await save();
    const context = await send<{ leadCount: number; conversationCount: number; tokenLabel: string }>({ type: "leadsy:getContext" });
    setStatus(`Connected as ${context.tokenLabel}. ${context.leadCount} leads, ${context.conversationCount} conversations.`, "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not connect to Leadsy.", "error");
  }
}

function setStatus(message: string, tone: "ok" | "error") {
  status.textContent = message;
  status.className = `status ${tone}`;
}

async function send<T>(message: Record<string, unknown>): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response?.ok) {
    throw new Error(response?.error || "Leadsy worker did not respond.");
  }
  return response.value;
}
