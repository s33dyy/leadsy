import { defaultConnectionSettings, type LeadsyConnectionSettings } from "../core/connection-settings";
import { taskActionLabel, taskContactLabel, type ExtensionTask } from "../core/tasks";

type RuntimeResponse<T> = { ok: true; value: T } | { ok: false; error: string };
type FilterKey = "ready" | "preparing" | "approval" | "blocked" | "done";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Side panel root was not found.");
}

const filters: Array<{ key: FilterKey; label: string; statuses: ExtensionTask["status"][] }> = [
  { key: "ready", label: "Ready", statuses: ["queued"] },
  { key: "preparing", label: "Preparing", statuses: ["in_progress"] },
  { key: "approval", label: "Waiting on Leadsy", statuses: ["awaiting_send_approval"] },
  { key: "blocked", label: "Blocked", statuses: ["blocked", "failed"] },
  { key: "done", label: "Done", statuses: ["sent", "monitoring", "cancelled"] }
];

let currentTasks: ExtensionTask[] = [];
let activeFilter: FilterKey = "ready";
let selectedTaskId = "";

app.innerHTML = `
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #080a0c;
      color: #eef4f8;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell { display: grid; gap: 10px; min-width: 0; padding: 10px; }
    .topbar {
      align-items: center;
      border-bottom: 1px solid #27313a;
      display: flex;
      gap: 10px;
      justify-content: space-between;
      padding-bottom: 10px;
    }
    h1 { font-size: 16px; line-height: 1.2; margin: 0; }
    p { color: #aab5bf; font-size: 12px; line-height: 1.45; margin: 0; }
    .muted { color: #87939f; }
    .status { color: #aab5bf; font-size: 12px; line-height: 1.4; min-height: 18px; }
    .ok { color: #a6ffcf; }
    .error { color: #ff8da0; }
    .grid { display: grid; gap: 9px; }
    .panel {
      background: rgba(255,255,255,0.035);
      border: 1px solid #27313a;
      border-radius: 8px;
      padding: 10px;
    }
    .metrics {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .metric {
      background: rgba(255,255,255,0.035);
      border: 1px solid #27313a;
      border-radius: 7px;
      padding: 8px;
    }
    .metric strong { display: block; font-size: 17px; line-height: 1; }
    .metric span { color: #87939f; display: block; font-size: 10px; margin-top: 4px; }
    .tabs { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 2px; }
    button, a.button {
      align-items: center;
      background: rgba(32,230,190,0.12);
      border: 1px solid rgba(32,230,190,0.34);
      border-radius: 6px;
      color: #ddfff8;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-size: 12px;
      justify-content: center;
      min-height: 32px;
      padding: 7px 9px;
      text-decoration: none;
      white-space: nowrap;
    }
    button.secondary, a.secondary { background: rgba(255,255,255,0.04); border-color: #34414d; color: #dce6ef; }
    button.tab { color: #b8c3cd; min-height: 30px; }
    button.tab.active { background: rgba(32,230,190,0.16); border-color: rgba(32,230,190,0.44); color: #effffb; }
    button:disabled { cursor: not-allowed; opacity: 0.55; }
    .task-list { display: grid; gap: 6px; max-height: 46vh; min-height: 96px; overflow: auto; padding-right: 2px; }
    .task-row {
      align-items: center;
      background: rgba(255,255,255,0.03);
      border: 1px solid #27313a;
      border-radius: 7px;
      cursor: pointer;
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 54px;
      padding: 8px 9px;
      text-align: left;
      width: 100%;
      white-space: normal;
    }
    .task-row:hover { background: rgba(255,255,255,0.055); }
    .task-row.selected { background: rgba(32,230,190,0.08); border-color: rgba(32,230,190,0.58); }
    .task-main { display: grid; gap: 4px; min-width: 0; }
    .task-head { align-items: flex-start; display: flex; gap: 8px; justify-content: space-between; min-width: 0; }
    .title { color: #fff; font-size: 12.5px; font-weight: 750; line-height: 1.2; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { color: #87939f; font-size: 9px; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
    .pill {
      border: 1px solid #34414d;
      border-radius: 999px;
      color: #b6c0ca;
      flex: 0 0 auto;
      font-size: 10px;
      padding: 3px 7px;
      text-transform: uppercase;
    }
    .pill.queued, .pill.in_progress { border-color: rgba(32,230,190,0.35); color: #d8fff6; }
    .pill.awaiting_send_approval { border-color: rgba(255,190,80,0.45); color: #ffe1a6; }
    .pill.blocked, .pill.failed { border-color: rgba(255,120,140,0.45); color: #ffc2cb; }
    .detail { display: grid; gap: 8px; }
    .detail h2 { font-size: 14px; line-height: 1.25; margin: 0; }
    .draft {
      background: rgba(0,0,0,0.22);
      border: 1px solid #27313a;
      border-radius: 7px;
      color: #f2f8fc;
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
      max-height: 150px;
      overflow: auto;
      padding: 9px;
      white-space: pre-wrap;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 7px; }
    label { color: #87939f; display: grid; font-size: 10px; gap: 5px; text-transform: uppercase; }
    input {
      background: rgba(255,255,255,0.04);
      border: 1px solid #27313a;
      border-radius: 6px;
      color: #fff;
      font: inherit;
      min-height: 34px;
      outline: none;
      padding: 7px 8px;
      text-transform: none;
      width: 100%;
    }
    .row { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
    .toggle { align-items: center; display: flex; gap: 8px; text-transform: none; }
    .settings summary {
      color: #dce6ef;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      list-style: none;
    }
    .settings summary::-webkit-details-marker { display: none; }
    .settings summary::after {
      color: #87939f;
      content: "Open";
      float: right;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .settings[open] summary::after { content: "Close"; }
    .settings-grid { display: grid; gap: 9px; margin-top: 10px; }
  </style>
  <section class="shell">
    <div class="topbar">
      <div>
        <h1>Leadsy Worker</h1>
        <p>Queue, prepare, approve send, report.</p>
      </div>
      <button class="secondary" id="refresh-tasks" type="button">Refresh</button>
    </div>

    <section class="metrics" id="metrics"></section>
    <div class="status" id="status"></div>

    <section class="panel grid">
      <div class="tabs" id="filters"></div>
      <div class="task-list" id="task-list">Connect Leadsy to load worker tasks.</div>
    </section>

    <section class="panel detail" id="task-detail">
      <p>Select a task to inspect the draft, target, and worker action.</p>
    </section>

    <details class="panel settings" id="settings-panel">
      <summary>Connection settings</summary>
      <form class="settings-grid" id="settings-form">
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
          Use OpenRouter fallback if Leadsy is offline
        </label>
        <div class="row">
          <button type="submit">Save</button>
          <button class="secondary" id="check" type="button">Check</button>
        </div>
        <a class="button secondary" href="http://localhost:3000/app/extension" target="_blank" rel="noreferrer">Open Leadsy</a>
      </form>
    </details>
  </section>
`;

