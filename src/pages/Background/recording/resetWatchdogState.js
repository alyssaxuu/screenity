import {
  FIRST_CHUNK_WATCHDOG_ALARM,
  RECORDER_KEEPALIVE_ALARM,
} from "../alarms/alarmConstants";

export const resetWatchdogState = async () => {
  try {
    await chrome.alarms.clear(RECORDER_KEEPALIVE_ALARM);
  } catch {}
  try {
    await chrome.alarms.clear(FIRST_CHUNK_WATCHDOG_ALARM);
  } catch {}
  try {
    await chrome.storage.local.set({
      firstChunkAt: null,
      lastChunkAt: null,
      recordingStallLevel: 0,
    });
  } catch {}
};
