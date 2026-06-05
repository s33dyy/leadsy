import { describe, expect, it } from "vitest";
import { extractMessagesFromDocument, getUnansweredIncomingTurn, mergeNewMessages } from "../src/core/messages";
import type { ChatMessage, ChatSiteProfile } from "../src/core/types";

describe("mergeNewMessages", () => {
  it("keeps existing messages and appends only new message ids", () => {
    const existing: ChatMessage[] = [
      {
        id: "a",
        direction: "incoming",
        text: "Hello",
        timestamp: 1,
        sourceUrl: "https://chat.test"
      }
    ];
    const incoming: ChatMessage[] = [
      existing[0],
      {
        id: "b",
        direction: "outgoing",
        text: "Hi",
        timestamp: 2,
        sourceUrl: "https://chat.test"
      }
    ];

    expect(mergeNewMessages(existing, incoming)).toHaveLength(2);
    expect(mergeNewMessages(existing, incoming).map((message) => message.id)).toEqual(["a", "b"]);
  });
});

describe("getUnansweredIncomingTurn", () => {
  it("returns incoming messages after the latest outgoing message while ignoring trailing system items", () => {
    const messages: ChatMessage[] = [
      {
        id: "out-1",
        direction: "outgoing",
        text: "Hi",
        timestamp: 1,
        sourceUrl: "https://chat.test"
      },
      {
        id: "in-1",
        direction: "incoming",
        text: "Need pricing",
        timestamp: 2,
        sourceUrl: "https://chat.test"
      },
      {
        id: "sys-1",
        direction: "system",
        text: "Today",
        timestamp: 3,
        sourceUrl: "https://chat.test"
      }
    ];

    expect(getUnansweredIncomingTurn(messages).map((message) => message.id)).toEqual(["in-1"]);
  });
});

describe("extractMessagesFromDocument", () => {
  it("detects WhatsApp descendant message directions and readable text", () => {
    document.body.innerHTML = `
      <main id="main">
        <div data-id="false_abc">
          <div class="message-in">
            <div data-pre-plain-text="[12:00] Sugarmommy: ">
              <span class="selectable-text">hello test</span>
            </div>
          </div>
        </div>
        <div data-id="true_def">
          <div class="message-out">
            <span class="selectable-text">previous reply</span>
          </div>
        </div>
      </main>
    `;
    const profile: ChatSiteProfile = {
      id: "wa",
      siteFingerprint: "https://web.whatsapp.com/",
      messageListSelector: "#main",
      messageSelector: ".message-in, .message-out, [data-id]",
      composerSelector: '[contenteditable="true"][role="textbox"]',
      sendButtonSelector: '[aria-label="Send"]',
      incomingSelector: ".message-in, [data-id^='false_']",
      outgoingSelector: ".message-out, [data-id^='true_']",
      confidence: 0.8,
      validationStatus: "valid",
      createdAt: 1,
      updatedAt: 1
    };

    const messages = extractMessagesFromDocument(profile, document);

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "false_abc", direction: "incoming", text: "hello test" }),
        expect.objectContaining({ id: "true_def", direction: "outgoing", text: "previous reply" })
      ])
    );
  });

  it("classifies wide Instagram-style left-side bubbles as incoming", () => {
    document.body.innerHTML = `
      <main>
        <div role="row" data-message-row>
          <div dir="auto">Hey I have a meeting tomorrow about double indemnity in insurance.</div>
        </div>
      </main>
    `;
    const messageNode = document.querySelector<HTMLElement>("[data-message-row]");
    if (!messageNode) {
      throw new Error("fixture message node was not created");
    }
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1220 });
    messageNode.getBoundingClientRect = () =>
      ({
        left: 470,
        right: 950,
        width: 480,
        top: 0,
        bottom: 40,
        height: 40,
        x: 470,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;

    const profile: ChatSiteProfile = {
      id: "ig",
      siteFingerprint: "https://www.instagram.com/direct/t/123",
      messageListSelector: "main",
      messageSelector: "[data-message-row]",
      composerSelector: '[role="textbox"]',
      sendButtonSelector: '[aria-label="Send"]',
      incomingSelector: '[data-direction="incoming"]',
      outgoingSelector: '[data-direction="outgoing"]',
      confidence: 0.8,
      validationStatus: "valid",
      createdAt: 1,
      updatedAt: 1
    };

    const messages = extractMessagesFromDocument(profile, document);

    expect(messages[0]).toEqual(
      expect.objectContaining({
        direction: "incoming",
        text: "Hey I have a meeting tomorrow about double indemnity in insurance."
      })
    );
  });

  it("classifies right-aligned bubbles inside a split-screen chat pane as outgoing", () => {
    document.body.innerHTML = `
      <main data-message-list>
        <div data-message-row>
          <div dir="auto">Hi there, yes, I can help.</div>
        </div>
      </main>
    `;
    const listNode = document.querySelector<HTMLElement>("[data-message-list]");
    const messageNode = document.querySelector<HTMLElement>("[data-message-row]");
    if (!listNode || !messageNode) {
      throw new Error("fixture nodes were not created");
    }
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1854 });
    listNode.getBoundingClientRect = () =>
      ({
        left: 0,
        right: 918,
        width: 918,
        top: 0,
        bottom: 900,
        height: 900,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }) as DOMRect;
    messageNode.getBoundingClientRect = () =>
      ({
        left: 212,
        right: 817,
        width: 605,
        top: 120,
        bottom: 220,
        height: 100,
        x: 212,
        y: 120,
        toJSON: () => ({})
      }) as DOMRect;

    const profile: ChatSiteProfile = {
      id: "wa-split",
      siteFingerprint: "https://web.whatsapp.com/",
      messageListSelector: "[data-message-list]",
      messageSelector: "[data-message-row]",
      composerSelector: '[role="textbox"]',
      sendButtonSelector: '[aria-label="Send"]',
      incomingSelector: '[data-direction="incoming"]',
      outgoingSelector: '[data-direction="outgoing"]',
      confidence: 0.8,
      validationStatus: "valid",
      createdAt: 1,
      updatedAt: 1
    };

    const messages = extractMessagesFromDocument(profile, document);

    expect(messages[0]).toEqual(
      expect.objectContaining({
        direction: "outgoing",
        text: "Hi there, yes, I can help."
      })
    );
  });
});