const form = app.querySelector<HTMLFormElement>("#settings-form")!;
const baseUrlInput = app.querySelector<HTMLInputElement>("#base-url")!;
const tokenInput = app.querySelector<HTMLInputElement>("#token")!;
const fallbackInput = app.querySelector<HTMLInputElement>("#fallback")!;
const status = app.querySelector<HTMLElement>("#status")!;
const checkButton = app.querySelector<HTMLButtonElement>("#check")!;
const taskList = app.querySelector<HTMLElement>("#task-list")!;
const taskDetail = app.querySelector<HTMLElement>("#task-detail")!;
const refreshTasksButton = app.querySelector<HTMLButtonElement>("#refresh-tasks")!;
const metrics = app.querySelector<HTMLElement>("#metrics")!;
const filtersContainer = app.querySelector<HTMLElement>("#filters")!;

void load();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

checkButton.addEventListener("click", () => {
  void checkConnection();
});

refreshTasksButton.addEventListener("click", () => {
  void refreshTasks();
});

async function load() {
  const settings = await send<LeadsyConnectionSettings>({ type: "leadsy:getSettings" });
  baseUrlInput.value = settings.baseUrl || defaultConnectionSettings.baseUrl;
  tokenInput.value = settings.token;
  fallbackInput.checked = settings.fallbackEnabled;
  renderFilters();
  renderTasks([]);
  if (settings.token) {
    await refreshTasks();
  }
}

async function save() {
  const settings: LeadsyConnectionSettings = {
    baseUrl: baseUrlInput.value,
    token: tokenInput.value,
    fallbackEnabled: fallbackInput.checked
  };
  await send<LeadsyConnectionSettings>({ type: "leadsy:saveSettings", settings });
  setStatus("Saved. Refresh tasks to pull the latest queue.", "ok");
}

async function checkConnection() {
  try {
    await save();
    const context = await send<{ leadCount: number; conversationCount: number; tokenLabel: string }>({ type: "leadsy:getContext" });
    setStatus(`Connected as ${context.tokenLabel}. ${context.leadCount} leads, ${context.conversationCount} conversations.`, "ok");
    await refreshTasks();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not connect to Leadsy.", "error");
  }
}

async function refreshTasks() {
  try {
    const tasks = await send<ExtensionTask[]>({ type: "leadsy:getTasks" });
    currentTasks = tasks;
    if (!selectedTaskId || !tasks.some((task) => task.id === selectedTaskId)) {
      selectedTaskId = tasks[0]?.id || "";
    }
    renderTasks(tasks);
    setStatus(`Loaded ${tasks.length} worker tasks.`, "ok");
  } catch (error) {
    taskList.textContent = error instanceof Error ? error.message : "Could not load tasks.";
    setStatus("Task refresh failed.", "error");
  }
}

function renderFilters() {
  filtersContainer.innerHTML = filters
    .map((filter) => `<button class="tab ${filter.key === activeFilter ? "active" : ""}" type="button" data-filter="${filter.key}">${filter.label}</button>`)
    .join("");
  for (const button of Array.from(filtersContainer.querySelectorAll<HTMLButtonElement>("[data-filter]"))) {
    button.addEventListener("click", () => {
      activeFilter = (button.dataset.filter as FilterKey) || "ready";
      renderFilters();
      renderTasks(currentTasks);
    });
  }
}

