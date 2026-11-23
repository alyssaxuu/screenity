// A tab opened a moment ago has no content script yet, so the first send fails
// with "Receiving end does not exist". Keep trying until it attaches.
const RETRY_DELAYS_MS = [250, 500, 1000, 2000, 3000, 4000, 5000, 5000];

const NOT_READY = [
  "Receiving end does not exist",
  "Could not establish connection",
  "Invalid tab URL",
];

export const isTabNotReadyError = (err) => {
  const text = String(err?.message ?? err ?? "");
  return NOT_READY.some((s) => text.includes(s));
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Any other error, a closed tab included, ends it at once. Never throws.
export const sendWhenTabReady = async (
  tabId,
  message,
  { send, sleep = wait, delays = RETRY_DELAYS_MS, label = "" } = {},
) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await send(tabId, message);
      return { ok: true, attempts: attempt + 1, response };
    } catch (err) {
      if (!isTabNotReadyError(err) || attempt >= delays.length) {
        console.warn(`[Screenity][BG] Failed to send ${message?.type}${label}`, err);
        return { ok: false, attempts: attempt + 1, error: String(err?.message ?? err) };
      }
      await sleep(delays[attempt]);
    }
  }
};
