import { sendMessageTab } from "../tabManagement";
import { diagEvent } from "../../utils/diagnosticLog";
import { loginWithWebsite } from "../auth/loginWithWebsite";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
const APP_BASE = process.env.SCREENITY_APP_BASE;
// debounce in-tab triggers so navigation chatter doesn't hammer /auth/refresh
const APP_AUTH_REFRESH_DEBOUNCE_MS = 10_000;
let lastAppAuthRefreshAt = 0;
const tryAppAuthRefresh = async (url) => {
  if (!CLOUD_FEATURES_ENABLED || !APP_BASE || !url) return;
  if (!url.startsWith(APP_BASE)) return;
  const now = Date.now();
  if (now - lastAppAuthRefreshAt < APP_AUTH_REFRESH_DEBOUNCE_MS) return;
  // skip when already authed; AUTH_SUCCESS is the fast path.
  const { isLoggedIn } = await chrome.storage.local.get(["isLoggedIn"]);
  if (isLoggedIn) return;
  lastAppAuthRefreshAt = now;
  loginWithWebsite({ force: true }).catch(() => {});
};

export const handleTabUpdate = async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete") {
      const {
        recording,
        paused,
        pausedAt,
        totalPausedMs,
        restarting,
        tabRecordedID,
        pendingRecording,
        recordingStartTime,
        recorderSession,
        customRegion,
        recordingType,
      } = await chrome.storage.local.get([
        "recording",
        "paused",
        "pausedAt",
        "totalPausedMs",
        "restarting",
        "tabRecordedID",
        "pendingRecording",
        "recordingStartTime",
        "recorderSession",
        "customRegion",
        "recordingType",
      ]);

      // Check both recording flag AND recorderSession to avoid race conditions
      // recorderSession persists even if the SW restarts
      const isActivelyRecording =
        recording ||
        (recorderSession && recorderSession.status === "recording");
      const isPendingOrRestarting = restarting || pendingRecording;

      if (!isActivelyRecording && !isPendingOrRestarting) {
        sendMessageTab(tabId, { type: "recording-ended" });
      } else if (isActivelyRecording) {
        if (tabRecordedID && tabRecordedID === tabId) {
          diagEvent("recorded-tab-navigated");
          sendMessageTab(tabId, {
            type: "recording-check",
            force: true,
            recordingStartTime,
          });
        } else if (tabRecordedID && tabRecordedID !== tabId) {
          sendMessageTab(tabId, { type: "hide-popup-recording" });
        }
      }

      if (recordingStartTime) {
        const now = Date.now();
        const basePaused = totalPausedMs || 0;
        const extraPaused =
          paused && pausedAt ? Math.max(0, now - pausedAt) : 0;

        const elapsed = Math.max(
          0,
          Math.floor(
            (now - recordingStartTime - basePaused - extraPaused) / 1000
          )
        );

        const { alarm } = await chrome.storage.local.get(["alarm"]);
        if (alarm) {
          const { alarmTime } = await chrome.storage.local.get(["alarmTime"]);
          const remaining = Math.max(0, Math.floor(alarmTime - elapsed));
          sendMessageTab(tabId, { type: "time", time: remaining });
        } else {
          sendMessageTab(tabId, { type: "time", time: elapsed });
        }
      }

      const commands = await chrome.commands.getAll();

      sendMessageTab(tabId, {
        type: "commands",
        commands: commands,
      });

      // Check if tab is playground.html
      if (
        tab.url.includes(chrome.runtime.getURL("playground.html")) &&
        changeInfo.status === "complete"
      ) {
        sendMessageTab(tab.id, { type: "toggle-popup" });
      }
      // if we look logged out, try a force refresh in case AUTH_SUCCESS was missed.
      tryAppAuthRefresh(tab.url).catch(() => {});
    }
  } catch (error) {
    console.error("Error in handleTabUpdate:", error.message);
  }
};

export const onTabUpdatedListener = () => {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
};
