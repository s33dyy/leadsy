import { describe, expect, it, vi } from "vitest";
import { ChatAutomationController } from "../src/content/automation";
import { defaultAssistantSettings } from "../src/core/settings";
import { ConversationStore } from "../src/core/storage";
import type { ExtensionTask } from "../src/core/tasks";
import type { ChatSiteProfile, ResponderDecision } from "../src/core/types";

const profile: ChatSiteProfile = {
  id: "fixture-profile",
  siteFingerprint: "https://fixture.test/chat",
  messageListSelector: "[data-message-list]",
  messageSelector: "[data-message]",
  composerSelector: "[data-composer]",
  sendButtonSelector: "[data-send]",
  incomingSelector: '[data-direction="incoming"]',
  outgoingSelector: '[data-direction="outgoing"]',
  confidence: 0.94,
  validationStatus: "valid",
  createdAt: 1,
  updatedAt: 1
};

const approvalSettings = { ...defaultAssistantSettings, requireFirstReplyApproval: true };

describe("ChatAutomationController", () => {
  const task: ExtensionTask = {
    id: "exttask_prepare",
    type: "initiate_conversation",
    status: "in_progress",
    priority: "high",
    platform: "whatsapp-web",
    targetUrl: "https://web.whatsapp.com/send?phone=919830000000",
    contact: {
      displayName: "Asha Buyer",
      phone: "+919830000000"
    },
    draftMessage: "Hi Asha, I can send pricing here. What team size should I quote for?",
    contextSummary: "Imported lead with pricing interest.",
    createdAt: "2026-06-02T08:00:00.000Z",
    updatedAt: "2026-06-02T08:00:00.000Z"
  };

  it("executes an active worker task by inserting and sending without send approval", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="outgoing">Hello</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    let sendClicks = 0;
    document.querySelector("[data-send]")?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const controller = new ChatAutomationController(() => undefined, {
      store: new ConversationStore("leadsy-task-prepare-test"),
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn()
      }
    });

    await controller.arm();
    const sent = await controller.executeTask(task);

    expect(document.querySelector<HTMLElement>("[data-composer]")?.textContent).toBe(task.draftMessage);
    expect(sendClicks).toBe(1);
    expect(sent.status).toBe("sent");
    if (sent.status !== "sent") throw new Error("Task should have been sent.");
    expect(sent.externalId).toContain(task.id);
    controller.pause("test cleanup");
  });

  it("does not answer its own just-sent worker task when the DOM re-renders it as incoming", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="outgoing">Hello</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    let sendClicks = 0;
    document.querySelector("[data-send]")?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const decideReply = vi.fn(async (): Promise<ResponderDecision> => ({
      action: "send",
      replyText: "Loop reply that should never be sent.",
      confidence: 0.9,
      reason: "mistaken echo",
      tags: ["loop"]
    }));
    const controller = new ChatAutomationController(() => undefined, {
      store: new ConversationStore("leadsy-task-echo-guard-test"),
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply
      }
    });

    await controller.arm();
    const sent = await controller.executeTask(task);
    if (sent.status !== "sent") throw new Error("Task should have been sent.");

    document.querySelector("[data-message-list]")?.insertAdjacentHTML(
      "beforeend",
      `<p data-message data-direction="incoming">${task.draftMessage}</p>`
    );
    await new Promise((resolve) => setTimeout(resolve, 850));

    expect(decideReply).not.toHaveBeenCalled();
    expect(sendClicks).toBe(1);
    controller.pause("test cleanup");
  });

  it("does not re-answer a handled inbound turn when ids churn and its own reply is misread as incoming", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-id="incoming-old" data-direction="incoming">Okay and?</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    let sendClicks = 0;
    document.querySelector("[data-send]")?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const firstDecision: ResponderDecision = {
      action: "send",
      replyText: "Hi there, yes, I can help. To guide you properly, what result are you trying to improve first?",
      confidence: 0.9,
      reason: "first response",
      tags: ["lead"]
    };
    const loopDecision: ResponderDecision = {
      action: "send",
      replyText: "Loop reply that should never be sent.",
      confidence: 0.9,
      reason: "duplicate turn",
      tags: ["loop"]
    };
    const decideReply = vi.fn(async () => firstDecision).mockResolvedValueOnce(firstDecision).mockResolvedValueOnce(loopDecision);
    const controller = new ChatAutomationController(() => undefined, {
      store: new ConversationStore("leadsy-inbound-id-churn-guard-test"),
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply
      }
    });

    await controller.arm();
    expect(sendClicks).toBe(1);
    expect(decideReply).toHaveBeenCalledTimes(1);

    document.querySelector("[data-message-list]")!.innerHTML = `
      <p data-message data-id="incoming-new" data-direction="incoming">Okay and?</p>
      <p data-message data-id="leadsy-echo-new" data-direction="incoming">${firstDecision.replyText}</p>
    `;
    await new Promise((resolve) => setTimeout(resolve, 850));

    expect(decideReply).toHaveBeenCalledTimes(1);
    expect(sendClicks).toBe(1);
    controller.pause("test cleanup");
  });

  it("prepares and sends an initiation task on an empty WhatsApp compose page", async () => {
    document.body.innerHTML = `
      <main>
        <footer>
          <div aria-placeholder="Type a message" contenteditable="true" role="textbox"></div>
          <button aria-label="Send">Send</button>
        </footer>
      </main>
    `;

    let sendClicks = 0;
    document.querySelector('[aria-label="Send"]')?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const states: string[] = [];
    const controller = new ChatAutomationController((state) => states.push(state.mode), {
      store: new ConversationStore("leadsy-empty-whatsapp-initiation-test"),
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn()
      }
    });

    await controller.arm();
    const prepared = await controller.prepareTaskForApproval(task);

    expect(prepared.status).toBe("prepared");
    expect(document.querySelector<HTMLElement>('[aria-placeholder="Type a message"]')?.textContent).toBe(task.draftMessage);
    expect(sendClicks).toBe(0);
    expect(states).toContain("needs_approval");

    await controller.sendPreparedTask(task);

    expect(sendClicks).toBe(1);
    controller.pause("test cleanup");
  });

  it("postpones WhatsApp tasks when the page says the number is not on WhatsApp", async () => {
    document.body.innerHTML = `
      <div role="dialog">
        <p>The number +91 124 425 2720 isn't on WhatsApp.</p>
        <button>OK</button>
      </div>
    `;

    const controller = new ChatAutomationController(() => undefined, {
      store: new ConversationStore("leadsy-task-invalid-whatsapp-test"),
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn()
      }
    });

    const prepared = await controller.prepareTaskForApproval({
      ...task,
      id: "exttask_invalid",
      contact: {
        displayName: "Invalid Buyer",
        phone: "+91 124 425 2720"
      }
    });

    expect(prepared).toMatchObject({
      status: "postponed",
      reason: "target_not_on_whatsapp"
    });
  });

  it("requires approval for the first generated reply before sending into the page", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="incoming">Can you help with pricing?</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    let sendClicks = 0;
    document.querySelector("[data-send]")?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const decision: ResponderDecision = {
      action: "send",
      replyText: "Yes. What team size are you buying for?",
      confidence: 0.9,
      reason: "lead qualification",
      tags: ["lead"]
    };
    const states: string[] = [];
    const store = new ConversationStore("leadsy-automation-test");
    const controller = new ChatAutomationController(
      (state) => states.push(state.mode),
      {
        store,
        settings: approvalSettings,
        openRouter: {
          detectProfile: vi.fn(async () => profile),
          decideReply: vi.fn(async () => decision)
        }
      }
    );

    await controller.arm();

    expect(states).toContain("needs_approval");
    expect(sendClicks).toBe(0);

    await controller.approvePending();

    expect(document.querySelector<HTMLElement>("[data-composer]")?.textContent).toBe(decision.replyText);
    expect(sendClicks).toBe(1);
    controller.pause("test cleanup");
  });

  it("auto-sends the first reply after chat controls are validated by default", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="incoming">Hey, what's up?</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    let sendClicks = 0;
    document.querySelector("[data-send]")?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const decision: ResponderDecision = {
      action: "send",
      replyText: "Hey! I'm doing well. What's going on?",
      confidence: 0.9,
      reason: "friendly general chat",
      tags: ["friendly"]
    };
    const states: string[] = [];
    const store = new ConversationStore("leadsy-automation-auto-first-test");
    const controller = new ChatAutomationController((state) => states.push(state.mode), {
      store,
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn(async () => decision)
      }
    });

    await controller.arm();

    expect(states).not.toContain("needs_approval");
    expect(document.querySelector<HTMLElement>("[data-composer]")?.textContent).toBe(decision.replyText);
    expect(sendClicks).toBe(1);
    controller.pause("test cleanup");
  });

  it("auto-sends subsequent replies after the first reply is approved", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="incoming">Can you help with pricing?</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    let sendClicks = 0;
    document.querySelector("[data-send]")?.addEventListener("click", () => {
      sendClicks += 1;
    });

    const firstDecision: ResponderDecision = {
      action: "send",
      replyText: "Yes. What team size are you buying for?",
      confidence: 0.9,
      reason: "lead qualification",
      tags: ["lead"]
    };
    const secondDecision: ResponderDecision = {
      action: "send",
      replyText: "Thanks. We can help a 20-person team.",
      confidence: 0.88,
      reason: "support and qualification",
      tags: ["support", "lead"]
    };
    const store = new ConversationStore("leadsy-automation-auto-test");
    const controller = new ChatAutomationController(() => undefined, {
      store,
      settings: approvalSettings,
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn(async () => firstDecision).mockResolvedValueOnce(firstDecision).mockResolvedValueOnce(secondDecision)
      }
    });

    await controller.arm();
    await controller.approvePending();

    document.querySelector("[data-message-list]")?.insertAdjacentHTML(
      "beforeend",
      `<p data-message data-direction="incoming">We are a 20-person team.</p>`
    );
    await new Promise((resolve) => setTimeout(resolve, 850));

    expect(document.querySelector<HTMLElement>("[data-composer]")?.textContent).toBe(secondDecision.replyText);
    expect(sendClicks).toBe(2);
    controller.pause("test cleanup");
  });

  it("waits for a dynamic send button after inserting reply text", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="incoming">Can you help with pricing?</p>
      </section>
      <div data-composer contenteditable="true"></div>
    `;

    const composer = document.querySelector("[data-composer]");
    composer?.addEventListener("input", () => {
      if (!document.querySelector("[data-send]")) {
        document.body.insertAdjacentHTML("beforeend", `<button data-send>Send</button>`);
      }
    });

    let sendClicks = 0;
    document.body.addEventListener("click", (event) => {
      if (event.target instanceof HTMLElement && event.target.matches("[data-send]")) {
        sendClicks += 1;
      }
    });

    const decision: ResponderDecision = {
      action: "send",
      replyText: "Yes. What team size are you buying for?",
      confidence: 0.9,
      reason: "lead qualification",
      tags: ["lead"]
    };
    const store = new ConversationStore("leadsy-automation-dynamic-send-test");
    const controller = new ChatAutomationController(() => undefined, {
      store,
      settings: approvalSettings,
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn(async () => decision)
      }
    });

    await controller.arm();
    await controller.approvePending();

    expect(sendClicks).toBe(1);
    controller.pause("test cleanup");
  });

  it("generates a first pending reply for visible unanswered incoming messages on arm", async () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="outgoing">Hi, how can I help?</p>
        <p data-message data-direction="incoming">Can you share pricing?</p>
        <p data-message>Today</p>
      </section>
      <div data-composer contenteditable="true"></div>
      <button data-send>Send</button>
    `;

    const decision: ResponderDecision = {
      action: "send",
      replyText: "Sure. What team size should I quote for?",
      confidence: 0.9,
      reason: "lead qualification",
      tags: ["lead"]
    };
    const states: string[] = [];
    const controller = new ChatAutomationController((state) => states.push(state.mode), {
      store: new ConversationStore("leadsy-visible-unanswered-test"),
      settings: approvalSettings,
      openRouter: {
        detectProfile: vi.fn(async () => profile),
        decideReply: vi.fn(async () => decision)
      }
    });

    await controller.arm();

    expect(states).toContain("needs_approval");
    controller.pause("test cleanup");
  });
});
