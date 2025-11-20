import { sendMessageRecord } from "./sendMessageRecord";
import type { ExtensionMessage } from "../../../types/messaging";

export const startRecording = async (): Promise<void> => {
  chrome.storage.local.set({
    recordingStartTime: Date.now(),
    restarting: false,
    recording: true,
  });

  // Check if customRegion is set
  const customResult = await chrome.storage.local.get(["customRegion"]);
  const customRegion = customResult.customRegion as any;

  const typeResult = await chrome.storage.local.get(["recordingType"]);
  const recordingType = typeResult.recordingType as string | undefined;

  if (recordingType === "region") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
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
  }

  if (customRegion) {
    sendMessageRecord({ type: "start-recording-tab", region: true } as ExtensionMessage);
  } else {
    sendMessageRecord({ type: "start-recording-tab" });
  }
  chrome.action.setIcon({ path: "assets/recording-logo.png" });
  // Set up alarm if set in storage
  const alarmResult = await chrome.storage.local.get(["alarm"]);
  const timeResult = await chrome.storage.local.get(["alarmTime"]);
  const alarm = alarmResult.alarm as boolean | undefined;
  const alarmTime = timeResult.alarmTime as string | number | undefined;
  if (alarm) {
    const seconds = parseFloat(String(alarmTime || 0));
    chrome.alarms.create("recording-alarm", { delayInMinutes: seconds / 60 });
  }
};

export const startAfterCountdown = async (): Promise<void> => {
  try {
    // Retrieve the tab and offscreen status from local storage
    const { recordingTab, offscreen } = await chrome.storage.local.get([
      "recordingTab",
      "offscreen",
    ]);

    // If there is an active recording tab or offscreen document, begin recording
    if (recordingTab !== null || offscreen) {
      await chrome.storage.local.set({ recording: true });
      startRecording();
    }
  } catch (error) {
    console.error("Failed to start after countdown:", error);
  }
};
