import { describe, expect, it } from "vitest";
import { detectLocalChatProfile, validateChatSiteProfile } from "../src/core/profile";
import type { ChatSiteProfile } from "../src/core/types";

describe("validateChatSiteProfile", () => {
  it("accepts a complete profile whose selectors resolve on the page", () => {
    document.body.innerHTML = `
      <main data-chat-root>
        <section data-message-list>
          <p data-message data-direction="incoming">Hello</p>
          <p data-message data-direction="outgoing">Hi</p>
        </section>
        <div data-composer contenteditable="true"></div>
        <button data-send>Send</button>
      </main>
    `;

    const profile: ChatSiteProfile = {
      id: "example",
      siteFingerprint: "https://example.test/chat",
      messageListSelector: "[data-message-list]",
      messageSelector: "[data-message]",
      composerSelector: "[data-composer]",
      sendButtonSelector: "[data-send]",
      incomingSelector: '[data-direction="incoming"]',
      outgoingSelector: '[data-direction="outgoing"]',
      confidence: 0.91,
      validationStatus: "untested",
      createdAt: 1,
      updatedAt: 1
    };

    const result = validateChatSiteProfile(profile, document);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects profiles with missing selectors or low confidence", () => {
    document.body.innerHTML = `<div data-message-list></div>`;

    const profile: ChatSiteProfile = {
      id: "bad",
      siteFingerprint: "https://example.test/chat",
      messageListSelector: "[data-message-list]",
      messageSelector: "[data-message]",
      composerSelector: "[data-composer]",
      sendButtonSelector: "[data-send]",
      incomingSelector: '[data-direction="incoming"]',
      outgoingSelector: '[data-direction="outgoing"]',
      confidence: 0.4,
      validationStatus: "untested",
      createdAt: 1,
      updatedAt: 1
    };

    const result = validateChatSiteProfile(profile, document);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("messageSelector did not match any elements");
    expect(result.errors).toContain("composerSelector did not match any elements");
    expect(result.errors).toContain("sendButtonSelector did not match any elements");
    expect(result.errors).toContain("confidence must be at least 0.6");
  });
});

describe("detectLocalChatProfile", () => {
  it("detects WhatsApp-like controls without calling AI", () => {
    document.body.innerHTML = `
      <main id="main">
        <section aria-label="Message list">
          <div class="message-in" data-id="false_1">
            <span class="selectable-text">Need pricing</span>
          </div>
          <div class="message-out" data-id="true_1">
            <span class="selectable-text">Happy to help</span>
          </div>
        </section>
        <div role="textbox" aria-label="Type a message" contenteditable="true"></div>
      </main>
    `;

    const profile = detectLocalChatProfile(document, "https://web.whatsapp.com/");

    expect(profile).toEqual(
      expect.objectContaining({
        messageListSelector: "#main",
        messageSelector: "[data-id]",
        composerSelector: '[contenteditable="true"][role="textbox"]',
        sendButtonSelector: '[aria-label="Send"]',
        incomingSelector: ".message-in",
        outgoingSelector: ".message-out",
        validationStatus: "valid"
      })
    );
  });

  it("detects test-friendly generic chat controls", () => {
    document.body.innerHTML = `
      <section data-message-list>
        <p data-message data-direction="incoming">Hello</p>
        <p data-message data-direction="outgoing">Hi</p>
      </section>
      <textarea data-composer></textarea>
      <button data-send>Send</button>
    `;

    const profile = detectLocalChatProfile(document, "https://example.test/chat");

    expect(profile?.messageSelector).toBe("[data-message]");
    expect(profile?.validationStatus).toBe("valid");
  });

  it("detects Instagram-like controls without relying on AI JSON", () => {
    document.body.innerHTML = `
      <main>
        <div role="grid">
          <div role="row"><div dir="auto">Need support</div></div>
        </div>
        <div role="textbox" aria-label="Message" contenteditable="true"></div>
        <div role="button" aria-label="Send">Send</div>
      </main>
    `;

    const profile = detectLocalChatProfile(document, "https://www.instagram.com/direct/t/123");

    expect(profile).toEqual(
      expect.objectContaining({
        messageListSelector: 'main [role="grid"], main [role="log"], main',
        messageSelector: '[role="row"], [dir="auto"]',
        validationStatus: "valid"
      })
    );
  });
});
