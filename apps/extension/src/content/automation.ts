import { FallbackKnowledgeProvider } from "../core/knowledge";
import { getUnansweredIncomingTurn, mergeNewMessages, extractMessagesFromDocument } from "../core/messages";
import { OpenRouterClient } from "../core/openrouter";
import {
  collectDomSnapshot,
  createSiteFingerprint,
  detectLocalChatProfile,
  validateChatSiteProfile
} from "../core/profile";
import { applySafetyPolicy } from "../core/safety";
import { defaultAssistantSettings, getOpenRouterApiKey } from "../core/settings";
import { ConversationStore } from "../core/storage";
import type {
  AssistantSettings,
  ChatMessage,
  ChatSiteProfile,
  ConversationLog,
  DomSnapshot,
  KnowledgeContext,
  KnowledgeProvider,
  OverlayState,
  ResponderDecision,
  ConversationSyncEventType
} from "../core/types";
import type { ExtensionTask } from "../core/tasks";

export type StateListener = (state: OverlayState) => void;

export type TaskPreparationResult =
  | { status: "prepared"; draftMessage: string }
  | { status: "postponed"; reason: "target_not_on_whatsapp"; summary: string }
  | { status: "blocked"; reason: "composer_missing" | "send_button_missing"; summary: string };
type TaskStoppedResult = Extract<TaskPreparationResult, { status: "blocked" | "postponed" }>;
export type TaskExecutionResult = { status: "sent"; externalId: string; sentAt: string } | TaskStoppedResult;
type TaskComposerControls = {
  composer: HTMLElement;
  sendButton: HTMLElement;
};

export interface AutomationModelClient {
  detectProfile(snapshot: DomSnapshot, messages: ChatMessage[]): Promise<ChatSiteProfile>;
  decideReply(
    chat: ConversationLog,
    messages: ChatMessage[],
    knowledge: KnowledgeContext,
    settings: AssistantSettings
  ): Promise<ResponderDecision>;
  syncConversation?(input: {
    chat: ConversationLog;
    messages: ChatMessage[];
    event?: {
      type: ConversationSyncEventType;
      summary: string;
    };
  }): Promise<void>;
}

export interface ChatAutomationOptions {
  store?: ConversationStore;
  settings?: AssistantSettings;
  openRouter?: AutomationModelClient;
  knowledgeProvider?: KnowledgeProvider;
}

export class ChatAutomationController {
  private readonly store: ConversationStore;
  private readonly settings: AssistantSettings;
  private readonly openRouter: AutomationModelClient;
  private readonly knowledgeProvider: KnowledgeProvider;
  private observer?: MutationObserver;
  private profile?: ChatSiteProfile;
  private log?: ConversationLog;
  private pendingDecision?: ResponderDecision;
  private processTimer?: ReturnType<typeof setTimeout>;
  private mode: OverlayState["mode"] = "unarmed";

  constructor(
    private readonly emit: StateListener,
    options: ChatAutomationOptions = {}
  ) {
    this.store = options.store || new ConversationStore();
    this.settings = options.settings || defaultAssistantSettings;
    this.openRouter =
      options.openRouter ||
      new OpenRouterClient({
        apiKey: getOpenRouterApiKey(),
        modelId: this.settings.modelId,
        fallbackModelIds: this.settings.fallbackModelIds,
        temperature: this.settings.temperature,
        maxTokens: this.settings.maxTokens
      });
    this.knowledgeProvider =
      options.knowledgeProvider || new FallbackKnowledgeProvider(this.settings.fallbackBusinessPrompt);
  }

