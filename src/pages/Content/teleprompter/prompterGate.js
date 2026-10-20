import { setContentState } from "../context/ContentState";
import { cameraCanLiveInWindow, prompterCaptureStatus } from "./prompterRules";
import {
  closePipLayer,
  getPipLayers,
  getPrompterKeepVisible,
  getPrompterWindow,
  openPipLayer,
  setPrompterKeepVisible,
} from "./prompterWindow";

const NO_PROMPT_KEY = "teleprompterFullScreenNoPrompt";

// Burnt-in camera: once a full-screen capture closes the script, the camera takes the window.
const giveWindowToCamera = (state) => {
  const own = cameraCanLiveInWindow({
    cloud: process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true",
    subscribed: state.isSubscribed,
    instantMode: state.instantMode,
  });
  if (own || state.recordingType !== "screen") return;
  if (state.cameraActive && state.defaultVideoInput !== "none") {
    openPipLayer("camera", "gate: full screen");
  }
};

const msg = (key, fallback) => chrome.i18n.getMessage(key) || fallback;

// The open prompt's escape hatch. A failed or cancelled start must settle it,
// or the start that was waiting on it never ends.
let abortOpenPrompt = null;
export const ABORTED = "aborted";

// Called when the attempt ends under an open prompt (stop-pending, recording-error).
export const abortStartGate = (state) => {
  cameraNotice = null;
  const abort = abortOpenPrompt;
  abortOpenPrompt = null;
  if (!abort) return;
  abort();
  state?.closeModal?.();
};

const readGatePrefs = async () => {
  let remembered = false;
  try {
    const stored = await chrome.storage.local.get(NO_PROMPT_KEY);
    remembered = stored?.[NO_PROMPT_KEY] === true;
  } catch {}
  // No countdown: the recorder is already running, so there is no moment to ask.
  let countdownOn = true;
  try {
    const stored = await chrome.storage.local.get("countdown");
    countdownOn = Boolean(stored?.countdown);
  } catch {}
  return { remembered, countdownOn };
};

// Closed without asking (mid-take switch to full screen, unknown surface at
// the start): toast unless they opted out.
export const notifyPrompterClosed = async (state) => {
  const { remembered } = await readGatePrefs();
  if (remembered) return;
  state.openToast?.(
    msg(
      "teleprompterClosedToast",
      "Teleprompter closed to keep it out of your recording"
    ),
    () => {}
  );
};

// Pro's own-track camera is in the window only while the capture leaves it out.
// Full screen records it, so it closes, with a notice first.
const closeOwnCameraLayer = async (state) => {
  if (!getPipLayers().camera) return;
  const own = cameraCanLiveInWindow({
    cloud: process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true",
    subscribed: state.isSubscribed,
    instantMode: state.instantMode,
  });
  if (!own) return;
  const { remembered, countdownOn } = await readGatePrefs();
  if (remembered || typeof state.openModal !== "function") {
    closePipLayer("camera", "gate: full screen");
    return;
  }
  if (!countdownOn) {
    closePipLayer("camera", "gate: no countdown");
    state.openToast?.(
      msg("cameraFullScreenTitle", "Camera window will close"),
      () => {}
    );
    return;
  }
  setContentState((prev) => ({ ...prev, startGateOpen: true }));
  const outcome = await new Promise((resolve) => {
    let settled = false;
    abortOpenPrompt = () => {
      settled = true;
      resolve(ABORTED);
    };
    const choose = (choice) => () => {
      if (settled) return;
      settled = true;
      abortOpenPrompt = null;
      if (choice === "never") {
        chrome.storage.local.set({ [NO_PROMPT_KEY]: true }).catch(() => {});
      }
      closePipLayer("camera", "gate: closed");
      resolve();
    };
    state.openModal(
      msg("cameraFullScreenTitle", "Camera window will close"),
      msg(
        "cameraFullScreenDescription",
        "You're recording your entire screen, so the camera window would appear in the video. We'll close it to keep it out of the recording. Your camera is still recorded."
      ),
      msg("teleprompterFullScreenClose", "OK, close it"),
      null,
      choose("close"),
      null,
      null,
      null,
      null,
      true,
      msg("teleprompterFullScreenNever", "Don't show again"),
      choose("never"),
      choose("close"),
      true
    );
  });
  if (outcome === ABORTED) return ABORTED;
  setContentState((prev) => ({ ...prev, startGateOpen: false }));
};

