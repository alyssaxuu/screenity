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

// One-time migration for users upgrading from 4.3.7. The finalize-hang bug on
// abrupt stream end caused sticky-disable to fire for many WebCodecs users;
// the underlying cause is fixed in this release (fragmented MP4 + streaming),
// so the sticky flags are no longer warranted and should be cleared once so
// affected users get WebCodecs again on their next recording. The user's
// explicit opt-out (useWebCodecsRecorder === false) is preserved.
const CURRENT_MIGRATION_VERSION = "4.3.8";
const runUpgradeMigrations = async () => {
  try {
    const { screenityMigratedForVersion } = await chrome.storage.local.get([
      "screenityMigratedForVersion",
    ]);
    if (screenityMigratedForVersion === CURRENT_MIGRATION_VERSION) return;

    await chrome.storage.local.remove([
      "fastRecorderDisabledForDevice",
      "fastRecorderDisabledReason",
      "fastRecorderDisabledAt",
      "fastRecorderDisabledDetails",
      "fastRecorderValidationFailed",
      "fastRecorderValidation",
      "lastWebCodecsFailureAt",
      "lastWebCodecsFailureCode",
      "lastFailedValidation",
    ]);
    await chrome.storage.local.set({
      screenityMigratedForVersion: CURRENT_MIGRATION_VERSION,
    });
    console.info(
      "[Screenity][BG] Cleared stale 4.3.7 sticky-disable flags on upgrade",
    );
  } catch (err) {
    console.error("[Screenity][BG] Upgrade migration failed:", err);
  }
};
runUpgradeMigrations();

// Hydrate the diagnostic log from storage and record that the SW (re)started.
hydrateDiagnosticLog().then(() => {
  diagEvent("sw-init", { ts: Date.now() });
});
