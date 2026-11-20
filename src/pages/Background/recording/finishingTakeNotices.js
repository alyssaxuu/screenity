// A take still finishing beside the recording one must not put UI on the tab: a toast or modal is
// burnt into the new take's video, and a multi popup reopen resets its toolbar. Notices are held until
// no take is recording, then delivered; a popup reopen is dropped.
import { isFromSupersededTake } from "./sessionConflict";

export const DEFERRED_NOTICES_KEY = "deferredTakeNotices";
const MAX_HELD = 10;
// After Stop the take's capture can run a moment longer.
export const DELIVER_DELAY_MS = 2000;
const DROP_TYPES = new Set(["reopen-popup-multi"]);

const isLive = (s) => Boolean(s?.recording || s?.pendingRecording);

// A take outside the host stamps its attempt id instead of a frame id.
const fromEarlierTake = ({ message, state }) =>
  isFromSupersededTake({ message, activeTakeId: state?.activeRecorderTakeId }) ||
  Boolean(
    message?.__attemptId && message.__attemptId !== state?.recordingAttemptId
  );

export const noticeDisposition = ({ message, state }) => {
  if (!isLive(state)) return "deliver";
  // About its own take, but a toast on a recording is burnt into it.
  if (message?.holdWhileRecording) return "hold";
  if (!fromEarlierTake({ message, state })) return "deliver";
  return DROP_TYPES.has(message?.type) ? "drop" : "hold";
};

// editor-ready comes after its take's own Stop, so a recording or pending start then is another take.
// Its editor opens in the background, leaving that take's camera PiP and the clipboard alone.
export const editorReadyQuiet = (state) => isLive(state);

const readState = () =>
  chrome.storage.local.get([
    "activeRecorderTakeId",
    "recordingAttemptId",
    "recording",
    "pendingRecording",
    "activeTab",
    DEFERRED_NOTICES_KEY,
  ]);

// Returns true when the notice was held or dropped; the caller sends it
// otherwise. `payload` is what goes to the tab.
export const holdNoticeFromFinishingTake = async (message, payload) => {
  let state = null;
  try {
    state = await readState();
  } catch {
    return false;
  }
  const disposition = noticeDisposition({ message, state });
  if (disposition === "deliver") return false;
  if (disposition === "hold") {
    const held = Array.isArray(state[DEFERRED_NOTICES_KEY])
      ? state[DEFERRED_NOTICES_KEY]
      : [];
    try {
      await chrome.storage.local.set({
        [DEFERRED_NOTICES_KEY]: [...held, payload].slice(-MAX_HELD),
      });
    } catch {}
  }
  return true;
};

export const deliverHeldNotices = async (send) => {
  let state = null;
  try {
    state = await readState();
  } catch {
    return 0;
  }
  const held = state?.[DEFERRED_NOTICES_KEY];
  if (!Array.isArray(held) || held.length === 0) return 0;
  if (isLive(state) || !state.activeTab) return 0;
  try {
    await chrome.storage.local.remove([DEFERRED_NOTICES_KEY]);
  } catch {}
  for (const payload of held) {
    try {
      // Shown between takes: the page closes it once the next take starts.
      await send(state.activeTab, { ...payload, heldNotice: true });
    } catch {}
  }
  return held.length;
};

export const initHeldNoticeDelivery = (send) => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const ended =
      (changes.recording && changes.recording.newValue === false) ||
      (changes.pendingRecording && changes.pendingRecording.newValue === false);
    if (!ended) return;
    setTimeout(() => {
      void deliverHeldNotices(send);
    }, DELIVER_DELAY_MS);
  });
};