// The surface is known as soon as the picker closes, before the recorder is
// ready. The start gate joins this prompt instead of asking again.
let cameraNotice = null;
export const startCameraCloseNotice = (state) => {
  if (!cameraNotice) {
    const notice = closeOwnCameraLayer(state).finally(() => {
      if (cameraNotice === notice) cameraNotice = null;
    });
    cameraNotice = notice;
  }
  return cameraNotice;
};

// The controls bar is in the video as much as the script is, and the take-start
// close only runs once recording flips true.
const closeScriptWindow = (reason) => {
  closePipLayer("prompter", reason);
  closePipLayer("controls", reason);
};

// Runs before a recording starts. A full-screen capture would record the open
// teleprompter window, so the start waits for the user's choice. Every answer records.
export const runPrompterStartGate = async (state) => {
  if (!getPrompterWindow()) return;
  // state.surface lags an auth round-trip; storage has it as soon as the recorder reports it.
  let surface = state.surface;
  if (!surface || surface === "default") {
    try {
      const stored = await chrome.storage.local.get("surface");
      if (stored?.surface) surface = stored.surface;
    } catch {}
  }
  if (surface && surface !== state.surface) {
    setContentState((prev) => ({ ...prev, surface }));
  }
  const status = prompterCaptureStatus({
    recordingType: state.recordingType,
    surface,
  });
  if (status !== "unsafe") return;
  // Asked once for this window: a restart does not ask again.
  if (getPrompterKeepVisible()) return;
  // Controls-only window needs no prompt, the toolbar is visible.
  if (!getPipLayers().prompter) {
    giveWindowToCamera(state);
    closePipLayer("controls", "gate: full screen");
    return startCameraCloseNotice(state);
  }

  // No countdown: close the script and toast instead of asking.
  const { remembered, countdownOn } = await readGatePrefs();
  if (!countdownOn && !remembered) {
    giveWindowToCamera(state);
    closeScriptWindow("gate: no countdown");
    state.openToast?.(
      msg("teleprompterFullScreenTitle", "Teleprompter will be closed"),
      () => {}
    );
    return;
  }
  if (remembered || typeof state.openModal !== "function") {
    giveWindowToCamera(state);
    closeScriptWindow("gate: remembered");
    return;
  }

  setContentState((prev) => ({ ...prev, startGateOpen: true }));
  const outcome = await new Promise((resolve) => {
    let settled = false;
    abortOpenPrompt = () => {
      settled = true;
      resolve(ABORTED);
    };
    const choose = (choice) => () => {
      if (settled) return;
      settled = true;
      abortOpenPrompt = null;
      if (choice === "keep") {
        setPrompterKeepVisible(true);
        // Camera and script share the window only when the camera is its own track.
        if (
          !cameraCanLiveInWindow({
            cloud: process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true",
            subscribed: state.isSubscribed,
            instantMode: state.instantMode,
          })
        ) {
          closePipLayer("camera", "gate: script kept");
        }
      } else {
        if (choice === "never") {
          chrome.storage.local.set({ [NO_PROMPT_KEY]: true }).catch(() => {});
        }
        giveWindowToCamera(state);
        closeScriptWindow("gate: closed");
      }
      resolve();
    };
    state.openModal(
      msg("teleprompterFullScreenTitle", "Teleprompter will be closed"),
      msg(
        "teleprompterFullScreenDescription",
        "You're recording your entire screen, so the teleprompter window would appear in the video. We'll close it to keep it out of the recording. You can keep it open, but it will be recorded."
      ),
      msg("teleprompterFullScreenClose", "OK, close it"),
      msg("teleprompterFullScreenKeep", "Keep it visible"),
      choose("close"),
      choose("keep"),
      null,
      null,
      null,
      true,
      msg("teleprompterFullScreenNever", "Don't show again"),
      choose("never"),
      choose("close"),
      true
    );
  });
  if (outcome === ABORTED) return ABORTED;
  setContentState((prev) => ({ ...prev, startGateOpen: false }));
};
