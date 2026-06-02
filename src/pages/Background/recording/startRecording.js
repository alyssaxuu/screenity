import { sendMessageRecord } from "./sendMessageRecord";
import { sendMessageTab } from "../tabManagement";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { initDiagSession, diagEvent } from "../../utils/diagnosticLog";
import { makeRecordingAttemptId } from "../../utils/errorCodes";
import { lifecycle } from "../../utils/lifecycleLog";
import { sweepRecorderTabs } from "./sweepRecorderTabs";
import { emitRecordingTelemetry } from "./emitRecordingTelemetry";

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

// a real back-to-back always goes through the 3s countdown, so a countdown-
// finished start landing sooner than this after stop is stale.
const STALE_START_WINDOW_MS = 3000;

const _startRecordingInner = async (caller) => {
  const recordingAttemptId = makeRecordingAttemptId();
  // only gate countdown-finished; direct/fallback/restart don't share it.
  try {
    const {
      recordingStoppedAt,
      recording,
      restarting,
      countdownStartedAt,
      countdownFinishedAt,
    } = await chrome.storage.local.get([
      "recordingStoppedAt",
      "recording",
      "restarting",
      "countdownStartedAt",
      "countdownFinishedAt",
    ]);
    const sinceStopMs =
      typeof recordingStoppedAt === "number"
        ? Date.now() - recordingStoppedAt
        : null;
    // Countdown after prior stop = fresh back-to-back, not stale dispatch.
    const countdownIsFresh =
      typeof recordingStoppedAt === "number" &&
      ((typeof countdownStartedAt === "number" &&
        countdownStartedAt > recordingStoppedAt) ||
        (typeof countdownFinishedAt === "number" &&
          countdownFinishedAt > recordingStoppedAt));
    if (
      caller === "countdown-finished" &&
      sinceStopMs !== null &&
      sinceStopMs < STALE_START_WINDOW_MS &&
      !recording &&
      !restarting &&
      !countdownIsFresh
    ) {
      console.warn(
        "[Screenity][BG] startRecording aborted: prior recording stopped",
        sinceStopMs,
        "ms ago, caller:",
        caller,
      );
      try {
        chrome.storage.local.set({
          lastStartAborted: {
            ts: Date.now(),
            caller,
            sinceStopMs,
            reason: "rapid-restart-after-stop",
          },
          // clear so the start-in-flight guard stops shielding cleanup.
          recordingStartingAt: null,
          pendingRecording: false,
        });
      } catch {}
      return;
    }
  } catch {}
  // Diagnostic-only snapshot of residual state; runs async so it
  // doesn't block the actual start path. ~17-key storage read can
  // cost 30-80ms on a contended SW and there's no consumer that
  // needs it before we send "start-recording" to the recorder.
  (async () => {
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
  })();
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

  // One batched read for every flag this function consumes below. The
  // original code did six separate awaited gets (sandboxTab,
  // recordingToScene+multiMode, activeTab+recordingUiTabId, customRegion,
  // recordingType); under any storage contention that pile up to
  // 150-300ms of pure round-trip overhead on the countdown→record path.
  const _startReads = chrome.storage.local.get([
    "sandboxTab",
    "recordingToScene",
    "multiMode",
    "activeTab",
    "recordingUiTabId",
    "customRegion",
    "recordingType",
  ]);

  // Close every prior editor tab by URL (sandboxTab only tracks the last).
  // OPFS wipes on new recording, so a stale editor would read missing data.
  try {
    const editorUrls = [
      chrome.runtime.getURL("editor.html"),
      chrome.runtime.getURL("editorwebcodecs.html"),
      chrome.runtime.getURL("editorviewer.html"),
    ];
    const allTabs = await chrome.tabs.query({});
    const editorTabs = allTabs.filter(
      (t) =>
        t.id != null &&
        t.url &&
        editorUrls.some((prefix) => t.url.startsWith(prefix)),
    );
    if (editorTabs.length > 0) {
      // Best-effort: tell each editor to clear its beforeunload.
      // 100ms global race cap; we don't await per-tab so a single
      // unresponsive tab can't block start.
      await Promise.race([
        Promise.allSettled(
          editorTabs.map((t) =>
            chrome.tabs.sendMessage(t.id, { type: "editor-force-close" }),
          ),
        ),
        new Promise((r) => setTimeout(r, 100)),
      ]);
      // Fire all removes in parallel; failures are silent (tab may
      // have closed in the interim).
      for (const t of editorTabs) {
        chrome.tabs.remove(t.id).catch(() => {});
      }
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

  // Clear leaked sceneId so cloudrecorder doesn't tag new telemetry with it.
  // pendingSceneIndex owns its own lifecycle; null would crash its .includes().
  const {
    recordingToScene,
    multiMode,
    activeTab,
    recordingUiTabId,
    customRegion,
    recordingType,
  } = await _startReads;
  try {
    if (!recordingToScene && !multiMode) {
      // Fire-and-forget: the clear doesn't gate the recorder-start
      // message below; the recorder reads sceneId at its own preflight.
      chrome.storage.local.set({
        sceneId: null,
        sceneIdStatus: null,
      });
    }
  } catch {}
  if (recordingUiTabId != null) {
    chrome.storage.local.set({ recordingUiTabId });
  } else if (activeTab != null) {
    chrome.storage.local.set({ recordingUiTabId: activeTab });
  }

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

  // Fire-and-forget beacon before the recorder tab exists, so sessions
  // that die early still leave a server-side breadcrumb. Skipped for
  // anonymous users to avoid 401 spam.
  void (async () => {
    try {
      const tokenSnap = await chrome.storage.local.get(["screenityToken"]);
      if (!tokenSnap?.screenityToken) return;
      const [extras, tabs, wins] = await Promise.all([
        chrome.storage.local.get([
          "screenityUser",
          "fpsValue",
          "cameraActive",
          "micActive",
          "recordedTabDomain",
        ]),
        chrome.tabs.query({}).catch(() => []),
        chrome.windows.getAll({}).catch(() => []),
      ]);
      const userObj = extras?.screenityUser || null;
      await emitRecordingTelemetry("recording_initiated_beacon", {
        recordingSessionId: recordingAttemptId,
        userIdHint: userObj?._id || userObj?.id || null,
        userAgentFull:
          typeof navigator !== "undefined" && navigator.userAgent
            ? String(navigator.userAgent).slice(0, 256)
            : null,
        platformFull:
          typeof navigator !== "undefined" && navigator.platform
            ? String(navigator.platform).slice(0, 64)
            : null,
        hardwareConcurrency: Number.isFinite(navigator?.hardwareConcurrency)
          ? navigator.hardwareConcurrency
          : null,
        recordingType: recordingType || "screen",
        qualityValue: quality || null,
        fpsValue: extras?.fpsValue || null,
        cameraActive: Boolean(extras?.cameraActive),
        micActive: Boolean(extras?.micActive),
        systemAudio: Boolean(systemAudio),
        multiMode: Boolean(multiMode),
        tabsCount: Array.isArray(tabs) ? tabs.length : null,
        windowsCount: Array.isArray(wins) ? wins.length : null,
        recordedTabDomain: extras?.recordedTabDomain || null,
      });
    } catch {}
  })();

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
