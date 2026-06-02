import type { AssistantSettings, ChatSiteProfile, ConversationLog } from "./types";

const DEFAULT_DB_NAME = "leadsy-chat-auto-responder";
const DB_VERSION = 1;

type StoreName = "logs" | "profiles" | "settings";

export class ConversationStore {
  private dbPromise?: Promise<IDBDatabase>;

  constructor(private readonly dbName = DEFAULT_DB_NAME) {}

  async getLog(chatFingerprint: string): Promise<ConversationLog | undefined> {
    return this.get<ConversationLog>("logs", chatFingerprint);
  }

  async saveLog(log: ConversationLog): Promise<void> {
    await this.put("logs", log, log.chatFingerprint);
  }

  async getProfile(siteFingerprint: string): Promise<ChatSiteProfile | undefined> {
    return this.get<ChatSiteProfile>("profiles", siteFingerprint);
  }

  async saveProfile(profile: ChatSiteProfile): Promise<void> {
    await this.put("profiles", profile, profile.siteFingerprint);
  }

  async getSettings(): Promise<AssistantSettings | undefined> {
    return this.get<AssistantSettings>("settings", "assistant");
  }

  async saveSettings(settings: AssistantSettings): Promise<void> {
    await this.put("settings", settings, "assistant");
  }

  async clearAll(): Promise<void> {
    const db = await this.open();
    await Promise.all([
      requestToPromise(db.transaction("logs", "readwrite").objectStore("logs").clear()),
      requestToPromise(db.transaction("profiles", "readwrite").objectStore("profiles").clear())
    ]);
  }

  private async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.open();
    const transaction = db.transaction(storeName, "readonly");
    return requestToPromise<T | undefined>(transaction.objectStore(storeName).get(key));
  }

  private async put<T>(storeName: StoreName, value: T, key: IDBValidKey): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(storeName, "readwrite");
    await requestToPromise(transaction.objectStore(storeName).put(value, key));
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          for (const storeName of ["logs", "profiles", "settings"] satisfies StoreName[]) {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName);
            }
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
      });
    }
    return this.dbPromise;
  }
}

function requestToPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}
