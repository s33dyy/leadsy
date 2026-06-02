import { beforeEach, describe, expect, it } from "vitest";
import { ConversationStore } from "../src/core/storage";
import type { ConversationLog } from "../src/core/types";

describe("ConversationStore", () => {
  beforeEach(async () => {
    indexedDB.deleteDatabase("leadsy-chat-auto-responder-test");
  });

  it("persists full local conversation logs until cleared", async () => {
    const store = new ConversationStore("leadsy-chat-auto-responder-test");
    const log: ConversationLog = {
      chatFingerprint: "chat-1",
      profileId: "profile-1",
      approvalState: "approved",
      messages: [
        {
          id: "m1",
          direction: "incoming",
          text: "Need pricing",
          timestamp: 1,
          sourceUrl: "https://chat.test"
        }
      ],
      createdAt: 1,
      updatedAt: 2
    };

    await store.saveLog(log);

    expect(await store.getLog("chat-1")).toEqual(log);

    await store.clearAll();

    expect(await store.getLog("chat-1")).toBeUndefined();
  });
});
