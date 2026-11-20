// Install chrome.* shims before any recorder module loads.
import { installChromeShims } from "./chromeShim";
import { installTakeFrame } from "./takeFrameRouting";
import { createRecorderHost } from "./recorderHostShell";
installChromeShims();

const DOC_PARAMS = new URLSearchParams(window.location.search);
// A take frame inside the host document, or the host document itself.
const TAKE_ID = DOC_PARAMS.get("take");
const IS_HOST_DOC = DOC_PARAMS.get("host") === "1";
if (TAKE_ID) installTakeFrame({ takeId: TAKE_ID });

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
const swKeepaliveTimer = TAKE_ID ? null : setInterval(() => {
  chrome.runtime
    .sendMessage({ type: "sw-keepalive" })
    .catch(() => {});
}, SW_KEEPALIVE_MS);
window.addEventListener("pagehide", () => clearInterval(swKeepaliveTimer));
// The SW watches the document, not a take: a frame going away is a take ending.

// Lets the SW tell a close it issued from this document vanishing on its own.
let hostPortStopped = false;
window.addEventListener("pagehide", () => {
  hostPortStopped = true;
});
const connectHostPort = () => {
  if (hostPortStopped || TAKE_ID) return;
  try {
    const port = chrome.runtime.connect({ name: "recorder-host" });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      setTimeout(connectHostPort, 2000);
    });
  } catch {}
};
connectHostPort();

const IS_RESUME_DOC = DOC_PARAMS.get("resume") === "1";

if (IS_HOST_DOC) createRecorderHost();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Resume can stop anywhere: the next pass re-reads the server offset and
  // settles from the snapshot. Waiting only stalls the next recording's start.
  if (msg?.type === "offscreen-shutdown" && IS_RESUME_DOC) {
    chrome.runtime
      .sendMessage({ type: "offscreen-shutdown-complete" })
      .catch(() => {});
    return false;
  }
  if (
    msg?.type === "resume-pending-uploads" &&
    Array.isArray(msg.journals) &&
    !TAKE_ID
  ) {
    (async () => {
      try {
        const { resumeAllJournals } = await import("./resumeJournal");
        const { results, recovered, retry } = await resumeAllJournals(
          msg.journals,
          Array.isArray(msg.sessions) ? msg.sessions : [],
        );
        sendResponse({ ok: true, results, recovered, retry });
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

if (container && !IS_HOST_DOC) {
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
