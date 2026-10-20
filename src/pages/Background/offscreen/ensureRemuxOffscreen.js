import { noteOffscreenClose } from "./hostWatch";
/*
 * Creates or reuses the remux offscreen document. Chrome only permits one
 * offscreen document per extension; if a different offscreen (audio beeps,
 * cloud-upload resume) is currently open, we close it first.
 *
 * The remux offscreen uses the WORKERS reason so it can spawn a dedicated
 * worker that calls createSyncAccessHandle() on OPFS, which is only
 * available in Dedicated Workers.
 */
const REMUX_OFFSCREEN_URL = "remuxoffscreen.html";

// Concurrent remux requests each passed the check below and called createDocument.
// Chrome permits one document, so the loser fell back to slow in-editor BufferTarget.
let inFlightEnsure = null;

export const ensureRemuxOffscreen = () => {
  if (inFlightEnsure) return inFlightEnsure;
  inFlightEnsure = ensureRemuxOffscreenImpl().finally(() => {
    inFlightEnsure = null;
  });
  return inFlightEnsure;
};

const ensureRemuxOffscreenImpl = async () => {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
    throw new Error("offscreen-api-unavailable");
  }

  // The recorder offscreen tears down asynchronously right after a recording
  // stops, so a download fired immediately after can still see it present.
  // Poll for it to finish closing (~7s) before giving up, so a just-recorded
  // download still gets the streaming OPFS remux/encode instead of the slow
  // in-editor BufferTarget fallback. We never displace the recorder ourselves:
  // closing it mid-capture kills the recording and aborts TUS finalize.
  const waitDelaysMs = [0, 500, 1000, 1500, 2000, 2000];
  for (let i = 0; i < waitDelaysMs.length; i += 1) {
    if (waitDelaysMs[i] > 0) {
      await new Promise((r) => setTimeout(r, waitDelaysMs[i]));
    }
    const contexts = await chrome.runtime.getContexts({});
    const existing = contexts.find(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT",
    );
    if (!existing) break;
    const existingUrl =
      typeof existing.documentUrl === "string" ? existing.documentUrl : "";
    if (existingUrl.endsWith(REMUX_OFFSCREEN_URL)) return;
    if (existingUrl.includes("offscreenrecorder.html")) {
      // Recorder still closing; wait and retry. Give up only on the last try.
      if (i === waitDelaysMs.length - 1) {
        throw new Error("offscreen-busy-recorder");
      }
      continue;
    }
    // A different offscreen (audio beep / upload resume): close it and proceed.
    try {
      noteOffscreenClose("remux-preclose");
      await chrome.offscreen.closeDocument();
    } catch (err) {
      console.warn("ensureRemuxOffscreen: closeDocument failed", err);
    }
    break;
  }

  try {
    await chrome.offscreen.createDocument({
      url: REMUX_OFFSCREEN_URL,
      reasons: ["WORKERS"],
      justification:
        "Re-mux fragmented MP4 recording to standard MP4 using a worker that writes to OPFS via a sync access handle.",
    });
  } catch (err) {
    // getContexts and createDocument are not atomic, so something can claim the
    // single slot in between. If what landed is ours, that is a success.
    const contexts = await chrome.runtime.getContexts({}).catch(() => []);
    const landed = contexts.find((c) => c.contextType === "OFFSCREEN_DOCUMENT");
    const landedUrl =
      typeof landed?.documentUrl === "string" ? landed.documentUrl : "";
    if (landedUrl.endsWith(REMUX_OFFSCREEN_URL)) return;
    throw err;
  }
};
