import { sendMessageRecord } from "./sendMessageRecord";
import { sendMessageTab } from "../tabManagement";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { initDiagSession, diagEvent } from "../../utils/diagnosticLog";
import { withAttemptLock, releaseAttemptClaim } from "./attemptLock";
import { makeRecordingAttemptId } from "../../utils/errorCodes";
import { lifecycle } from "../../utils/lifecycleLog";
import { sweepRecorderTabs } from "./sweepRecorderTabs";
import { emitRecordingTelemetry } from "./emitRecordingTelemetry";
import { noteTakeStart, noteTakeEvent } from "./adaptiveHistory";
import { retainedTabIdsFor } from "./recordingRetention";
import { awaitPendingEditorRegistrations } from "./editorRegistration";
import {
  RECHECK_INTERVAL_MS,
  isWatchedStart,
  judgeStartRecheck,
  START_WATCH_MAX_MS,
} from "./startRecheck";

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

export const startRecording = async (caller = "unknown", countdownId = null) => {
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
    return await _startRecordingInner(caller, countdownId);
  } catch (err) {
    // sync failure before sendMessageRecord's deferred catch; release immediately
    releaseStartRecordingGuard();
    throw err;
  }
};

// a real back-to-back always goes through the 3s countdown, so a countdown-
// finished start landing sooner than this after stop is stale.
const STALE_START_WINDOW_MS = 3000;