  async arm(): Promise<void> {
    this.setState({ mode: "detecting", statusText: "Detecting this chat page..." });

    try {
      const siteFingerprint = createSiteFingerprint(window.location);
      const storedProfile = await this.store.getProfile(siteFingerprint);
      const localProfile = detectLocalChatProfile(document, siteFingerprint);
      const profile = localProfile
        ? localProfile
        : storedProfile && validateChatSiteProfile(storedProfile, document, { requireSendButton: false }).valid
        ? storedProfile
        : await this.detectProfile(siteFingerprint);
      const validation = validateChatSiteProfile(profile, document, { requireSendButton: false });

      if (!validation.valid) {
        this.setState({
          mode: "paused",
          statusText: "Paused. Chat controls are not ready.",
          lastReason: validation.errors.join("; ")
        });
        return;
      }

      this.profile = { ...profile, validationStatus: "valid", updatedAt: Date.now() };
      await this.store.saveProfile(this.profile);
      this.log = await this.loadOrCreateLog(siteFingerprint, this.profile.id);
      this.startObserver();
      await this.processVisibleMessages();
      await this.syncToLeadsy("monitor_started", "Browser monitor armed and chat controls validated.");
      if (this.mode === "detecting") {
        this.setState({ mode: "auto_active", statusText: "Armed. Waiting for incoming messages." });
      }
    } catch (error) {
      this.setState({
        mode: "error",
        statusText: "Failed to arm this chat.",
        lastReason: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  pause(reason = "Paused by user."): void {
    this.stopObserver();
    if (this.log) {
      this.log.approvalState = "paused";
      void this.store.saveLog(this.log);
    }
    this.setState({ mode: "paused", statusText: "Paused.", lastReason: reason });
  }

  async resume(): Promise<void> {
    if (!this.profile || !this.log) {
      await this.arm();
      return;
    }
    this.startObserver();
    this.setState({ mode: "auto_active", statusText: "Resumed. Watching for incoming messages." });
  }

  async approvePending(): Promise<void> {
    if (!this.pendingDecision || !this.profile || !this.log) {
      return;
    }

    await this.sendReply(this.pendingDecision.replyText, this.profile);
    this.log.approvalState = "approved";
    this.pendingDecision = undefined;
    await this.store.saveLog(this.log);
    this.setState({ mode: "auto_active", statusText: "First reply approved. Auto mode is active." });
  }

  async sendApprovedTask(task: ExtensionTask): Promise<{ externalId: string; sentAt: string }> {
    return this.sendPreparedTask(task);
  }

  async sendTaskWithoutApproval(task: ExtensionTask): Promise<TaskExecutionResult> {
    return this.executeTask(task);
  }

  async executeTask(task: ExtensionTask): Promise<TaskExecutionResult> {
    const blocker = detectTaskBlocker(task);
    if (blocker) {
      this.setState({ mode: "paused", statusText: "Task blocked.", lastReason: blocker.summary });
      return blocker;
    }

    if (!taskCanBePrepared(task.status)) {
      throw new Error("Task is not ready for worker execution.");
    }

    if (this.profile && this.log) {
      await this.sendReply(task.draftMessage, this.profile);
      const sentAt = new Date().toISOString();
      const externalId = `task:${task.id}:${Date.now()}`;
      this.log.messages = [
        ...this.log.messages,
        {
          id: externalId,
          direction: "outgoing",
          text: task.draftMessage,
          timestamp: Date.parse(sentAt),
          sourceUrl: window.location.href
        }
      ];
      this.log.updatedAt = Date.now();
      await this.store.saveLog(this.log);
      await this.syncToLeadsy("reply-sent", `Worker sent task ${task.id}.`);
      this.setState({ mode: "auto_active", statusText: "Task sent. Watching for replies." });
      return { status: "sent", externalId, sentAt };
    }

    const controls = await findTaskComposerControls(task, this.profile, 30000);
    if (!controls.composer) {
      const result: TaskExecutionResult = {
        status: "blocked",
        reason: "composer_missing",
        summary: "Composer is not available on this chat page."
      };
      this.setState({ mode: "paused", statusText: "Task paused.", lastReason: result.summary });
      return result;
    }

    focusAndInsertText(controls.composer, task.draftMessage);
    const sendButton = controls.sendButton || (await findTaskSendButton(task, this.profile, 8000));
    if (!sendButton) {
      const result: TaskExecutionResult = {
        status: "blocked",
        reason: "send_button_missing",
        summary: "Send button is not available after preparing the task draft."
      };
      this.setState({ mode: "paused", statusText: "Task paused.", lastReason: result.summary });
      return result;
    }

    clickSendControl(sendButton);
    const sentAt = new Date().toISOString();
    const externalId = `task:${task.id}:${Date.now()}`;
    this.setState({ mode: "auto_active", statusText: "Task sent. Monitoring this chat page." });
    return { status: "sent", externalId, sentAt };
  }

  async prepareTaskForApproval(task: ExtensionTask): Promise<TaskPreparationResult> {
    const blocker = detectTaskBlocker(task);
    if (blocker) {
      this.setState({ mode: "paused", statusText: "Task blocked.", lastReason: blocker.summary });
      return blocker;
    }

    if (!taskCanBePrepared(task.status)) {
      throw new Error("Task is not ready for worker preparation.");
    }

    const controls = await findTaskComposerControls(task, this.profile, 30000);
    if (!controls.composer) {
      const result: TaskPreparationResult = {
        status: "blocked",
        reason: "composer_missing",
        summary: "Composer is not available on this chat page."
      };
      this.setState({ mode: "paused", statusText: "Task paused.", lastReason: result.summary });
      return result;
    }

    focusAndInsertText(controls.composer, task.draftMessage);
    const sendButton = controls.sendButton || (await findTaskSendButton(task, this.profile, 8000));
    if (!sendButton) {
      const result: TaskPreparationResult = {
        status: "blocked",
        reason: "send_button_missing",
        summary: "Send button is not available after preparing the task draft."
      };
      this.setState({ mode: "paused", statusText: "Task paused.", lastReason: result.summary });
      return result;
    }

	    this.setState({
	      mode: "needs_approval",
	      statusText: "Draft prepared. Waiting for Leadsy app approval.",
	      pendingReply: task.draftMessage,
	      lastReason: `Task ${task.id} is ready to send.`
	    });
    return { status: "prepared", draftMessage: task.draftMessage };
  }

  async sendPreparedTask(task: ExtensionTask): Promise<{ externalId: string; sentAt: string }> {
    if (this.profile && this.log) {
      await this.sendReply(task.draftMessage, this.profile);
      const sentAt = new Date().toISOString();
      const externalId = `task:${task.id}:${Date.now()}`;
      this.log.messages = [
        ...this.log.messages,
        {
          id: externalId,
          direction: "outgoing",
          text: task.draftMessage,
          timestamp: Date.parse(sentAt),
          sourceUrl: window.location.href
        }
      ];
      this.log.updatedAt = Date.now();
      await this.store.saveLog(this.log);
      await this.syncToLeadsy("reply-sent", `Worker sent approved task ${task.id}.`);
      this.setState({ mode: "auto_active", statusText: "Approved task sent. Watching for replies." });
      return { externalId, sentAt };
    }

    const controls = await findTaskComposerControls(task, this.profile, 12000);
    if (!controls.composer) {
      throw new Error("Composer is not available on this chat page.");
    }
    focusAndInsertText(controls.composer, task.draftMessage);
    const sendButton = controls.sendButton || (await findTaskSendButton(task, this.profile, 5000));
    if (!sendButton) {
      throw new Error("Send button is not available after inserting task draft.");
    }
    clickSendControl(sendButton);
    const sentAt = new Date().toISOString();
    const externalId = `task:${task.id}:${Date.now()}`;
    this.setState({ mode: "auto_active", statusText: "Approved task sent. Monitoring this chat page." });
    return { externalId, sentAt };
  }

  rejectPending(): void {
    this.pendingDecision = undefined;
    this.setState({ mode: "paused", statusText: "First reply rejected. Automation paused." });
  }

  async clearLogs(): Promise<void> {
    await this.store.clearAll();
    this.log = undefined;
    this.setState({ mode: this.mode, statusText: "Local logs and learned profiles were cleared." });
  }

  private async detectProfile(siteFingerprint: string): Promise<ChatSiteProfile> {
    const snapshot = collectDomSnapshot();
    const messages = this.profile ? extractMessagesFromDocument(this.profile) : [];
    return this.openRouter.detectProfile({ ...snapshot, siteFingerprint }, messages);
  }

  private async loadOrCreateLog(siteFingerprint: string, profileId: string): Promise<ConversationLog> {
    const existing = await this.store.getLog(siteFingerprint);
    if (existing) {
      if (
        !this.settings.requireFirstReplyApproval &&
        (existing.approvalState === "unapproved" || existing.approvalState === "needs_first_approval")
      ) {
        existing.approvalState = "approved";
        existing.updatedAt = Date.now();
        await this.store.saveLog(existing);
      }
      return existing;
    }

    const now = Date.now();
    const log: ConversationLog = {
      chatFingerprint: siteFingerprint,
      profileId,
      approvalState: this.settings.requireFirstReplyApproval ? "unapproved" : "approved",
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    await this.store.saveLog(log);
    return log;
  }

  private startObserver(): void {
    this.stopObserver();
    this.observer = new MutationObserver(() => this.scheduleProcessing());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  private stopObserver(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.processTimer) {
      globalThis.clearTimeout(this.processTimer);
      this.processTimer = undefined;
    }
  }

  private scheduleProcessing(): void {
    if (this.processTimer) {
      globalThis.clearTimeout(this.processTimer);
    }
    this.processTimer = globalThis.setTimeout(() => {
      void this.processVisibleMessages().catch((error) => {
        void this.syncToLeadsy("monitor_error", error instanceof Error ? error.message : "Failed while processing new chat messages.");
        this.setState({
          mode: "error",
          statusText: "Failed while processing new chat messages.",
          lastReason: error instanceof Error ? error.message : "Unknown error"
        });
      });
    }, 700);
  }

  private async processVisibleMessages(): Promise<void> {
    if (!this.profile || !this.log || this.mode === "paused") {
      return;
    }

    const visibleMessages = extractMessagesFromDocument(this.profile);
    const merged = mergeNewMessages(this.log.messages, visibleMessages);
    this.log.messages = merged;
    this.log.updatedAt = Date.now();
    await this.store.saveLog(this.log);
    await this.syncToLeadsy("monitor_synced", "Visible chat messages synced to Leadsy.");

    const unansweredIncoming = getUnansweredIncomingTurn(merged);
    const latestIncoming = unansweredIncoming.at(-1);
    if (!latestIncoming || latestIncoming.id === this.log.lastHandledIncomingId || this.pendingDecision) {
      if (this.mode === "detecting") {
        const incomingCount = merged.filter((message) => message.direction === "incoming").length;
        this.setState({
          mode: "auto_active",
          statusText: `Armed. Read ${merged.length} messages and recognized ${incomingCount} incoming. Waiting for the next unanswered incoming message.`
        });
      }
      return;
    }

    const knowledge = await this.knowledgeProvider.getContext(this.log, merged);
    const rawDecision = await this.openRouter.decideReply(this.log, merged, knowledge, this.settings);
    const decision = applySafetyPolicy(
      rawDecision,
      unansweredIncoming.map((message) => message.text)
    );
    this.log.lastHandledIncomingId = latestIncoming.id;
    await this.store.saveLog(this.log);

    if (decision.action === "pause") {
      await this.syncToLeadsy("reply-paused", decision.reason);
      this.pause(decision.reason);
      return;
    }

    if (this.settings.requireFirstReplyApproval && this.log.approvalState !== "approved") {
      this.pendingDecision = decision;
      this.log.approvalState = "needs_first_approval";
      await this.store.saveLog(this.log);
      await this.syncToLeadsy("reply-generated", decision.reason);
      this.setState({
        mode: "needs_approval",
        statusText: "Approve the first generated reply.",
        pendingReply: decision.replyText,
        lastReason: `${decision.reason} Latest incoming: "${latestIncoming.text.slice(0, 120)}"`
      });
      return;
    }

    await this.sendReply(decision.replyText, this.profile);
    await this.syncToLeadsy("reply-sent", decision.reason);
    this.setState({ mode: "auto_active", statusText: "Auto-replied. Watching for the next message." });
  }

  private async sendReply(replyText: string, profile: ChatSiteProfile): Promise<void> {
    const composer = document.querySelector<HTMLElement>(profile.composerSelector);

    if (!composer) {
      throw new Error("Composer is not available.");
    }

    focusAndInsertText(composer, replyText);
    const sendButton = await findElementWithRetry(profile.sendButtonSelector, 1200);
    if (!sendButton) {
      throw new Error("Send button is not available after inserting reply text.");
    }
    clickSendControl(sendButton);
  }

  private setState(state: OverlayState): void {
    this.mode = state.mode;
    this.emit(state);
  }

  private async syncToLeadsy(type: ConversationSyncEventType, summary: string) {
    if (!this.log || !this.openRouter.syncConversation) return;
    await this.openRouter.syncConversation({
      chat: this.log,
      messages: this.log.messages,
      event: {
        type,
        summary
      }
    });
  }
}

async function findElementWithRetry(selector: string, timeoutMs: number): Promise<HTMLElement | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

async function findTaskComposerControls(
  task: ExtensionTask,
  profile: ChatSiteProfile | undefined,
  timeoutMs: number
): Promise<Partial<TaskComposerControls>> {
  const composerSelectors = taskComposerSelectors(task, profile);
  const composer = await findFirstElementWithRetry(composerSelectors, timeoutMs);
  if (!composer) return {};
  const sendButton = await findTaskSendButton(task, profile, 1200);
  return { composer, sendButton };
}

async function findTaskSendButton(
  task: ExtensionTask,
  profile: ChatSiteProfile | undefined,
  timeoutMs: number
): Promise<HTMLElement | undefined> {
  return findFirstElementWithRetry(taskSendButtonSelectors(task, profile), timeoutMs);
}

async function findFirstElementWithRetry(selectors: string[], timeoutMs: number): Promise<HTMLElement | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    for (const selector of selectors) {
      const element = safeQuerySelector(selector);
      if (element) return element;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

function safeQuerySelector(selector: string): HTMLElement | undefined {
  try {
    return document.querySelector<HTMLElement>(selector) || undefined;
  } catch {
    return undefined;
  }
}

function taskComposerSelectors(task: ExtensionTask, profile?: ChatSiteProfile): string[] {
  const selectors = profile?.composerSelector ? [profile.composerSelector] : [];
  if (task.platform === "whatsapp-web") {
    selectors.push(
      'footer [aria-placeholder*="message" i][contenteditable="true"]',
      '[aria-placeholder*="message" i][contenteditable="true"]',
      'footer [contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea[placeholder*="message" i]'
    );
  }
  selectors.push(
    '[data-composer]',
    'textarea',
    '[contenteditable="true"][role="textbox"]',
    '[aria-label*="message" i][contenteditable="true"]',
    '[contenteditable="true"]'
  );
  return uniqueSelectors(selectors);
}

function taskSendButtonSelectors(task: ExtensionTask, profile?: ChatSiteProfile): string[] {
  const selectors = profile?.sendButtonSelector ? [profile.sendButtonSelector] : [];
  if (task.platform === "whatsapp-web") {
    selectors.push(
      'button[aria-label="Send"]',
      '[role="button"][aria-label="Send"]',
      '[aria-label*="send" i][role="button"]',
      '[aria-label*="send" i]',
      'button:has([data-icon="send"])',
      '[data-icon="send"]'
    );
  }
  selectors.push('[data-send]', 'button[type="submit"]', 'button[aria-label*="send" i]', '[role="button"][aria-label*="send" i]');
  return uniqueSelectors(selectors);
}

function uniqueSelectors(selectors: string[]) {
  return [...new Set(selectors.map((selector) => selector.trim()).filter(Boolean))];
}

function clickSendControl(element: HTMLElement): void {
  const clickable = element.closest<HTMLElement>('button, [role="button"]') || element;
  clickable.click();
}

function focusAndInsertText(composer: HTMLElement, text: string): void {
  composer.focus();

  if (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement) {
    composer.value = text;
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    return;
  }

  composer.textContent = text;
  composer.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
}

function taskCanBePrepared(status: ExtensionTask["status"]) {
  return status === "queued" || status === "in_progress" || status === "awaiting_send_approval";
}

function detectTaskBlocker(task: ExtensionTask): TaskStoppedResult | undefined {
  if (task.platform !== "whatsapp-web") return undefined;

  const bodyText = (document.body?.innerText || document.body?.textContent || "").replace(/\s+/g, " ").trim();
  if (!bodyText) return undefined;

  const whatsappUnavailable = /(?:isn['’]?t|is not|not)\s+on\s+whatsapp/i.test(bodyText);
  if (!whatsappUnavailable) return undefined;

  const phone = task.contact.phone ? ` ${task.contact.phone}` : "";
  return {
    status: "postponed",
    reason: "target_not_on_whatsapp",
    summary: `WhatsApp reports${phone} is not on WhatsApp.`
  };
}
