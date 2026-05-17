import { sendMessageRecord } from "./sendMessageRecord";
import { sendMessageTab } from "../tabManagement";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { initDiagSession, diagEvent } from "../../utils/diagnosticLog";
import { makeRecordingAttemptId } from "../../utils/errorCodes";
import { lifecycle } from "../../utils/lifecycleLog";
import { sweepRecorderTabs } from "./sweepRecorderTabs";

// `recording` flag isn't set until the recorder iframe inits (seconds later),
// so countdown-finished + 8s fallback can both fire and open two recorder tabs
let _startRecordingInFlight = false;
const STARTRECORDING_GUARD_TIMEOUT_MS = 30000;
let _startRecordingGuardTimer = null;
const releaseStartRecordingGuard = () => {
  _startRecordingInFlight = false;
  if (_startRecordingGuardTimer) {
    clearTimeout(_startRecordingGuardTimer);
    _startRecordingGuardTimer = null;
  }
  // mirrored to storage so listeners (onTabRemoved, sendMessageRecord)
  // can tell start-in-flight apart from idle
  chrome.storage.local.set({ recordingStartingAt: null }).catch(() => {});
};
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.recording && changes.recording.newValue === true) {
      releaseStartRecordingGuard();
    }
    if (
      changes.recording &&
      changes.recording.oldValue === true &&
      changes.recording.newValue === false
    ) {
      releaseStartRecordingGuard();
    }
  });
} catch {}

// matches STARTRECORDING_GUARD_TIMEOUT_MS so a crashed start eventually
// stops shielding cleanup
export const RECORDING_STARTING_GRACE_MS = 30000;
export const isRecordingStartInFlight = (flags) => {
  if (!flags) return false;
  if (flags.pendingRecording) return true;
  if (flags.restarting) return true;
  const at = flags.recordingStartingAt;
  if (typeof at === "number" && Date.now() - at < RECORDING_STARTING_GRACE_MS) {
    return true;
  }
  return false;
};

export const startRecording = async (caller = "unknown") => {
  if (_startRecordingInFlight) {
    diagEvent("warning", {
      note: "startRecording suppressed (in-flight)",
      caller,
    });
    return;
  }
  _startRecordingInFlight = true;
  _startRecordingGuardTimer = setTimeout(
    releaseStartRecordingGuard,
    STARTRECORDING_GUARD_TIMEOUT_MS,
  );
  try {
    return await _startRecordingInner(caller);
  } catch (err) {
    // sync failure before sendMessageRecord's deferred catch; release immediately
    releaseStartRecordingGuard();
    throw err;
  }
};

