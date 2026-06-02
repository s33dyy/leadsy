import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractMessagesFromDocument } from "../src/core/messages";
import { validateChatSiteProfile } from "../src/core/profile";
import type { ChatSiteProfile } from "../src/core/types";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("mock chat fixtures", () => {
  it.each(["whatsapp-like.html", "instagram-like.html", "generic-chat.html"])(
    "validates profile selectors and extracts messages from %s",
    (fixtureName) => {
      document.documentElement.innerHTML = readFileSync(join(fixturesDir, fixtureName), "utf8");
      const profile: ChatSiteProfile = {
        id: fixtureName,
        siteFingerprint: `fixture:${fixtureName}`,
        messageListSelector: "[data-message-list]",
        messageSelector: "[data-message]",
        composerSelector: "[data-composer]",
        sendButtonSelector: "[data-send]",
        incomingSelector: '[data-direction="incoming"]',
        outgoingSelector: '[data-direction="outgoing"]',
        confidence: 0.9,
        validationStatus: "untested",
        createdAt: 1,
        updatedAt: 1
      };

      expect(validateChatSiteProfile(profile, document).valid).toBe(true);
      expect(extractMessagesFromDocument(profile, document)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ direction: "incoming" }),
          expect.objectContaining({ direction: "outgoing" })
        ])
      );
    }
  );
});
