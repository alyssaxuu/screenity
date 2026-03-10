import { sendMessageRecord } from "./sendMessageRecord";
import { initDiagSession, diagEvent } from "../../utils/diagnosticLog";

export const startRecording = async () => {
  chrome.storage.local.set({
    restarting: false,
  });

  const { activeTab, recordingUiTabId } = await chrome.storage.local.get([
    "activeTab",
    "recordingUiTabId",
  ]);
  if (recordingUiTabId != null) {
    chrome.storage.local.set({ recordingUiTabId });
  } else if (activeTab != null) {
    chrome.storage.local.set({ recordingUiTabId: activeTab });
  }

  // Check if customRegion is set
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

  // Initialize diagnostic session for this recording
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
  // Log session-start immediately (not inside the async .then() callback) so
  // the event is flushed to storage before the SW can be killed.
  diagEvent("session-start", { region: Boolean(customRegion) });

  if (customRegion) {
    sendMessageRecord({ type: "start-recording-tab", region: true })
      .then(() => {
        chrome.storage.local.set({
          lastStartRecordingDispatch: {
            ts: Date.now(),
            ok: true,
            region: true,
          },
        });
      })
      .catch((err) => {
        chrome.storage.local.set({
          lastStartRecordingDispatch: {
            ts: Date.now(),
            ok: false,
            region: true,
            error: String(err),
          },
        });
        diagEvent("start-fail", { region: true, error: String(err) });
      });
  } else {
    sendMessageRecord({ type: "start-recording-tab" })
      .then(() => {
        chrome.storage.local.set({
          lastStartRecordingDispatch: {
            ts: Date.now(),
            ok: true,
            region: false,
          },
        });
      })
      .catch((err) => {
        chrome.storage.local.set({
          lastStartRecordingDispatch: {
            ts: Date.now(),
            ok: false,
            region: false,
            error: String(err),
          },
        });
        diagEvent("start-fail", { region: false, error: String(err) });
      });
  }
  chrome.action.setIcon({ path: "assets/recording-logo.png" });
  // Set up alarm if set in storage
  if (alarm) {
    const seconds = parseFloat(alarmTime);
    chrome.alarms.create("recording-alarm", { delayInMinutes: seconds / 60 });
  }
};

export const startAfterCountdown = () => {
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

    // Some flows can start before recordingTab is persisted. Start anyway and
    // let sendMessageRecord route via recorderSession/offscreen fallback.
    if (recordingTab === null && !offscreen) {
      console.warn(
        "[Screenity] startAfterCountdown: no recordingTab/offscreen available, starting with fallback routing"
      );
    }
    startRecording();
  });
};
