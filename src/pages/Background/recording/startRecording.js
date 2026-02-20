import { sendMessageRecord } from "./sendMessageRecord";

export const startRecording = async () => {
  chrome.storage.local.set({
    restarting: false,
  });

  const { activeTab } = await chrome.storage.local.get(["activeTab"]);
  if (activeTab != null) {
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

  if (customRegion) {
    sendMessageRecord({ type: "start-recording-tab", region: true });
  } else {
    sendMessageRecord({ type: "start-recording-tab" });
  }
  chrome.action.setIcon({ path: "assets/recording-logo.png" });
  // Set up alarm if set in storage
  const { alarm } = await chrome.storage.local.get(["alarm"]);
  const { alarmTime } = await chrome.storage.local.get(["alarmTime"]);
  if (alarm) {
    const seconds = parseFloat(alarmTime);
    chrome.alarms.create("recording-alarm", { delayInMinutes: seconds / 60 });
  }
};

export const startAfterCountdown = async () => {
  try {
    // Retrieve the tab and offscreen status from local storage
    const { recordingTab, offscreen } = await chrome.storage.local.get([
      "recordingTab",
      "offscreen",
    ]);

    // If there is an active recording tab or offscreen document, begin recording
    if (recordingTab !== null || offscreen) {
      startRecording();
    }
  } catch (error) {
    console.error("Failed to start after countdown:", error);
  }
};
