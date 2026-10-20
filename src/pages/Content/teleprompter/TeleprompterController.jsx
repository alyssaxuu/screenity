import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { contentStateContext, timerContext } from "../context/ContentState";
import { beginRecording } from "../utils/beginRecording";
import Teleprompter from "./Teleprompter";
import {
  DEFAULT_SETTINGS,
  formatClock,
  planCameraAtSurface,
  cameraCloseWaitsForGate,
  cameraCanLiveInWindow,
  captureRecordsWindow,
  normalizeSettings,
  shouldClosePrompter,
} from "./prompterRules";
import { notifyPrompterClosed, startCameraCloseNotice } from "./prompterGate";
import { loadPrompterSettings, savePrompterSettings } from "./prompterSettings";
import {
  closePipLayer,
  closePrompterWindow,
  openPipLayer,
  getCameraManual,
  getPipLayers,
  getPrompterKeepVisible,
  getPrompterWindow,
  subscribePrompterWindow,
} from "./prompterWindow";

const SAVE_DELAY_MS = 400;
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

// Always mounted. Owns the floating window once the popup opens it and ties it
// to the recording: scrolls with the take, stops on pause, closes if the capture includes it.
const TeleprompterController = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [seconds] = useContext(timerContext);
  const win = useSyncExternalStore(subscribePrompterWindow, getPrompterWindow);
  const layers = useSyncExternalStore(subscribePrompterWindow, getPipLayers);
  const prompterOn = Boolean(win && layers.prompter);
  const cameraOn = Boolean(win && layers.camera);
  const controlsOn = Boolean(win && layers.controls);
  const [cameraHost, setCameraHost] = useState(null);
  const [micLevel, setMicLevel] = useState(0);

  const [settings, setSettings] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [rewindToken, setRewindToken] = useState(0);
  const [host, setHost] = useState(null);
  const [confirmKind, setConfirmKind] = useState(null);
  const pausedForConfirmRef = useRef(false);
  const confirmKindRef = useRef(null);
  confirmKindRef.current = confirmKind;

  const settingsRef = useRef(null);
  const saveTimerRef = useRef(null);
  const contentStateRef = useRef(contentState);
  contentStateRef.current = contentState;

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (settingsRef.current) savePrompterSettings(settingsRef.current);
    }
  }, []);

  const onSettings = useCallback((patch) => {
    const next = normalizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      savePrompterSettings(next);
    }, SAVE_DELAY_MS);
  }, []);

  // Close with the page, and on extension reload, disable or update: the
  // orphaned script's window would be a zombie the popup can no longer close.
  useEffect(() => {
    if (!win) return undefined;
    const close = () => closePrompterWindow("opener page left");
    window.addEventListener("pagehide", close);
    const alive = () => {
      try {
        return Boolean(chrome.runtime?.id);
      } catch {
        return false;
      }
    };
    const watchdog = setInterval(() => {
      if (!alive()) close();
    }, 2000);
    return () => {
      window.removeEventListener("pagehide", close);
      clearInterval(watchdog);
    };
  }, [win]);

  // Navigating away can tear the page down before the debounced write runs.
  useEffect(() => {
    window.addEventListener("pagehide", flushSave);
    return () => window.removeEventListener("pagehide", flushSave);
  }, [flushSave]);

  // Read settings on each open and write on close (camera placement included)
  // so a script typed just before closing is not lost.
  const windowOpen = Boolean(win);
  useEffect(() => {
    if (!windowOpen) return undefined;
    let cancelled = false;
    loadPrompterSettings().then((loaded) => {
      if (cancelled) return;
      settingsRef.current = loaded;
      setSettings(loaded);
    });
    return () => {
      cancelled = true;
      flushSave();
      settingsRef.current = null;
      setSettings(null);
      setPlaying(false);
      // The window closed under an open restart/discard prompt: nothing is left
      // to answer it, so undo the pause it caused.
      if (confirmKindRef.current) {
        setConfirmKind(null);
        const now = contentStateRef.current;
        if (pausedForConfirmRef.current && now.recording && now.paused) {
          now.resumeRecording();
        }
      }
    };
  }, [windowOpen, flushSave]);

  const hasSettings = settings !== null;
  const needsUi = Boolean(win) && (cameraOn || controlsOn || hasSettings);
  useEffect(() => {
    if (!win || !needsUi) {
      setHost(null);
      return undefined;
    }
    const el = win.document.createElement("div");
    Object.assign(el.style, { position: "absolute", inset: "0", zIndex: "1" });
    win.document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
      setHost(null);
    };
  }, [win, needsUi]);

  useEffect(() => {
    if (!win || !cameraOn) {
      setCameraHost(null);
      return undefined;
    }
    const el = win.document.createElement("div");
    Object.assign(el.style, { position: "absolute", inset: "0", zIndex: "0" });
    win.document.body.appendChild(el);
    setCameraHost(el);
    return () => {
      el.remove();
      setCameraHost(null);
    };
  }, [win, cameraOn]);

  const cameraOnRef = useRef(false);
  useEffect(() => {
    const was = cameraOnRef.current;
    cameraOnRef.current = cameraOn;
    if (cameraOn === was) return;
    // A camera put here by hand is wanted here, whatever was chosen before.
    if (cameraOn && getCameraManual()) {
      if (settingsRef.current) onSettings({ showCamera: true });
      else {
        loadPrompterSettings().then((loaded) =>
          savePrompterSettings({ ...loaded, showCamera: true })
        );
      }
    }
  }, [cameraOn, onSettings]);

  // Hiding the camera in the window moves it to the page, bubble included, even
  // where it is normally hidden during a recording.
  const cameraShown = cameraOn && settings?.showCamera !== false;
  useEffect(() => {
    const onPage = cameraOn && !cameraShown;
    setContentState((prev) =>
      prev.pipActive === cameraShown &&
      prev.cameraOnPage === onPage &&
      prev.cameraInWindow === cameraShown
        ? prev
        : {
            ...prev,
            pipActive: cameraShown,
            cameraOnPage: onPage,
            cameraInWindow: cameraShown,
          }
    );
  }, [cameraOn, cameraShown, setContentState]);

  // Once the capture is known, drop the camera from the window where the page's
  // own picture in picture should carry it.
  useEffect(() => {
    const onRuntime = (message) => {
      if (message?.type !== "set-surface") return;
      const state = contentStateRef.current;
      const plan = planCameraAtSurface({
        cloud: CLOUD_FEATURES_ENABLED,
        subscribed: Boolean(message.subscribed),
        instantMode: Boolean(message.instantMode),
        recordingType: message.recordingType || null,
        surface: message.surface,
        layers: getPipLayers(),
        keepVisible: getPrompterKeepVisible(),
        cameraEnabled:
          Boolean(state.cameraActive) && state.defaultVideoInput !== "none",
        windowOpen: Boolean(getPrompterWindow()),
      });
      // Pre-take, a camera-only window waits for the start gate, which warns first.
      const waitsForGate = cameraCloseWaitsForGate({
        cloud: CLOUD_FEATURES_ENABLED,
        subscribed: Boolean(message.subscribed),
        instantMode: Boolean(message.instantMode),
        recordingType: message.recordingType || null,
        surface: message.surface,
        layers: getPipLayers(),
        recording: Boolean(state.recording),
        countdown: Boolean(state.countdownActive || state.isCountdownVisible),
      });
      if (plan === "close") {
        if (!waitsForGate)
          closePipLayer("camera", "capture records the window");
        else
          void startCameraCloseNotice({
            ...state,
            isSubscribed: Boolean(message.subscribed),
            instantMode: Boolean(message.instantMode),
          });
      } else if (plan === "open") openPipLayer("camera", "surface picked");
      // Switching to the whole monitor mid-take puts the window in the video.
      if (
        state.recording &&
        getPrompterWindow() &&
        !getPrompterKeepVisible() &&
        shouldClosePrompter({
          recordingType: message.recordingType || state.recordingType,
          surface: message.surface,
          recording: true,
        })
      ) {
        if (getPipLayers().prompter) void notifyPrompterClosed(state);
        closePipLayer("prompter", "capture records the window");
        closePipLayer("controls", "capture records the window");
      }
    };
    chrome.runtime.onMessage.addListener(onRuntime);
    return () => chrome.runtime.onMessage.removeListener(onRuntime);
  }, []);

  // Turning the camera off leaves a black window, so the camera leaves it.
  useEffect(() => {
    if (cameraOn && contentState.cameraActive === false) {
      closePipLayer("camera", "camera turned off");
    }
  }, [cameraOn, contentState.cameraActive]);

  // Close the camera if no start begins within 90s of opening it.
  useEffect(() => {
    if (!cameraOn || getCameraManual()) return undefined;
    const id = setTimeout(() => {
      const s = contentStateRef.current;
      if (!s.pendingRecording && !s.preparingRecording && !s.recording) {
        closePipLayer("camera", "start never began");
      }
    }, 90000);
    return () => clearTimeout(id);
  }, [cameraOn]);

  // Flags all dip clear briefly between restart steps, so require a 1.5s lull
  // before treating a start as ended and dropping the camera.
  const sawStartRef = useRef(false);
  const startBusy = Boolean(
    contentState.pendingRecording ||
      contentState.recording ||
      contentState.preparingRecording ||
      contentState.restartingRecording ||
      contentState.countdownActive
  );
  useEffect(() => {
    if (startBusy) {
      sawStartRef.current = true;
      return undefined;
    }
    if (!sawStartRef.current) return undefined;
    const id = setTimeout(() => {
      const s = contentStateRef.current;
      if (
        s.pendingRecording ||
        s.recording ||
        s.preparingRecording ||
        s.restartingRecording ||
        s.countdownActive
      ) {
        return;
      }
      sawStartRef.current = false;
      if (!getCameraManual()) closePipLayer("camera", "start ended");
    }, 1500);
    return () => clearTimeout(id);
  }, [startBusy]);

  // Mic level comes from a hidden page inside the window; only run it while the mic is on.
  const meterOn =
    Boolean(win) &&
    Boolean(contentState.micActive) &&
    Boolean(contentState.microphonePermission) &&
    contentState.defaultAudioInput !== "none";
  useEffect(() => {
    if (!meterOn || !win) {
      setMicLevel(0);
      return undefined;
    }
    let last = 0;
    const onMessage = (e) => {
      if (e.data?.type !== "screenity-mic-level") return;
      const level = Number(e.data.level) || 0;
      if (Math.abs(level - last) < 0.04) return;
      last = level;
      setMicLevel(level);
    };
    win.addEventListener("message", onMessage);
    return () => {
      win.removeEventListener("message", onMessage);
      setMicLevel(0);
    };
  }, [meterOn, win]);

  // Scrolling follows the take; a window opened mid-recording does not start itself.
  const prevRecordingRef = useRef({
    recording: contentState.recording,
    paused: contentState.paused,
  });
  useEffect(() => {
    const prev = prevRecordingRef.current;
    const now = {
      recording: Boolean(contentState.recording),
      paused: Boolean(contentState.paused),
    };
    prevRecordingRef.current = now;
    if (!win) return;

    const wantsAutoScroll =
      settingsRef.current?.autoScroll !== false &&
      Boolean(settingsRef.current?.script?.trim());

    if (
      now.recording &&
      !prev.recording &&
      getPipLayers().camera &&
      cameraCanLiveInWindow({
        cloud: CLOUD_FEATURES_ENABLED,
        subscribed: contentState.isSubscribed,
        instantMode: contentState.instantMode,
      }) &&
      captureRecordsWindow({
        recordingType: contentState.recordingType,
        surface: contentState.surface,
      })
    ) {
      closePipLayer("camera", "capture records the window");
    }

    if (now.recording && !prev.recording) {
      if (
        !getPrompterKeepVisible() &&
        shouldClosePrompter({
          recordingType: contentState.recordingType,
          surface: contentState.surface,
          recording: true,
        })
      ) {
        if (getPipLayers().prompter) {
          void notifyPrompterClosed(contentStateRef.current);
        }
        closePipLayer("prompter", "capture records the window");
        closePipLayer("controls", "capture records the window");
        return;
      }
      setRewindToken((n) => n + 1);
      setPlaying(wantsAutoScroll && !now.paused);
    } else if (!now.recording && prev.recording) {
      setPlaying(false);
      // A finished, cancelled or discarded take ends the session. A restart
      // also passes through "not recording" and carries on.
      if (!contentStateRef.current.restartingRecording) {
        closePrompterWindow("take ended");
      }
    } else if (now.recording && now.paused && !prev.paused) {
      setPlaying(false);
    } else if (now.recording && !now.paused && prev.paused) {
      setPlaying(wantsAutoScroll);
    }
  }, [
    contentState.recording,
    contentState.paused,
    contentState.recordingType,
    contentState.surface,
    win,
  ]);

  const t = (key, fallback) => chrome.i18n.getMessage(key) || fallback;

  useEffect(() => {
    if (!contentState.recording) setConfirmKind(null);
  }, [contentState.recording]);

  // Restart and discard normally ask in a modal on the page, which is behind
  // the window being recorded. Ask here instead, pausing like the modal does.
  const askConfirm = (kind) => {
    pausedForConfirmRef.current = !contentState.paused;
    if (!contentState.paused) contentState.pauseRecording(kind === "discard");
    setConfirmKind(kind);
  };
  const cancelConfirm = () => {
    if (pausedForConfirmRef.current) contentState.resumeRecording();
    setConfirmKind(null);
  };
  const confirm = confirmKind
    ? {
        title:
          confirmKind === "restart"
            ? t("restartModalTitle", "Restart recording?")
            : t("discardModalTitle", "Discard recording?"),
        confirmLabel:
          confirmKind === "restart"
            ? t("restartModalRestart", "Restart")
            : t("discardModalDiscard", "Discard"),
        cancelLabel:
          confirmKind === "restart"
            ? t("restartModalResume", "Resume")
            : t("discardModalResume", "Resume"),
        onCancel: cancelConfirm,
        onConfirm: () => {
          setConfirmKind(null);
          if (confirmKind === "restart") contentState.restartRecording();
          else contentState.dismissRecording("user-discard-confirmed");
        },
      }
    : null;

  const micAvailable =
    Boolean(contentState.microphonePermission) &&
    contentState.defaultAudioInput !== "none";
  const onMic = () => {
    const pressed = !contentState.micActive;
    setContentState((prev) => ({ ...prev, micActive: pressed }));
    chrome.storage.local.set({ micActive: pressed });
    chrome.runtime.sendMessage({
      type: "set-mic-active-tab",
      active: pressed,
      defaultAudioInput: contentState.defaultAudioInput,
    });
    contentState.openToast?.(
      chrome.i18n.getMessage(pressed ? "micOnToast" : "micOffToast"),
      () => {}
    );
  };

  // Same actions as the on-page toolbar, Record included (via beginRecording).
  // Shown before the take with take-only buttons held back, so the bar does not
  // appear all at once when the countdown ends.
  const controls = {
    inactive: !contentState.recording,
    // Region capture needs the current tab, which Chrome resolves to the
    // window clicked in, so it can only start from the page.
    recordLabel:
      contentState.recordingType === "region"
        ? t(
            "teleprompterRegionStartOnPage",
            "Region recording must be started from the page"
          )
        : t("recordButtonLabel", "Start recording"),
    recordDisabled: Boolean(
      contentState.recordingType === "region" ||
        contentState.pendingRecording ||
        contentState.preparingRecording ||
        contentState.restartingRecording ||
        contentState.countdownActive ||
        contentState.startGateOpen ||
        contentState.finalizingRecording ||
        (contentState.recordingType === "camera" &&
          (!contentState.cameraPermission || !contentState.cameraActive))
    ),
    onRecord: () => beginRecording(contentStateRef.current, "floating-window"),
    paused: Boolean(contentState.paused),
    busy: Boolean(contentState.finalizingRecording),
    micOn: Boolean(contentState.micActive),
    micLevel,
    micAvailable,
    micLabel: micAvailable
      ? t(
          contentState.micActive
            ? "disableMicrophoneTooltip"
            : "enableMicrophoneTooltip",
          "Microphone"
        )
      : t("noMicrophonePermissionsTooltip", "Microphone"),
    pauseLabel: t("pauseRecordingTooltip", "Pause"),
    resumeLabel: t("resumeRecordingTooltip", "Resume"),
    stopLabel: t("finishRecordingTooltip", "Finish recording"),
    restartLabel: t("restartRecordingTooltip", "Restart"),
    discardLabel: t("cancelRecordingTooltip", "Discard"),
    onMic,
    onPause: () => contentState.pauseRecording(),
    onResume: () => contentState.resumeRecording(),
    onStop: () => contentState.stopRecording(),
    onRestart: () => askConfirm("restart"),
    onDiscard: () => {
      if (contentState.askDismiss) askConfirm("discard");
      else contentState.dismissRecording("user-discard");
    },
    confirm,
  };

  if (!host) return null;
  const showScript = prompterOn && Boolean(settings);
  if (!showScript && !cameraOn && !controlsOn) return null;
  const takeActive = Boolean(contentState.recording);
  const cameraIsOwnTrack = cameraCanLiveInWindow({
    cloud: CLOUD_FEATURES_ENABLED,
    subscribed: Boolean(contentState.isSubscribed),
    instantMode: Boolean(contentState.instantMode),
  });
  // Bringing the script back would put it in the video, or next to a camera
  // that is burnt in.
  const canShowScript =
    !(takeActive && captureRecordsWindow(contentState)) &&
    !(!cameraIsOwnTrack && cameraOn);
  return (
    <>
      {meterOn &&
        host &&
        createPortal(
          <iframe
            title="Microphone level"
            src={chrome.runtime.getURL("camera.html?meter=1")}
            allow="microphone"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              border: "none",
              pointerEvents: "none",
            }}
          />,
          host
        )}
      {cameraHost &&
        cameraShown &&
        createPortal(
          <iframe
            title="Camera"
            src={chrome.runtime.getURL("camera.html?pip=1")}
            allow="camera; microphone"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
              pointerEvents: "none",
              transform: contentState.cameraFlipped ? "scaleX(-1)" : undefined,
            }}
          />,
          cameraHost
        )}
      {createPortal(
        <Teleprompter
          settings={settings || DEFAULT_SETTINGS}
          onSettings={onSettings}
          showScript={showScript}
          backdrop={cameraShown ? (showScript ? "scrim" : "none") : "solid"}
          hasCamera={cameraOn}
          quiet={takeActive && captureRecordsWindow(contentState)}
          onShowScript={() => openPipLayer("prompter", "show script")}
          canShowScript={canShowScript}
          paused={takeActive && Boolean(contentState.paused)}
          countdown={
            contentState.countdownValue > 0 ? contentState.countdownValue : null
          }
          playing={playing}
          canPlay={takeActive}
          onPlayingChange={setPlaying}
          rewindToken={rewindToken}
          onRewind={() => {
            setPlaying(false);
            setRewindToken((n) => n + 1);
          }}
          onHide={() => {
            openPipLayer("controls");
            closePipLayer("prompter");
          }}
          timerLabel={takeActive ? formatClock(seconds) : null}
          controls={controls}
        />,
        host
      )}
    </>
  );
};

export default TeleprompterController;
