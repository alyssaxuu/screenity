// Install chrome.* shims before any recorder module loads.
import { installChromeShims } from "./chromeShim";
installChromeShims();

const relayErrorToSW = (source, payload) => {
  chrome.runtime
    .sendMessage({ type: "offscreen-diag", source, payload })
    .catch(() => {});
};

window.addEventListener("error", (e) => {
  relayErrorToSW("window.error", {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno,
    stack: e.error?.stack || null,
  });
});

window.addEventListener("unhandledrejection", (e) => {
  relayErrorToSW("unhandledrejection", {
    reason: String(e.reason),
    stack: e.reason?.stack || null,
  });
});

// Ping the SW every 20s while this offscreen doc is alive so it doesn't hit
// the 30s idle timeout. A dead SW loses the stop/finalize handoff mid-recording.
const SW_KEEPALIVE_MS = 20000;
const swKeepaliveTimer = setInterval(() => {
  chrome.runtime
    .sendMessage({ type: "sw-keepalive" })
    .catch(() => {});
}, SW_KEEPALIVE_MS);
window.addEventListener("pagehide", () => clearInterval(swKeepaliveTimer));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "resume-pending-uploads" && Array.isArray(msg.journals)) {
    (async () => {
      try {
        const { resumeAllJournals } = await import("./resumeJournal");
        const results = await resumeAllJournals(msg.journals);
        sendResponse({ ok: true, results });
      } catch (err) {
        console.error("[OffscreenRecorder] resume failed:", err);
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
  return false;
});

import React from "react";
import { createRoot } from "react-dom/client";
import OffscreenRecorder from "./OffscreenRecorder";

const container = window.document.querySelector("#app-container");

if (container) {
  try {
    const root = createRoot(container);
    root.render(<OffscreenRecorder />);
  } catch (err) {
    console.error("[Screenity][OffscreenRecorder] render error:", err);
  }
}

if (module.hot) {
  module.hot.accept();
}
