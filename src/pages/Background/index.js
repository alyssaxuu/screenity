import { initializeListeners } from "./listeners";
import { setupHandlers } from "./messaging/handlers";
import {
  messageRouter,
  messageDispatcher,
} from "../../messaging/messageRouter";
import { hydrateDiagnosticLog, diagEvent } from "../utils/diagnosticLog";

// Clear any storage flags that act as in-progress locks and could have been
// left in a "true" state if the service worker was killed mid-operation.
// Must run before any message handler or alarm handler has a chance to bail
// out on a stale lock.  Storage reads/writes are fast enough that they
// complete well before any queued event is dispatched to the worker.
const clearStaleLocks = async () => {
  try {
    const {
      sendingChunks,
      postStopEditorOpening,
      postStopEditorOpened,
      recording,
      multiMode,
      region,
    } = await chrome.storage.local.get([
      "sendingChunks",
      "postStopEditorOpening",
      "postStopEditorOpened",
      "recording",
      "multiMode",
      "region",
    ]);

    const stale = {};
    if (sendingChunks) {
      stale.sendingChunks = false;
      console.warn("[Screenity][BG] Stale lock found on startup: sendingChunks — clearing");
    }
    if (postStopEditorOpening) {
      stale.postStopEditorOpening = false;
      console.warn("[Screenity][BG] Stale lock found on startup: postStopEditorOpening — clearing");
    }
    if (postStopEditorOpened) {
      stale.postStopEditorOpened = false;
      console.warn("[Screenity][BG] Stale lock found on startup: postStopEditorOpened — clearing");
    }

    if (multiMode && !recording) {
      stale.multiMode = false;
      stale.multiSceneCount = 0;
      stale.multiProjectId = null;
      stale.multiLastSceneId = null;
      console.warn("[Screenity][BG] Stale multi-mode state found on startup — clearing");
    }

    if (region && !recording) {
      stale.region = false;
      console.warn("[Screenity][BG] Stale region state found on startup — clearing");
    }

    if (Object.keys(stale).length > 0) {
      await chrome.storage.local.set(stale);
      console.info(
        "[Screenity][BG] Startup stale locks cleared:",
        Object.keys(stale).join(", "),
      );
    }
  } catch (err) {
    console.error("[Screenity][BG] Failed to clear stale startup locks:", err);
  }
};

// Event listeners must be registered synchronously at module evaluation time
// so Chrome counts them for service worker keep-alive.
messageRouter();
initializeListeners();
setupHandlers();

// Fire-and-forget: clears stale locks from a previous crashed session.
// Runs after listener registration (required synchronous) but before Chrome
// can dispatch any queued events to this worker.
clearStaleLocks();

// Hydrate the diagnostic log from storage and record that the SW (re)started.
hydrateDiagnosticLog().then(() => {
  diagEvent("sw-init", { ts: Date.now() });
});
