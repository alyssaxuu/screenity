const ONBOARDING_SEEN_KEY = "onboardingSeen";

export const hasSeenOnboarding = async (key) => {
  try {
    const result = await chrome.storage.local.get([ONBOARDING_SEEN_KEY]);
    const seen = result?.[ONBOARDING_SEEN_KEY];
    return Boolean(seen && typeof seen === "object" && seen[key] === true);
  } catch {
    return false;
  }
};

export const markOnboardingSeen = async (key) => {
  try {
    const result = await chrome.storage.local.get([ONBOARDING_SEEN_KEY]);
    const current =
      result?.[ONBOARDING_SEEN_KEY] &&
      typeof result[ONBOARDING_SEEN_KEY] === "object"
        ? result[ONBOARDING_SEEN_KEY]
        : {};
    await chrome.storage.local.set({
      [ONBOARDING_SEEN_KEY]: {
        ...current,
        [key]: true,
      },
    });
  } catch {}
};

export const resetOnboardingSeen = async (keys = []) => {
  try {
    const result = await chrome.storage.local.get([ONBOARDING_SEEN_KEY]);
    const current =
      result?.[ONBOARDING_SEEN_KEY] &&
      typeof result[ONBOARDING_SEEN_KEY] === "object"
        ? { ...result[ONBOARDING_SEEN_KEY] }
        : {};

    if (Array.isArray(keys) && keys.length > 0) {
      keys.forEach((key) => {
        delete current[key];
      });
    } else {
      Object.keys(current).forEach((key) => {
        delete current[key];
      });
    }

    await chrome.storage.local.set({
      [ONBOARDING_SEEN_KEY]: current,
    });
  } catch {}
};
