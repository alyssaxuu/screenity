import { makeRecordingAttemptId } from "../../utils/errorCodes";

// Storage calls interleave even on one thread: the attempt id write at a start and the
// read-then-clear of a late video-ready must not overlap, or the clear acts on a stale id.
let tail = Promise.resolve();

export const withAttemptLock = (fn) => {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => {},
    () => {},
  );
  return run;
};

export const ATTEMPT_STATE_KEYS = ["recordingAttemptId"];

// Literal copy of NO_HOST_TAKE (recorderHost.js), kept out of the imports. No take frame
// is active between a Start click and the new take's frame being added.
const NO_HOST_TAKE = "outside-host";

// Which take the click stepped over, for the wedge release at the start.
export const claimedOverFor = ({ activeTakeId, claimedOverTakeId }) =>
  activeTakeId === NO_HOST_TAKE ? claimedOverTakeId || null : activeTakeId || null;

// Claim the id at the click, before the countdown, so a late video-ready from the
// previous take already compares against a different id. startRecording reuses it.
export const claimRecordingAttempt = () =>
  withAttemptLock(async () => {
    const { recordingAttemptId, activeRecorderTakeId, claimedOverTakeId } =
      await chrome.storage.local.get([
        "recordingAttemptId",
        "activeRecorderTakeId",
        "claimedOverTakeId",
      ]);
    const claimed = makeRecordingAttemptId();
    // A discard that names no take (cancel in the countdown, a start error) picks
    // the active take's frame. Until the new take's frame exists that is the
    // finishing one, so nothing is active meanwhile.
    await chrome.storage.local.set({
      recordingAttemptId: claimed,
      recordingAttemptPrevId: recordingAttemptId || null,
      recordingAttemptClaimed: true,
      claimedOverTakeId: claimedOverFor({
        activeTakeId: activeRecorderTakeId,
        claimedOverTakeId,
      }),
      activeRecorderTakeId: NO_HOST_TAKE,
    });
    return claimed;
  });

// A click that never became a start gives the previous id back so that take's late
// video-ready still clears its own session. Scoped to the claimed id (a newer click's claim
// or one startRecording consumed is left alone); with no id it releases the current claim.
// Callers already inside the lock use the unlocked form.
export const releaseAttemptClaimUnlocked = async (claimedId = null) => {
  const {
    recordingAttemptClaimed,
    recordingAttemptId,
    recordingAttemptPrevId,
    activeRecorderTakeId,
    claimedOverTakeId,
  } = await chrome.storage.local.get([
    "recordingAttemptClaimed",
    "recordingAttemptId",
    "recordingAttemptPrevId",
    "activeRecorderTakeId",
    "claimedOverTakeId",
  ]);
  if (!recordingAttemptClaimed) return;
  if (claimedId && recordingAttemptId !== claimedId) return;
  // The click never became a start: the take it stepped over is the active one again.
  if (activeRecorderTakeId === NO_HOST_TAKE && claimedOverTakeId) {
    await chrome.storage.local.set({ activeRecorderTakeId: claimedOverTakeId });
  }
  await chrome.storage.local.remove(["claimedOverTakeId"]);
  if (recordingAttemptPrevId) {
    await chrome.storage.local.set({
      recordingAttemptId: recordingAttemptPrevId,
      recordingAttemptClaimed: false,
      recordingAttemptPrevId: null,
    });
  } else {
    await chrome.storage.local.remove(["recordingAttemptId", "recordingAttemptPrevId"]);
    await chrome.storage.local.set({ recordingAttemptClaimed: false });
  }
};

export const releaseAttemptClaim = (claimedId = null) =>
  withAttemptLock(() => releaseAttemptClaimUnlocked(claimedId));

// Missing id is unknown, not current. A different id means a newer take owns it.
export const isAttemptSuperseded = (state, expectedAttemptId) => {
  const { recordingAttemptId } = state || {};
  if (!recordingAttemptId) return true;
  return recordingAttemptId !== expectedAttemptId;
};
