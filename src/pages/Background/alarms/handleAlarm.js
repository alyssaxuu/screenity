import { stopRecording } from "../recording/stopRecording.js";
import { sendMessageTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";
import { handleRecordingError } from "../recording/recordingHelpers.js";
import { sweepRecorderTabs } from "../recording/sweepRecorderTabs.js";
import { diagEvent } from "../../utils/diagnosticLog";
import { lifecycle } from "../../utils/lifecycleLog";
import { chunksStore } from "../recording/chunkHandler";
import { emitRecordingTelemetry } from "../recording/emitRecordingTelemetry";
import { markFastRecorderFailure } from "../../../media/fastRecorderGate";
import {
  CLOUD_LOCAL_PLAYBACK_KEY,
  CLOUD_LOCAL_PLAYBACK_EVENT_KEY,
  CLOUD_LOCAL_PLAYBACK_ALARM,
} from "../recording/cloudLocalPlaybackConstants";
import {
  FIRST_CHUNK_WATCHDOG_ALARM,
  RECORDER_KEEPALIVE_ALARM,
} from "./alarmConstants";

export { FIRST_CHUNK_WATCHDOG_ALARM, RECORDER_KEEPALIVE_ALARM };

// WebCodecs muxer only finalizes inside the recorder tab; without this salvage
// step the MP4 moov never gets written and chunks on disk are unplayable.
const STALL_RECOVERY_TIMEOUT_MS = 5000;
const attemptStallRecovery = (recordingTabId) => {
  return new Promise((resolve) => {
    if (!recordingTabId) {
      resolve(false);
      return;
    }
    let settled = false;
    const onMsg = (message) => {
      if (settled) return;
      if (message?.type === "video-ready") {
        settled = true;
        chrome.runtime.onMessage.removeListener(onMsg);
        resolve(true);
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    try {
      chrome.tabs.sendMessage(
        recordingTabId,
        { type: "stop-recording-tab", reason: "stall-recovery" },
        () => {
          // timeout below is authoritative; swallow lastError
          void chrome.runtime.lastError;
        },
      );
    } catch {}
    setTimeout(() => {
      if (settled) return;
      settled = true;
      chrome.runtime.onMessage.removeListener(onMsg);
      resolve(false);
    }, STALL_RECOVERY_TIMEOUT_MS);
  });
};

// `tab` fallback used when stored activeTab is stale (e.g. action-button click).
// Alarms pass null since no current tab is available.
const handleTabMessaging = async (tab) => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  try {
    const targetTab = await chrome.tabs.get(activeTab);

    if (targetTab) {
      sendMessageTab(activeTab, { type: "stop-recording-tab" });
    } else if (tab?.id) {
      sendMessageTab(tab.id, { type: "stop-recording-tab" });
      chrome.storage.local.set({ activeTab: tab.id });
    }
  } catch (error) {
    console.error("Error in handleTabMessaging:", error);
  }
};

// Coalesce stacked post-wake alarm ticks to one per 30s.
let _lastKeepaliveTickAt = 0;

export const handleAlarm = async (alarm) => {
  if (alarm.name === RECORDER_KEEPALIVE_ALARM) {
    const now = Date.now();
    if (now - _lastKeepaliveTickAt < 30_000) {
      // stacked post-wake tick; real alarms fire every 60s
      return;
    }
    _lastKeepaliveTickAt = now;

    const snap = await chrome.storage.local.get([
      "recordingTab",
      "recording",
      "pendingRecording",
      "paused",
      "firstChunkAt",
      "lastChunkAt",
      "recordingStallLevel",
    ]);
    if (!(snap.recording || snap.pendingRecording) || !snap.recordingTab) {
      await chrome.alarms.clear(RECORDER_KEEPALIVE_ALARM);
      await chrome.storage.local.set({
        recordingStallLevel: 0,
        firstChunkAt: null,
        lastChunkAt: null,
      });
      // Backstop: the session is over. Remove any recorder tab still
      // alive; a final guard if both the recorder's own abandonment
      // listener and the teardown sweep somehow missed it. Gated on no
      // active or in-flight recording so a fresh start is never killed.
      if (!snap.recording && !snap.pendingRecording) {
        const { recordingStartingAt } = await chrome.storage.local.get([
          "recordingStartingAt",
        ]);
        const startInFlight =
          typeof recordingStartingAt === "number" &&
          Date.now() - recordingStartingAt < 30_000;
        if (!startInFlight) {
          await sweepRecorderTabs();
        }
      }
      return;
    }

    try {
      await chrome.tabs.sendMessage(snap.recordingTab, {
        type: "recorder-keepalive-ping",
      });
    } catch {}

    const WATCHDOG_STALE_MS = 90_000; // chunks arrive every 2s; 45x headroom
    const notReady = !snap.firstChunkAt;
    const pausedNow = !!snap.paused;
    const age = now - (snap.lastChunkAt || 0);
    const stallLevel = snap.recordingStallLevel || 0;

    if (notReady || pausedNow || age < WATCHDOG_STALE_MS) {
      if (stallLevel !== 0) {
        await chrome.storage.local.set({ recordingStallLevel: 0 });
      }
      return;
    }

    if (stallLevel === 0) {
      diagEvent("recording-stall-detected", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
      void emitRecordingTelemetry("recording_stall_detected", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
      try {
        await chrome.tabs.sendMessage(snap.recordingTab, {
          type: "recorder-wake-aggressive",
        });
      } catch {}
      await chrome.storage.local.set({ recordingStallLevel: 1 });
      return;
    }

    if (stallLevel >= 1) {
      diagEvent("recording-stall-unrecoverable", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
      void emitRecordingTelemetry("recording_stall_unrecoverable", {
        ageMs: age,
        tabId: snap.recordingTab,
      });

      // partially hung tabs can still deliver via `video-ready`
      const recovered = await attemptStallRecovery(snap.recordingTab);
      if (recovered) {
        diagEvent("recording-stall-recovered", {
          ageMs: age,
          tabId: snap.recordingTab,
        });
        try {
          await chrome.storage.local.set({ recordingStallLevel: 0 });
        } catch {}
        return;
      }

      void emitRecordingTelemetry("recording_outcome", {
        outcome: "unrecoverable",
        ageMs: age,
        tabId: snap.recordingTab,
      });
      try {
        await chrome.alarms.clear(RECORDER_KEEPALIVE_ALARM);
      } catch {}
      try {
        await chrome.storage.local.set({
          recording: false,
          pendingRecording: false,
          recordingStallLevel: 0,
          firstChunkAt: null,
          lastChunkAt: null,
        });
      } catch {}
      try {
        await handleRecordingError({
          error: "stream-error",
          why: "Recording stopped: the recorder tab became unresponsive.",
          errorCode: "recording-stall-unrecoverable",
        });
      } catch (err) {
        console.warn("[Screenity][BG] stall-unrecoverable handler failed", err);
      }
      return;
    }
    return;
  }

  if (alarm.name === "recording-alarm") {
    const { recording } = await chrome.storage.local.get(["recording"]);

    if (recording) {
      diagEvent("alarm-fired");
      stopRecording();
      sendMessageRecord({ type: "stop-recording-tab" });
      await handleTabMessaging(null);
    }

    await chrome.alarms.clear("recording-alarm");
    return;
  }

  if (alarm.name === FIRST_CHUNK_WATCHDOG_ALARM) {
    const { recording } = await chrome.storage.local.get(["recording"]);
    if (recording) {
      diagEvent("error", { note: "first-chunk-watchdog-fired" });
      // Snapshot the recorder first (1500ms cap so a wedged tab can't delay the
      // user-facing error) so the disable and stop decisions can read the
      // capture track's state.
      let snapshot = null;
      let snapshotError = null;
      try {
        snapshot = await Promise.race([
          sendMessageRecord({ type: "recorder-state-snapshot" }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("snapshot-timeout")), 1500),
          ),
        ]);
      } catch (err) {
        snapshotError = err?.message || String(err);
      }
      lifecycle("BG.watchdog", "first-chunk-fired", {
        snapshot: snapshot || null,
        snapshotError,
      });
      try {
        await chrome.storage.local.set({
          lastFirstChunkWatchdog: {
            ts: Date.now(),
            snapshot: snapshot || null,
            snapshotError,
          },
        });
      } catch {}

      const vt = snapshot?.stream?.videoTrack || null;
      if (vt && vt.readyState === "live" && vt.muted === true) {
        // Capture track is live but muted: the recorded tab is backgrounded,
        // focus was lost, or the display slept, so no frames are arriving. That
        // is not an encoder defect, so don't disable WebCodecs and don't fail
        // the recording. It keeps running and the first chunk cancels this
        // watchdog once the user returns and frames resume.
        diagEvent("warning", { note: "first-chunk-watchdog-capture-muted" });
      } else {
        // Sticky-disable WebCodecs for the device only when the capture track
        // was live and unmuted yet produced no chunk (the genuine "28-byte
        // ftyp" silent-encoder defect). An ended track or no snapshot is
        // ambiguous: fail the recording but leave the fast path enabled.
        try {
          const { fastRecorderInUse } = await chrome.storage.local.get([
            "fastRecorderInUse",
          ]);
          const realEncoderDefect =
            Boolean(vt) && vt.readyState === "live" && vt.muted === false;
          if (fastRecorderInUse && realEncoderDefect) {
            await markFastRecorderFailure("webcodecs-no-first-chunk", {
              error: "WebCodecs produced no first chunk within 8s (watchdog)",
            });
          }
        } catch (err) {
          console.warn("[Screenity][BG] watchdog sticky-disable failed", err);
        }
        // handleRecordingError (not sendMessageRecord) so the editor gets notified
        try {
          await handleRecordingError({
            error: "stream-error",
            why: "Recording failed: no video data received within 8 seconds. The tab may have been throttled. Please try again.",
            errorCode: "no-first-chunk",
          });
        } catch (err) {
          console.warn("[Screenity][BG] first-chunk watchdog handler failed", err);
        }
      }
    }
    await chrome.alarms.clear(FIRST_CHUNK_WATCHDOG_ALARM);
    return;
  }

  if (alarm.name === CLOUD_LOCAL_PLAYBACK_ALARM) {
    const {
      [CLOUD_LOCAL_PLAYBACK_KEY]: localPlaybackOffer,
      recording,
      pendingRecording,
      restarting,
    } = await chrome.storage.local.get([
      CLOUD_LOCAL_PLAYBACK_KEY,
      "recording",
      "pendingRecording",
      "restarting",
    ]);

    if (!localPlaybackOffer?.offerId) {
      await chrome.alarms.clear(CLOUD_LOCAL_PLAYBACK_ALARM);
      return;
    }

    const hasActiveRecording = Boolean(recording || pendingRecording || restarting);
    if (hasActiveRecording) {
      // never clear chunks during an active recording
      const retryAt = Date.now() + 5 * 60 * 1000;
      await chrome.alarms
        .create(CLOUD_LOCAL_PLAYBACK_ALARM, { when: retryAt })
        .catch(() => {});
      return;
    }

    const expired = Number(localPlaybackOffer.expiresAt || 0) <= Date.now();
    if (!expired) {
      await chrome.alarms
        .create(CLOUD_LOCAL_PLAYBACK_ALARM, {
          when: Number(localPlaybackOffer.expiresAt),
        })
        .catch(() => {});
      return;
    }

    await chunksStore.clear().catch((err) => {
      console.warn(
        "[Screenity][BG] Failed to clear chunksStore for local playback expiry",
        err,
      );
    });
    await chrome.storage.local.remove([CLOUD_LOCAL_PLAYBACK_KEY]);
    await chrome.storage.local.set({
      [CLOUD_LOCAL_PLAYBACK_EVENT_KEY]: {
        event: "offer-expired",
        at: Date.now(),
        offerId: localPlaybackOffer.offerId,
        projectId: localPlaybackOffer.projectId || null,
        sceneId: localPlaybackOffer.sceneId || null,
      },
    });
    await chrome.alarms.clear(CLOUD_LOCAL_PLAYBACK_ALARM);
  }
};
