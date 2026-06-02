export interface LeadsyConnectionSettings {
  baseUrl: string;
  token: string;
  fallbackEnabled: boolean;
}

export const defaultConnectionSettings: LeadsyConnectionSettings = {
  baseUrl: import.meta.env.VITE_LEADSY_BASE_URL || "http://localhost:3000",
  token: "",
  fallbackEnabled: true
};

const storageKey = "leadsyConnection";

export async function loadConnectionSettings(): Promise<LeadsyConnectionSettings> {
  const stored = await chrome.storage.local.get(storageKey);
  return {
    ...defaultConnectionSettings,
    ...((stored[storageKey] as Partial<LeadsyConnectionSettings> | undefined) ?? {})
  };
}

export async function saveConnectionSettings(settings: LeadsyConnectionSettings): Promise<void> {
  await chrome.storage.local.set({
    [storageKey]: {
      baseUrl: settings.baseUrl.trim().replace(/\/+$/, "") || defaultConnectionSettings.baseUrl,
      token: settings.token.trim(),
      fallbackEnabled: settings.fallbackEnabled
    }
  });
}
