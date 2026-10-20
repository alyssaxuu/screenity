import { DEFAULT_SETTINGS, normalizeSettings } from "./prompterRules";

const STORAGE_KEY = "teleprompter";

export const loadPrompterSettings = async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeSettings(result?.[STORAGE_KEY]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const savePrompterSettings = async (settings) => {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEY]: normalizeSettings(settings),
    });
  } catch {}
};
