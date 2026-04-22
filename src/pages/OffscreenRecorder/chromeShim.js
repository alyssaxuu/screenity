// chrome.storage / chrome.i18n / chrome.tabs shim for offscreen docs - proxies to SW.
// Install before any code that uses chrome.storage runs.

const DEBUG = false;

const sendProxy = async (type, payload) => {
  try {
    const resp = await chrome.runtime.sendMessage({ type, ...payload });
    if (DEBUG) console.log("[ChromeShim]", type, "->", resp);
    return resp;
  } catch (err) {
    console.warn("[ChromeShim]", type, "error:", err);
    return { ok: false, error: String(err) };
  }
};

const makeStorageArea = (area) => ({
  get(keys, callback) {
    const normalised = keys === undefined ? null : keys;
    const promise = sendProxy("proxy-storage-get", {
      area,
      keys: normalised,
    }).then((resp) => (resp && resp.ok ? resp.result || {} : {}));
    if (typeof callback === "function") {
      promise.then(callback, () => callback({}));
      return undefined;
    }
    return promise;
  },
  set(items, callback) {
    const promise = sendProxy("proxy-storage-set", { area, items }).then(
      () => undefined
    );
    if (typeof callback === "function") {
      promise.then(callback, callback);
      return undefined;
    }
    return promise;
  },
  remove(keys, callback) {
    const promise = sendProxy("proxy-storage-remove", { area, keys }).then(
      () => undefined
    );
    if (typeof callback === "function") {
      promise.then(callback, callback);
      return undefined;
    }
    return promise;
  },
  clear(callback) {
    const promise = sendProxy("proxy-storage-clear", { area }).then(
      () => undefined
    );
    if (typeof callback === "function") {
      promise.then(callback, callback);
      return undefined;
    }
    return promise;
  },
});

const storageChangeListeners = new Set();

const bindOnChangedRelay = () => {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "proxy-storage-onchanged") {
      storageChangeListeners.forEach((fn) => {
        try {
          fn(msg.changes, msg.area);
        } catch (err) {
          console.warn("[ChromeShim] storage.onChanged listener error:", err);
        }
      });
    }
  });
};

export function installChromeShims() {
  if (typeof chrome === "undefined") {
    console.error("[ChromeShim] chrome global missing - cannot shim");
    return;
  }

  if (!chrome.storage) {
    chrome.storage = {
      local: makeStorageArea("local"),
      session: makeStorageArea("session"),
      sync: makeStorageArea("sync"),
      managed: makeStorageArea("managed"),
      onChanged: {
        addListener: (fn) => storageChangeListeners.add(fn),
        removeListener: (fn) => storageChangeListeners.delete(fn),
        hasListener: (fn) => storageChangeListeners.has(fn),
      },
    };
    bindOnChangedRelay();
    console.log("[ChromeShim] chrome.storage installed");
  }

  if (!chrome.i18n || typeof chrome.i18n.getMessage !== "function") {
    chrome.i18n = chrome.i18n || {};
    chrome.i18n.getMessage = (key) => String(key || "");
    console.log("[ChromeShim] chrome.i18n.getMessage shimmed");
  }

  if (!chrome.tabs) {
    chrome.tabs = {
      get(tabId, callback) {
        const promise = sendProxy("proxy-tabs-get", { tabId }).then((resp) => {
          if (resp && resp.ok) return resp.tab;
          throw new Error(resp?.error || "Tab not found");
        });
        if (typeof callback === "function") {
          promise.then(callback, () => callback(undefined));
          return undefined;
        }
        return promise;
      },
    };
    console.log("[ChromeShim] chrome.tabs installed");
  }
}
