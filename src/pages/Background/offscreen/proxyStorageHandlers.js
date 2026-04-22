// chrome.storage / chrome.tabs proxy handlers for the offscreen recorder.

import { registerMessage } from "../../../messaging/messageRouter";

const getArea = (area) => {
  const a = chrome.storage?.[area];
  if (!a) throw new Error(`Unknown storage area: ${area}`);
  return a;
};

export const registerProxyStorageHandlers = () => {
  registerMessage("proxy-storage-get", async ({ area, keys }) => {
    try {
      const a = getArea(area);
      const result = await a.get(keys === null ? undefined : keys);
      return { ok: true, result: result || {} };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  registerMessage("proxy-storage-set", async ({ area, items }) => {
    try {
      await getArea(area).set(items || {});
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  registerMessage("proxy-storage-remove", async ({ area, keys }) => {
    try {
      await getArea(area).remove(keys);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  registerMessage("proxy-storage-clear", async ({ area }) => {
    try {
      await getArea(area).clear();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    chrome.runtime
      .sendMessage({ type: "proxy-storage-onchanged", changes, area })
      .catch(() => {});
  });

  registerMessage("proxy-tabs-get", async ({ tabId }) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      return { ok: true, tab };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
};
