import { releaseAttemptClaim } from "./attemptLock";
import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement/removeTab";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { resetWatchdogState } from "./resetWatchdogState";
import { discardEmptyProject, SHELL_TARGET_KEYS } from "./discardEmptyProject";
import {
  askRecorderDismissStatus,
  listenForDismissDone,
  newDismissId,
} from "../../utils/recorderDismissProgress";

// Literal copy of NO_HOST_TAKE (recorderHost.js), as attemptLock.js keeps it:
// no take frame is active between a Start click and its frame being added.
const NO_HOST_TAKE = "outside-host";

export const discardRecording = async ({
  reason = "discard",
  projectId = null,
} = {}) => {
  // Back-to-back cross-talk guard: a discard issued for a previous recording
  // must not tear down the BG state of a newer one. If this discard provably
  // targets a different project than the one currently recording, skip it.
  // Unknown projectId (legacy callers / pre-project dismiss) is honored.
  if (projectId) {
    try {
      const { projectId: currentProjectId } = await chrome.storage.local.get([
        "projectId",
      ]);
      if (currentProjectId && currentProjectId !== projectId) {
        console.warn(
          "[Screenity][BG] discardRecording skipped: project mismatch",
          { reason, target: projectId, current: currentProjectId },
        );
        return;
      }
    } catch {}
  }

  // Read before the dismiss: the recorder removes projectId and the multi keys
  // as it dismisses.
  const shellSnapshot =
    reason === "countdown-cancelled"
      ? await chrome.storage.local.get(SHELL_TARGET_KEYS).catch(() => null)
      : null;

  // What this discard owns. A countdown cancel frees Start at once, so a new
  // Start can claim and add its take frame while we wait on the recorder; the
  // teardown must touch only these.
  const owned = await chrome.storage.local
    .get([
      "recordingTab",
      "activeRecorderTakeId",
      "recordingAttemptId",
      "recordingUiTabId",
    ])
    .catch(() => ({}));

  // A cloud recorder deletes its uploads (and maybe its project) as it
  // dismisses; closing its page first tore those requests down. No project, no
  // deletes.
  const { projectId: liveProjectId } = await chrome.storage.local
    .get(["projectId"])
    .catch(() => ({}));
  const dismissId = newDismissId();
  const deletesLeft = liveProjectId ? listenForDismissDone({ dismissId }) : null;

  // Swallow rejection: if the recorder tab is already dead, the promise
  // rejects and MV3 treats unhandled rejections as SW health signals.
  sendMessageRecord({
    type: "dismiss-recording",
    reason,
    projectId,
    dismissId,
  }).catch(() => {});

  // UI feedback first; none of it waits on the recorder.
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  chrome.storage.local.set({ pipForceClose: Date.now() });
  chrome.runtime.sendMessage({ type: "turn-off-pip" })?.catch?.(() => {});

  // Hold only for a recorder that says it is sending deletes; any other
  // answer (a local recorder, none yet, the camera page) tears down at once.
  if (deletesLeft) {
    const { deleting, saving } = await askRecorderDismissStatus({
      dismissId,
      attemptId: owned.recordingAttemptId || null,
      send: (msg) => sendMessageRecord(msg),
    });
    // Cancel pressed just after Stop: the take is being saved and ignored the
    // dismiss. Tearing down would drop its uploads and scene.
    if (saving) {
      deletesLeft.cancel("saving");
      return;
    }
    if (deleting) await deletesLeft.promise;
    else deletesLeft.cancel("not-deleting");
  }

  // The take's error relay routes to this tab. A newer Start's own is kept.
  {
    const { recordingUiTabId: uiTabNow } = await chrome.storage.local
      .get(["recordingUiTabId"])
      .catch(() => ({}));
    if ((uiTabNow ?? null) === (owned.recordingUiTabId ?? null)) {
      chrome.storage.local.set({ recordingUiTabId: null });
    }
  }

  const { recordingAttemptId: attemptNow } = await chrome.storage.local
    .get(["recordingAttemptId"])
    .catch(() => ({}));
  // A Start claimed after the dismiss went out: everything live is its now.
  const superseded =
    Boolean(attemptNow) && attemptNow !== (owned.recordingAttemptId || null);
  const ownTakeId =
    owned.activeRecorderTakeId && owned.activeRecorderTakeId !== NO_HOST_TAKE
      ? owned.activeRecorderTakeId
      : null;

  // await teardown before recording:false; otherwise handleAlarm fires against torn-down offscreen.
  // shouldFinalize:false so the recorder halts without a finalize that would
  // emit video-ready and open the editor on the discarded take.
  // Superseded: only this discard's own take frame, never the active one.
  if (!superseded || ownTakeId) {
    try {
      await discardOffscreenDocuments({
        reason: "discard",
        shouldFinalize: false,
        ...(superseded ? { onlyTakeId: ownTakeId } : {}),
      });
    } catch {}
  }

  const {
    multiMode,
    multiSceneCount,
    recordingTab,
    multiProjectId,
    projectId: liveProjectAfter,
  } = await chrome.storage.local.get([
    "multiMode",
    "multiSceneCount",
    "recordingTab",
    "multiProjectId",
    "projectId",
  ]);

  // The tab this discard's recorder ran in, never one a new Start opened.
  const ownTab = owned.recordingTab || (superseded ? null : recordingTab) || null;
  if (ownTab && !(superseded && recordingTab === ownTab)) {
    try {
      const tab = await chrome.tabs.get(ownTab);
      if (tab?.url?.startsWith(chrome.runtime.getURL(""))) {
        removeTab(ownTab);
      }
    } catch {}
  }

  // After teardown, so the recorder is gone and a create it still had in flight
  // has nobody to report this delete's refusal to. Skipped if a new Start took
  // the same project over.
  if (shellSnapshot) {
    const { projectId: projectNow } = await chrome.storage.local
      .get(["projectId"])
      .catch(() => ({}));
    const shell = projectId || shellSnapshot.projectId || shellSnapshot.multiProjectId;
    const takenOver =
      superseded && shell && (projectNow === shell || multiProjectId === shell);
    if (!takenOver) {
      void discardEmptyProject({ reason, projectId, snapshot: shellSnapshot });
    }
  }

  // The recording state below is the new Start's now.
  if (superseded) return;

  await resetWatchdogState();

  // The recorder clears projectId and the multi keys when it deletes the
  // project. If it kept it (an earlier take still finishing), keep
  // multiProjectId or Finish opens nothing, and leave the keys unwritten so a
  // landing scene is not overwritten.
  const multiKept =
    multiSceneCount > 0 ||
    (Boolean(multiProjectId) && liveProjectAfter === multiProjectId);
  const multiState = multiMode
    ? {
        multiMode: true,
        ...(multiKept ? {} : {
          multiProjectId: null,
          multiLastSceneId: null,
        }),
      }
    : {
        multiMode: false,
        multiSceneCount: 0,
        multiProjectId: null,
        multiLastSceneId: null,
      };

  // A countdown cancelled before any start leaves the click's claim behind.
  // Scoped to this discard's claim: a newer one is left alone.
  await releaseAttemptClaim(owned.recordingAttemptId || null).catch(() => {});
  chrome.storage.local.set({
    recordingTab: null,
    sandboxTab: null,
    recording: false,
    restarting: false,
    pendingRecording: false,
    offscreen: false,
    postStopEditorOpened: false,
    region: false,
    customRegion: false,
    memoryError: false,
    // Ends the start re-check without a second teardown.
    lastStartEndedAt: Date.now(),
    ...multiState,
  });
  chrome.storage.local.remove(["recordingMeta"]);
};

export const handleDismissRecordingTab = async (message = {}) => {
  discardRecording({
    reason: message?.reason || "dismiss-recording-tab",
    projectId: message?.projectId || null,
  });
};
