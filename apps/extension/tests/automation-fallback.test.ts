import { describe, expect, it, vi } from "vitest";
import { ChatAutomationController } from "../src/content/automation";
import { ConversationStore } from "../src/core/storage";
import type { ResponderDecision } from "../src/core/types";

describe("ChatAutomationController local profile fallback", () => {
  it("arms a WhatsApp-like page without calling OpenRouter profile detection", async () => {
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

    const detectProfile = vi.fn(async () => {
      throw new Error("AI detection should not run");
    });
    const controller = new ChatAutomationController(() => undefined, {
      store: new ConversationStore("leadsy-local-fallback-test"),
      openRouter: {
        detectProfile,
        decideReply: vi.fn(
          async (): Promise<ResponderDecision> => ({
            action: "pause",
            replyText: "",
            confidence: 0,
            reason: "no send",
            tags: []
          })
        )
      }
    });

    await controller.arm();

    expect(detectProfile).not.toHaveBeenCalled();
    controller.pause("test cleanup");
  });
});
