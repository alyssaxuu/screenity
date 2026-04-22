import { stopRecording } from "../recording/stopRecording.js";
import { sendMessageTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";
import { diagEvent } from "../../utils/diagnosticLog";
import { chunksStore } from "../recording/chunkHandler";
import { emitRecordingTelemetry } from "../recording/emitRecordingTelemetry";
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

// Utility to handle tab messaging logic.
// `tab` is an optional Chrome Tab object used as a fallback when the stored
// activeTab is no longer valid (e.g. when called from an action-button click).
// When called from an alarm — where there is no current tab — pass null;
// the function will skip the fallback branch gracefully.
const handleTabMessaging = async (tab) => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  try {
    const targetTab = await chrome.tabs.get(activeTab);

    if (targetTab) {
      sendMessageTab(activeTab, { type: "stop-recording-tab" });
    } else if (tab?.id) {
      // Only reachable when a real tab object was provided (not from alarms).
      sendMessageTab(tab.id, { type: "stop-recording-tab" });
      chrome.storage.local.set({ activeTab: tab.id });
    }
  } catch (error) {
    console.error("Error in handleTabMessaging:", error);
  }
};

export const handleAlarm = async (alarm) => {
  if (alarm.name === RECORDER_KEEPALIVE_ALARM) {
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
    const now = Date.now();
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

    if (stallLevel === 1) {
      diagEvent("recording-stall-escalated", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
      void emitRecordingTelemetry("recording_stall_escalated", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
      // Force-focus causes a brief tab flash but reliably unfreezes hard-throttled tabs.
      try {
        await chrome.tabs.update(snap.recordingTab, { active: true });
      } catch {}
      await chrome.storage.local.set({ recordingStallLevel: 2 });
      return;
    }

    if (stallLevel === 2) {
      diagEvent("recording-stall-unrecoverable", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
      void emitRecordingTelemetry("recording_stall_unrecoverable", {
        ageMs: age,
        tabId: snap.recordingTab,
      });
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
      chrome.runtime
        .sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "Recording stopped: the recorder tab became unresponsive.",
          errorCode: "recording-stall-unrecoverable",
        })
        .catch(() => {});
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
      // Pass null: alarms fire without a user-initiated tab context.
      // handleTabMessaging will use the stored activeTab and skip the
      // tab-object fallback branch when null is provided.
      await handleTabMessaging(null);
    }

    await chrome.alarms.clear("recording-alarm");
    return;
  }

  if (alarm.name === FIRST_CHUNK_WATCHDOG_ALARM) {
    // No data received from MediaRecorder within the timeout
    const { recording } = await chrome.storage.local.get(["recording"]);
    if (recording) {
      diagEvent("error", { note: "first-chunk-watchdog-fired" });
      sendMessageRecord({
        type: "recording-error",
        error: "stream-error",
        why: "Recording failed — no video data received within 8 seconds. The tab may have been throttled. Please try again.",
        errorCode: "no-first-chunk",
      }).catch(() => {});
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
      // Never clear local chunks while a new recording is active; retry soon.
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
