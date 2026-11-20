// hold extension auto-updates while recording or uploading. otherwise
// chrome applies the update at the next SW idle, the recorder tab's
// runtime context goes invalid mid-session, every chrome.* call throws
// "Extension context invalidated", and the recording is lost.
// re-check on a timer + on storage.onChanged so we reload promptly once
// the surface is idle.
import { diagEvent } from "../../utils/diagnosticLog";
import {
  ACTIVE_PIPELINE_STEPS,
  PIPELINE_ACTIVE_TTL_MS,
  HOST_BUSY_TTL_MS,
} from "../recording/resumePendingUploads";
import { micUploadInFlightTtlMs } from "../../utils/recordingLimit";
import {
  isMicUploadFlagKey,
  readMicUploadFlags,
} from "../../utils/micUploadFlag";
import { readOffscreenContexts } from "../offscreen/recorderHost";

// Same grace the offscreen discard gives a mic upload before it stops waiting:
// the upload's own budget from the flag, 120 s for an older build's flag.
const MIC_UPLOAD_GRACE_MS = 120000;

const RECHECK_INTERVAL_MS = 60_000;
// Long enough for a take to drain, short enough that a wedged frame cannot keep
// the old version running. Counted from the latest take activity, so each take
// gets its own window and none can hold the update past it.
const TAKE_FRAME_HOLD_MS = 10 * 60 * 1000;

let pendingUpdateDetails = null;
let pendingSince = 0;
let recheckTimer = null;
let storageListener = null;
// Last time a recording was seen live; a take stopping then starts to finalize.
let lastRecordingSeenAt = 0;

// newTakeId() leads with the frame's creation time in base 36.
const takeStartedAt = (takeId) => {
  const m = /^t([0-9a-z]{8})/.exec(String(takeId || ""));
  if (!m) return 0;
  const at = parseInt(m[1], 36);
  return Number.isFinite(at) && at <= Date.now() + 60_000 ? at : 0;
};

const takeFramesHoldUpdate = ({ frames, now, since, recordingSeenAt }) => {
  if (!frames?.length) return false;
  const lastActivity = Math.max(
    since || 0,
    recordingSeenAt || 0,
    ...frames.map((f) => takeStartedAt(f.takeId))
  );
  return now - lastActivity < TAKE_FRAME_HOLD_MS;
};

const tryApplyUpdate = async () => {
  if (!pendingUpdateDetails) return;
  let snap = {};
  let micFlags = {};
  try {
    snap = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
      "restarting",
      "resumeInProgress",
      "recorderPipelineState",
      "cloudRecorderHostBusy",
    ]);
    micFlags = await readMicUploadFlags();
  } catch {
    // storage unreachable, defer
    return;
  }
  const recordingBusy =
    Boolean(snap?.recording) ||
    Boolean(snap?.pendingRecording) ||
    Boolean(snap?.restarting) ||
    Boolean(snap?.resumeInProgress);
  if (recordingBusy) {
    lastRecordingSeenAt = Date.now();
    return;
  }
  // The flags flip false before the host has drained and finalized, and a reload
  // mid-drain loses the take. Each stamp expires so a dead host cannot block updates.
  const now = Date.now();
  const pipeline = snap?.recorderPipelineState;
  if (
    pipeline &&
    ACTIVE_PIPELINE_STEPS.has(pipeline.step) &&
    now - (pipeline.ts || 0) < PIPELINE_ACTIVE_TTL_MS
  ) {
    return;
  }
  const hostBusy = snap?.cloudRecorderHostBusy;
  if (hostBusy && now - (hostBusy.at || 0) < HOST_BUSY_TTL_MS) return;
  const micUploading = Object.values(micFlags || {}).some(
    (flag) =>
      flag?.at &&
      now - flag.at < micUploadInFlightTtlMs(flag, MIC_UPLOAD_GRACE_MS)
  );
  if (micUploading) return;
  // Takes in the recorder host share the beat and pipeline keys, so the take
  // that finishes first clears them while another still drains.
  const { frames } = await readOffscreenContexts();
  if (
    takeFramesHoldUpdate({
      frames,
      now,
      since: pendingSince,
      recordingSeenAt: lastRecordingSeenAt,
    })
  ) {
    return;
  }
  // Journals alone never hold an update: one a live host is draining is covered by
  // the beat above, the rest are picked up by resume after the reload.
  diagEvent("extension-update-applied-deferred", {
    version: pendingUpdateDetails?.version || null,
  });
  // chrome.runtime.reload() restarts the extension on the new version.
  // Open extension pages reload as a side-effect; since we've gated on
  // !recording, the recorder tab is already gone or never existed.
  try {
    chrome.runtime.reload();
  } catch (err) {
    console.warn("[Screenity][BG] runtime.reload failed", err);
  }
};

const armRecheck = () => {
  if (recheckTimer) return;
  recheckTimer = setInterval(tryApplyUpdate, RECHECK_INTERVAL_MS);
  if (!storageListener) {
    storageListener = (changes, area) => {
      if (area !== "local") return;
      if (
        changes.recording?.oldValue ||
        changes.pendingRecording?.oldValue ||
        changes.restarting?.oldValue
      ) {
        lastRecordingSeenAt = Date.now();
      }
      // A relevant flag flipped, try immediately rather than waiting for
      // the next interval tick. Avoids a 60s stale-update window after
      // the user stops a recording.
      if (
        changes.recording ||
        changes.pendingRecording ||
        changes.restarting ||
        changes.resumeInProgress ||
        changes.recorderPipelineState ||
        changes.cloudRecorderHostBusy ||
        Object.keys(changes).some(isMicUploadFlagKey)
      ) {
        tryApplyUpdate();
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
  }
};

export const onUpdateAvailableListener = () => {
  chrome.runtime.onUpdateAvailable.addListener((details) => {
    pendingUpdateDetails = details || { version: null };
    if (!pendingSince) pendingSince = Date.now();
    diagEvent("extension-update-available-deferred", {
      version: details?.version || null,
    });
    // Try once immediately, if nothing's recording, apply right away.
    tryApplyUpdate();
    // Otherwise, wait for the recording to finish.
    armRecheck();
  });
};