const _startRecordingInner = async (caller, countdownId) => {
  // A click-time claim already put this take's id in storage; reuse it.
  let recordingAttemptId = null;
  let consumedClaim = false;
  try {
    const claim = await withAttemptLock(() =>
      chrome.storage.local.get(["recordingAttemptClaimed", "recordingAttemptId"]),
    );
    if (claim?.recordingAttemptClaimed && claim.recordingAttemptId) {
      recordingAttemptId = claim.recordingAttemptId;
      consumedClaim = true;
    }
  } catch {}
  if (!recordingAttemptId) recordingAttemptId = makeRecordingAttemptId();
  void noteTakeStart(recordingAttemptId);
  // only gate countdown-finished; direct/fallback/restart don't share it.
  try {
    const {
      recordingStoppedAt,
      recording,
      restarting,
      pendingRecording,
      activeCountdownId,
      countdownStartedAt,
      countdownFinishedAt,
    } = await chrome.storage.local.get([
      "recordingStoppedAt",
      "recording",
      "restarting",
      "pendingRecording",
      "activeCountdownId",
      "countdownStartedAt",
      "countdownFinishedAt",
    ]);
    // The error can arrive after the countdown handler's check but before
    // this async dispatch reads storage. Do not revive that failed start.
    const countdownDispatch = caller === "countdown-finished" ||
      caller === "countdownFallback" || caller === "countdownFallback-sw-restart";
    if ((typeof countdownId === "string" && countdownId && countdownId !== activeCountdownId) ||
      (countdownDispatch && pendingRecording === false && !restarting)) {
      if (consumedClaim) releaseAttemptClaim(recordingAttemptId).catch(() => {});
      releaseStartRecordingGuard();
      return;
    }
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
      if (consumedClaim) releaseAttemptClaim(recordingAttemptId).catch(() => {});
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

  // Computed before the sweep below, because it decides which editor tabs are
  // holding a recording that survives and therefore must stay open.
  let retainedTabIds = new Set();
  try {
    // Read, not recomputed. startRecorderSession published this before the
    // recorder acted on it, and a second answer here would disagree.
    const stored = await chrome.storage.local.get(["retentionPlan"]);
    // An editor opened for an earlier take's late video-ready may still be
    // registering; unregistered, the sweep below would close it.
    await awaitPendingEditorRegistrations();
    retainedTabIds = await retainedTabIdsFor(stored?.retentionPlan);
  } catch (err) {
    // Retention is best-effort. A failure here must not stop a recording, and
    // falling through means the old wipe-everything behaviour.
    console.warn("[Screenity][BG] retention plan failed", err);
  }

  // sandboxTab only tracks the last tab, so match by URL instead. Skip tabs
  // holding a kept recording: closing one drops its only copy.
  try {
    // editor.html covers viewer mode too (editor.html?view=1); startsWith match.
    const editorUrls = [chrome.runtime.getURL("editor.html")];
    const allTabs = await chrome.tabs.query({});
    const editorTabs = allTabs.filter(
      (t) =>
        t.id != null &&
        !retainedTabIds.has(t.id) &&
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

  // Awaited and serialized with the guarded clears: a late video-ready from the
  // previous take compares against this.
  await withAttemptLock(async () => {
    // Consume the claim here, in the locked write. A newer click may have
    // claimed since this start read its id; that claim and its id stay.
    const cur = await chrome.storage.local.get(["recordingAttemptClaimed", "recordingAttemptId"]);
    const newerClaim = Boolean(cur.recordingAttemptClaimed) && cur.recordingAttemptId !== recordingAttemptId;
    await chrome.storage.local.set({
    restarting: false,
    ...(newerClaim
      ? {}
      : { recordingAttemptId, recordingAttemptClaimed: false, recordingAttemptPrevId: null }),
    memoryError: false,
    cloudRecorderDegradedMode: null,
    editorRecordingError: null,
    editorReadyAt: null,
    editorReadyPath: null,
    // re-arm count is per-attempt; a leaked one would fail this recording early
    firstChunkWatchdogState: null,
    // prior sandboxTab would route this attempt's errors to the wrong editor
    sandboxTab: null,
    // a prior recording's track-end would be blamed for this attempt in reports
    lastTrackEndEvent: null,
    // a toolbar left on 'reconnecting' by a take that ended mid-window
    micReconnecting: false,
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
    // Stale counters make a genuine start failure read as "recorder was alive"
    // in the stuck report.
    recorderLiveProgress: null,
    lastChunkSendFailure: null,
    lastRecordingSalvaged: null,
    lastStartRecordingCaller: { caller, stack, ts: Date.now() },
    });
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
    chrome.storage.local.remove(["recordingMeta", "recordedTabDomain"]);
  }

  chrome.storage.local.set({ lastRecordingType: recordingType || "screen" });

  const {
    quality,
    systemAudio,
    micActive,
    defaultAudioInput,
    offscreen,
    alarm,
    alarmTime,
    countdown,
  } =
    await chrome.storage.local.get([
      "quality",
      "systemAudio",
      "micActive",
      "defaultAudioInput",
      "offscreen",
      "alarm",
      "alarmTime",
      "countdown",
    ]);
  await initDiagSession({
    recordingAttemptId,
    // Chrome major pins each session to a version so the local diagnostic
    // zip can be read against version-gated browser fixes.
    browserMajor: (() => {
      const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
      const m = ua.match(/Chrome\/([0-9]+)/);
      return m ? parseInt(m[1], 10) : null;
    })(),
    recordingType: recordingType || "screen",
    quality: quality || null,
    region: Boolean(customRegion),
    systemAudio: Boolean(systemAudio),
    // Was "audioInput", a key nothing ever wrote, so this always logged false.
    audioInput: Boolean(micActive) && defaultAudioInput !== "none",
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
          "qualityValue",
          "fpsValue",
          "cameraActive",
          "micActive",
          "instantMode",
          "backgroundEffectsActive",
          "recordedTabDomain",
          "pendingClickBeacon",
        ]),
        chrome.tabs.query({}).catch(() => []),
        chrome.windows.getAll({}).catch(() => []),
      ]);
      const userObj = extras?.screenityUser || null;
      // Single-use: consume it here so a stale click never gets attributed
      // to a later, unrelated start (keyboard shortcut, restart, etc).
      chrome.storage.local.remove(["pendingClickBeacon"]);
      const pendingClick = extras?.pendingClickBeacon;
      const clickId =
        pendingClick && Date.now() - pendingClick.at < 30000
          ? pendingClick.clickId
          : null;
      const startContext = {
        ts: Date.now(),
        recordingType: recordingType || "screen",
        cameraActive: Boolean(extras?.cameraActive),
        micActive: Boolean(extras?.micActive),
        systemAudio: Boolean(systemAudio),
        backgroundEffectsActive: Boolean(extras?.backgroundEffectsActive),
        tabsCount: Array.isArray(tabs) ? tabs.length : null,
        windowsCount: Array.isArray(wins) ? wins.length : null,
        hardwareConcurrency: Number.isFinite(navigator?.hardwareConcurrency)
          ? navigator.hardwareConcurrency
          : null,
      };
      await chrome.storage.local.set({ lastRecordingStartContext: startContext });
      await emitRecordingTelemetry("recording_initiated_beacon", {
        recordingSessionId: recordingAttemptId,
        clickId,
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
        // Covers attempts that die before the recorder's heartbeat reports it.
        deviceMemoryGb: Number.isFinite(navigator?.deviceMemory)
          ? navigator.deviceMemory
          : null,
        recordingType: startContext.recordingType,
        // Storage canonical key is qualityValue, not quality. `quality`
        // is unset on this read path; reading it returned undefined and
        // surfaced as null on every beacon.
        qualityValue: extras?.qualityValue || null,
        fpsValue: extras?.fpsValue || null,
        cameraActive: startContext.cameraActive,
        micActive: startContext.micActive,
        systemAudio: startContext.systemAudio,
        multiMode: Boolean(multiMode),
        instantMode: Boolean(extras?.instantMode),
        backgroundEffectsActive: startContext.backgroundEffectsActive,
        tabsCount: startContext.tabsCount,
        windowsCount: startContext.windowsCount,
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
    ? { type: "start-recording-tab", region: true, recordingAttemptId }
    : { type: "start-recording-tab", recordingAttemptId };

  const startDispatchedAt = Date.now();
  // The guard timer began at entry; slow setup must not let it lapse before
  // the watch's own longest run.
  if (_startRecordingInFlight) {
    if (_startRecordingGuardTimer) clearTimeout(_startRecordingGuardTimer);
    _startRecordingGuardTimer = setTimeout(
      releaseStartRecordingGuard,
      START_WATCH_MAX_MS,
    );
  }

  // A reply is no proof of a start: "message port closed" can come from a
  // healthy start, and an accepted start can still wedge. Both get re-checked.
  const watchStart = (errStr) => {
    const isStaleTab =
      errStr.includes("Receiving end does not exist") ||
      errStr.includes("No tab with id") ||
      errStr.includes("No recording tab available");
    const recheck = async () => {
      let snap = {};
      try {
        snap = await chrome.storage.local.get([
          "recording",
          "pendingRecording",
          "lastTrackEndEvent",
          "recorderStartProgress",
          "lastRecordingError",
          "lastStartEndedAt",
          "recordingStoppedAt",
        ]);
      } catch {}
      const judged = judgeStartRecheck(snap, startDispatchedAt, Date.now());
      if (judged.verdict === "recording") return;
      // A second teardown here could hit the next take; just free the guard.
      if (judged.verdict === "ended") {
        releaseStartRecordingGuard();
        // A stop that ended in neither video-ready nor an error leaves the
        // pending flag and icon up. A newer click owns the flag.
        const cur = await chrome.storage.local.get([
          "pendingRecording",
          "pendingRecordingAt",
          "recording",
          "restarting",
        ]);
        const newerClick =
          typeof cur.pendingRecordingAt === "number" &&
          cur.pendingRecordingAt > startDispatchedAt;
        if (cur.pendingRecording && !cur.recording && !cur.restarting && !newerClick) {
          chrome.storage.local.set({ pendingRecording: false });
          chrome.action.setIcon({ path: "assets/icon-34.png" });
        }
        return;
      }
      // Still moving mid-start: a slow encoder probe outlasts one window, and
      // discarding the offscreen doc here is what killed the recording.
      if (judged.verdict === "wait") {
        setTimeout(recheck, RECHECK_INTERVAL_MS);
        return;
      }
      const { stage: stalledStage, stalledMs } = judged;
      if (stalledMs != null) {
        diagEvent("warning", {
          note: "start-fail after progress stalled",
          stage: stalledStage,
          stalledMs,
        });
      }
      // Stream came up then died (native Stop sharing, source window gone).
      // That handler already stopped it, so don't overwrite the real reason.
      if (judged.verdict === "stream-ended") {
        diagEvent("warning", {
          note: "start-fail suppressed, stream ended after start",
          reason: String(judged.trackEnd.reason || "").slice(0, 60),
          afterMs: judged.trackEnd.ts - startDispatchedAt,
        });
        releaseStartRecordingGuard();
        return;
      }
      diagEvent("start-fail", {
        region: Boolean(customRegion),
        error: errStr,
        staleTab: isStaleTab,
      });
      // diagEvent only reaches the local ring buffer, which is never uploaded.
      // reason is the one field that survives both telemetry allowlists.
      void emitRecordingTelemetry("recording_forensic_event", {
        recordingSessionId: recordingAttemptId,
        name: "start-fail-progress",
        reason: `start-progress-${stalledStage}`,
        stalledMs,
        elapsedMs: Date.now() - startDispatchedAt,
        errMsg: errStr,
      });
      void noteTakeEvent({ startFail: true });
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
    };
    setTimeout(recheck, RECHECK_INTERVAL_MS);
  };

  sendMessageRecord(startMsg).then(
    (reply) => {
      if (isWatchedStart(reply)) watchStart("accepted-no-progress");
      else if (reply?.ignored === "start-failed") releaseStartRecordingGuard();
    },
    (err) => watchStart(String(err).slice(0, 120))
  );
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

export const startAfterCountdown = (caller = "startAfterCountdown", countdownId = null) => {
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
    startRecording(caller, countdownId);
  });
};