function renderTasks(tasks: ExtensionTask[]) {
  renderMetrics(tasks);
  const filter = filters.find((item) => item.key === activeFilter) || filters[0];
  const visibleTasks = tasks.filter((task) => filter.statuses.includes(task.status));
  if (!visibleTasks.length) {
    taskList.textContent = tasks.length ? "No tasks in this lane." : "No worker tasks yet.";
    renderDetail(tasks.find((task) => task.id === selectedTaskId));
    return;
  }

  if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
    selectedTaskId = visibleTasks[0].id;
  }
  taskList.innerHTML = visibleTasks.map(renderTaskRow).join("");
  for (const row of Array.from(taskList.querySelectorAll<HTMLButtonElement>("[data-task-select]"))) {
    row.addEventListener("click", () => {
      selectedTaskId = row.dataset.taskSelect || selectedTaskId;
      renderTasks(currentTasks);
    });
  }
  renderDetail(tasks.find((task) => task.id === selectedTaskId));
}

function renderMetrics(tasks: ExtensionTask[]) {
  const ready = countStatuses(tasks, ["queued"]);
  const approval = countStatuses(tasks, ["awaiting_send_approval"]);
  const blocked = countStatuses(tasks, ["blocked", "failed"]);
  metrics.innerHTML = `
    <div class="metric"><strong>${ready}</strong><span>Ready</span></div>
    <div class="metric"><strong>${approval}</strong><span>App approval</span></div>
    <div class="metric"><strong>${blocked}</strong><span>Blocked</span></div>
  `;
}

function renderTaskRow(task: ExtensionTask) {
  const selectedClass = task.id === selectedTaskId ? " selected" : "";
  return `
    <button class="task-row${selectedClass}" type="button" data-task-select="${escapeHtml(task.id)}">
      <span class="task-main">
        <span class="title">${escapeHtml(taskContactLabel(task))}</span>
        <span class="meta">${escapeHtml(taskActionLabel(task))} - ${escapeHtml(task.platform.replace(/-/g, " "))} - ${escapeHtml(task.priority)}</span>
      </span>
      <span class="pill ${escapeHtml(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
    </button>
  `;
}

function renderDetail(task?: ExtensionTask) {
  if (!task) {
    taskDetail.innerHTML = `<p>Select a task to inspect the draft, target, and worker action.</p>`;
    return;
  }

  taskDetail.innerHTML = `
    <div class="task-head">
      <h2>${escapeHtml(taskContactLabel(task))}</h2>
      <span class="pill ${escapeHtml(task.status)}">${escapeHtml(statusLabel(task.status))}</span>
    </div>
    <p class="meta">${escapeHtml(taskActionLabel(task))} - ${escapeHtml(task.platform.replace(/-/g, " "))}</p>
    <p>${escapeHtml(task.contextSummary)}</p>
    <p class="draft">${escapeHtml(task.draftMessage)}</p>
    ${task.targetUrl ? `<p class="muted">${escapeHtml(task.targetUrl)}</p>` : `<p class="muted">No target URL. This will be blocked when run.</p>`}
    ${task.resultSummary ? `<p class="muted">${escapeHtml(task.resultSummary)}</p>` : ""}
    <div class="actions">${renderActions(task)}</div>
  `;

  taskDetail.querySelector<HTMLButtonElement>("[data-task-open]")?.addEventListener("click", () => {
    void openTask(task.id);
  });
}

function renderActions(task: ExtensionTask) {
  if (task.status === "queued" || task.status === "in_progress") {
    return `<button type="button" data-task-open="${escapeHtml(task.id)}">${task.status === "queued" ? "Run task" : "Reopen task"}</button>`;
  }
  if (task.status === "awaiting_send_approval") {
    return `<button class="secondary" type="button" disabled>Waiting for Leadsy app</button>`;
  }
  if (task.status === "blocked" || task.status === "failed") {
    return `<button class="secondary" type="button" disabled>${escapeHtml(task.blockedReason || task.status)}</button>`;
  }
  return `<button class="secondary" type="button" disabled>${escapeHtml(statusLabel(task.status))}</button>`;
}

async function openTask(taskId: string) {
  if (!taskId) return;
  try {
    const task = await send<ExtensionTask>({ type: "leadsy:openTask", taskId });
    setStatus(`Opened ${taskContactLabel(task)}. Prepare the draft in the chat tab.`, "ok");
    await refreshTasks();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not open task.", "error");
    await refreshTasks();
  }
}

function countStatuses(tasks: ExtensionTask[], statuses: ExtensionTask["status"][]) {
  return tasks.filter((task) => statuses.includes(task.status)).length;
}

function statusLabel(statusValue: ExtensionTask["status"]) {
  return statusValue.replace(/_/g, " ");
}

function setStatus(message: string, tone: "ok" | "error") {
  status.textContent = message;
  status.className = `status ${tone}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function send<T>(message: Record<string, unknown>): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>;
  if (!response?.ok) {
    throw new Error(response?.error || "Leadsy worker did not respond.");
  }
  return response.value;
}