const _startRecordingInner = async (caller) => {
  const recordingAttemptId = makeRecordingAttemptId();
  // snapshot residual state to spot leaked flags from prior recordings
  try {
    const residual = await chrome.storage.local.get([
      "recordingTab",
      "recordingUiTabId",
      "tabRecordedID",
      "sandboxTab",
      "region",
      "customRegion",
      "recordingType",
      "recording",
      "pendingRecording",
      "restarting",
      "offscreen",
      "useWebCodecsRecorder",
      "fastRecorderInUse",
      "backup",
      "backupSetup",
      "backupTab",
      "memoryError",
    ]);
    lifecycle("BG.startRecording", "session-boundary", {
      caller,
      attemptId: recordingAttemptId,
      residual,
    });
  } catch {}
  let stack = null;
  try {
    stack = new Error().stack?.split("\n").slice(1, 6).join("\n") || null;
  } catch {}

  // set start-in-flight before any tab removal or message send below,
  // otherwise onTabRemoved/onTabUpdated fire with the flag still false
  // and tear down the recorder tab we're about to create
  await chrome.storage.local.set({
    recordingStartingAt: Date.now(),
  });

  // Close any prior editor tab. The OPFS writer wipes the previous
  // recording's file when a new one starts, so leaving the old editor
  // open with stale backing data is worse than closing it. The
  // editor-force-close message clears its beforeunload prompt first so
  // the user doesn't get a confirm dialog. The recordingStartingAt guard
  // above keeps the cascading cleanup off the new recorder tab.
  try {
    const { sandboxTab: priorSandboxTab } = await chrome.storage.local.get([
      "sandboxTab",
    ]);
    if (Number.isInteger(priorSandboxTab)) {
      try {
        await Promise.race([
          chrome.tabs.sendMessage(priorSandboxTab, {
            type: "editor-force-close",
          }),
          new Promise((r) => setTimeout(r, 250)),
        ]);
      } catch {}
      chrome.tabs.remove(priorSandboxTab).catch(() => {});
    }
  } catch {}

  chrome.storage.local.set({
    restarting: false,
    recordingAttemptId,
    memoryError: false,
    cloudRecorderDegradedMode: null,
    editorRecordingError: null,
    editorReadyAt: null,
    editorReadyPath: null,
    // prior sandboxTab would route this attempt's errors to the wrong editor
    sandboxTab: null,
    // paused leak from a prior errored recording would mis-account duration
    paused: false,
    pausedAt: null,
    totalPausedMs: 0,
    // recorder writes a fresh ref on open; clear so a pre-writer failure
    // doesn't leave a later editor reading the prior recording's data
    lastRecordingBackendRef: null,
    // clear so the prior recording's "ready" signal can't trick the
    // editor into reading the new in-flight recording
    lastRecordingFinalizedFileName: null,
    lastRecordingError: null,
    lastChunkSendFailure: null,
    lastStartRecordingCaller: { caller, stack, ts: Date.now() },
  });

  // A standalone (non-scene, non-multi) recording must not inherit a sceneId
  // from a previous recording. The cloudrecorder reads chrome.storage sceneId
  // at start; a leaked value tags the new recording's telemetry and upload
  // sessions with the prior recording's identity (the back-to-back sceneId
  // leak). Scene and multi-scene recordings legitimately carry sceneId across
  // the boundary. NOTE: only sceneId/sceneIdStatus are cleared — never
  // pendingSceneIndex: it is an array consumed via a `= []` destructuring
  // default (upsertPendingScene), and a default only covers `undefined`, not
  // `null`. Setting it null makes `pendingSceneIndex.includes()` throw and
  // crashes the next recorder. Its own upsert/remove lifecycle manages it.
  try {
    const { recordingToScene, multiMode } = await chrome.storage.local.get([
      "recordingToScene",
      "multiMode",
    ]);
    if (!recordingToScene && !multiMode) {
      await chrome.storage.local.set({
        sceneId: null,
        sceneIdStatus: null,
      });
    }
  } catch {}

  const { activeTab, recordingUiTabId } = await chrome.storage.local.get([
    "activeTab",
    "recordingUiTabId",
  ]);
  if (recordingUiTabId != null) {
    chrome.storage.local.set({ recordingUiTabId });
  } else if (activeTab != null) {
    chrome.storage.local.set({ recordingUiTabId: activeTab });
  }

  const { customRegion } = await chrome.storage.local.get(["customRegion"]);

  const { recordingType } = await chrome.storage.local.get(["recordingType"]);

  if (recordingType === "region" || recordingType === "tab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        const title = tab.title || "";
        const url = tab.url || "";
        chrome.storage.local.set({
          recordingMeta: {
            type: "tab",
            title,
            url,
            startedAt: Date.now(),
          },
        });
      }

      if (tab && tab.url) {
        try {
          const url = new URL(tab.url);
          let hostname = url.hostname;

          if (hostname.startsWith("www.")) {
            hostname = hostname.slice(4);
          }

          chrome.storage.local.set({ recordedTabDomain: hostname });
        } catch (e) {
          console.warn("Could not parse tab URL for domain:", e);
        }
      }
    });
  } else {
    chrome.storage.local.remove(["recordingMeta"]);
  }

  chrome.storage.local.set({ lastRecordingType: recordingType || "screen" });

  const { quality, systemAudio, audioInput, backup, offscreen, alarm, alarmTime, countdown } =
    await chrome.storage.local.get([
      "quality",
      "systemAudio",
      "audioInput",
      "backup",
      "offscreen",
      "alarm",
      "alarmTime",
      "countdown",
    ]);
  await initDiagSession({
    recordingAttemptId,
    recordingType: recordingType || "screen",
    quality: quality || null,
    region: Boolean(customRegion),
    systemAudio: Boolean(systemAudio),
    audioInput: Boolean(audioInput),
    backup: Boolean(backup),
    offscreen: Boolean(offscreen),
    alarm: Boolean(alarm),
    alarmTime: alarm ? (alarmTime || null) : null,
    countdown: Boolean(countdown),
  });
  // sync log so the event flushes to storage before SW can be killed
  diagEvent("session-start", { region: Boolean(customRegion), caller });

  const { recordingTab: prevRecTab } = await chrome.storage.local.get([
    "recordingTab",
  ]);
  if (prevRecTab != null) {
    try {
      await chrome.tabs.get(prevRecTab);
    } catch {
      diagEvent("stale-recording-tab-cleared", { prevRecTab });
      chrome.storage.local.set({ recordingTab: null });
    }
  }

  const startMsg = customRegion
    ? { type: "start-recording-tab", region: true }
    : { type: "start-recording-tab" };

  sendMessageRecord(startMsg).catch((err) => {
    const errStr = String(err).slice(0, 120);
    const isStaleTab =
      errStr.includes("Receiving end does not exist") ||
      errStr.includes("No tab with id") ||
      errStr.includes("No recording tab available");
    // sendMessage can reject "message port closed" even on a healthy start; re-check
    setTimeout(async () => {
      let isReallyRecording = false;
      try {
        const snap = await chrome.storage.local.get([
          "recording",
          "pendingRecording",
        ]);
        isReallyRecording = Boolean(snap.recording);
      } catch {}
      if (isReallyRecording) return;
      diagEvent("start-fail", {
        region: Boolean(customRegion),
        error: errStr,
        staleTab: isStaleTab,
      });
      releaseStartRecordingGuard();
      chrome.storage.local.set({
        pendingRecording: false,
        restarting: false,
        recording: false,
        recordingTab: null,
      });
      chrome.storage.local.get(["activeTab"], ({ activeTab }) => {
        if (activeTab) {
          sendMessageTab(activeTab, {
            type: "recording-error",
            error: "start-failed",
            why: isStaleTab
              ? "stale-recorder-tab"
              : "recorder-tab-unavailable",
          }).catch(() => {});
        }
      });
      // releases the desktopCapture stream so Chrome's "Stop sharing" bar goes away
      discardOffscreenDocuments({ reason: "start-fail" }).catch(() => {});
      // a recorder tab may have been created before the start failed;
      // sweep it so it can't keep capturing unattended
      sweepRecorderTabs().catch(() => {});
      chrome.action.setIcon({ path: "assets/icon-34.png" });
    }, 2500);
  });
  chrome.action.setIcon({ path: "assets/recording-logo.png" });
  // chrome.alarms 30s minimum in prod; sub-30s silently bumps or never fires
  if (alarm) {
    const seconds = parseFloat(alarmTime);
    if (Number.isFinite(seconds) && seconds > 0) {
      const delayInMinutes = Math.max(seconds / 60, 0.5);
      chrome.alarms.create("recording-alarm", { delayInMinutes });
    }
  }
};

export const startAfterCountdown = (caller = "startAfterCountdown") => {
  chrome.storage.local.get(["recordingTab", "offscreen"], (result) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Failed to start after countdown:",
        chrome.runtime.lastError
      );
      return;
    }

    const { recordingTab, offscreen } = result || {};
    chrome.storage.local.set({
      lastStartAfterCountdown: {
        ts: Date.now(),
        recordingTab: recordingTab ?? null,
        offscreen: Boolean(offscreen),
      },
    });

    // sendMessageRecord routes via recorderSession/offscreen fallback if needed
    if (recordingTab === null && !offscreen) {
      console.warn(
        "[Screenity] startAfterCountdown: no recordingTab/offscreen available, starting with fallback routing"
      );
    }
    startRecording(caller);
  });
};
