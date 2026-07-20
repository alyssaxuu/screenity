import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { updateFromStorage } from "./utils/updateFromStorage";
import { shouldResendCropTarget } from "./cropTargetGate";
import { lifecycle } from "../../utils/lifecycleLog";
import { perfMark, perfReset } from "../../utils/perfMarks";

import Shortcuts from "../shortcuts/Shortcuts";
import DevHUD from "../DevHUD";

import { setupHandlers } from "./messaging/handlers";

import { checkAuthStatus } from "./utils/checkAuthStatus";
import {
  initStartFlowTrace,
  traceStep,
  setStartFlowOutcome,
} from "../../utils/startFlowTrace";
import { triggerSupportDownload } from "../../utils/triggerSupportDownload";

export const contentStateContext = createContext();
export const contentStateRef = { current: null };
export let setContentState = () => {};
export let setTimer = () => {};

const CURSOR_EFFECTS = ["target", "highlight", "spotlight"];

const normalizeCursorEffects = (effects) => {
  if (!Array.isArray(effects)) return [];
  return effects.filter((effect) => CURSOR_EFFECTS.includes(effect));
};

const deriveCursorMode = (effects, fallbackMode) => {
  if (effects.length === 0) return "none";
  if (effects.length === 1) return effects[0];
  if (fallbackMode && effects.includes(fallbackMode)) return fallbackMode;
  return effects[0] || "none";
};

// Scope the recording toolbar + camera bubble to the recorded tab for
// tab/region recordings (they leak into other tabs today). Computation errs
// toward showing; setting this false restores the prior always-show behavior.
const ENABLE_TAB_SCOPED_UI = true;

const ContentState = (props) => {
  const [timer, setTimerInternal] = React.useState(0);
  const CLOUD_FEATURES_ENABLED =
    process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
  setTimer = setTimerInternal;
  const [URL] = useState(
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/why-does-screenity-ask-for-permissions/9AAE8zJ6iiUtCAtjn4SUT1",
  );
  const [URL2] = useState(
    "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9",
  );
  const startBeepRef = useRef(null);
  const stopBeepRef = useRef(null);
  const prevRecordingRef = useRef(null);
  const hydratedRef = useRef(false);
  const suppressStopBeepRef = useRef(false);
  const suppressStartBeepRef = useRef(false);
  const tabIdRef = useRef(null);
  const activeTabRef = useRef(null);
  const tabRecordedIdRef = useRef(null);
  const recordingUiTabRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  // Cached pause state for the timer; refreshed via storage.onChanged.
  // Lets the tick loop read sync refs instead of awaiting storage
  // every second (storage IPC can stall multi-second on contended Chrome).
  const pausedRef = useRef(false);
  const pausedAtRef = useRef(null);
  const totalPausedMsRef = useRef(0);
  const recordingFlagRef = useRef(false);
  const timerReadSeqRef = useRef(0);
  const lastBeepStartTimeRef = useRef(null);
  const recordingBeepTabIdRef = useRef(null);
  const verifyDebounceRef = useRef(null);

  const isTargetTab = useCallback(() => {
    const tabId = tabIdRef.current;
    const tabRecordedID = tabRecordedIdRef.current;
    const recordingUiTabId = recordingUiTabRef.current;
    const activeTab = activeTabRef.current;

    if (tabRecordedID != null) {
      return tabId != null && tabId === tabRecordedID;
    }
    if (recordingUiTabId != null) {
      return tabId != null && tabId === recordingUiTabId;
    }
    if (activeTab != null) {
      return tabId != null && tabId === activeTab;
    }
    return true;
  }, []);

  // Whether THIS tab may render the recording UI. For tab/region recordings the
  // toolbar + camera belong to the recorded tab only; desktop/screen/camera-only
  // and idle are unaffected (always allowed). Errs toward showing while the tab
  // id is still unknown so the recorded tab never flashes blank on navigation.
  // The render gate in Wrapper reads contentState.recordingUiAllowed.
  const recomputeRecordingUiAllowed = useCallback(
    (reason) => {
      const s = contentStateRef.current;
      const type = s?.recordingType;
      const tabBoundFlow =
        (type === "tab" || type === "region") &&
        Boolean(
          s?.recording ||
            s?.countdownActive ||
            s?.isCountdownVisible ||
            s?.preparingRecording ||
            s?.pendingRecording,
        );
      let allowed = true;
      if (ENABLE_TAB_SCOPED_UI && tabBoundFlow && tabIdRef.current != null) {
        allowed = isTargetTab();
      }
      if (s?.recordingUiAllowed !== allowed) {
        lifecycle("Content.ContentState", "recording-ui-allowed", {
          allowed,
          reason,
          tabId: tabIdRef.current,
          tabRecordedID: tabRecordedIdRef.current,
          recordingUiTabId: recordingUiTabRef.current,
          recordingType: type,
          tabBoundFlow,
        });
        setContentState((prev) => ({ ...prev, recordingUiAllowed: allowed }));
      }
    },
    [isTargetTab],
  );

  const verifyUser = useCallback(async () => {
    if (!CLOUD_FEATURES_ENABLED) return;
    // Don't force a cookie-based re-login from the popup: a fresh install with
    // no prior signals stays logged out (shows the welcome immediately) until
    // the user explicitly clicks "Log in". Returning users still auto-verify
    // via hasPriorSignals in loginWithWebsite.
    const result = await checkAuthStatus({ force: false });

    setContentState((prev) => ({
      ...prev,
      isLoggedIn: result.authenticated,
      screenityUser: result.user,
      isSubscribed: result.subscribed,
      hasSubscribedBefore: result.hasSubscribedBefore,
      proSubscription: result.proSubscription,
      ...(result.authenticated ? { wasLoggedIn: false } : {}),
    }));

    if (result.authenticated) {
      // Client-side zoom is unavailable for authenticated users.
      setContentState((prev) => ({
        ...prev,
        zoomEnabled: false,
      }));

      chrome.storage.local.set({
        zoomEnabled: false,
        wasLoggedIn: false,
      });
    }
  }, [CLOUD_FEATURES_ENABLED]);
  useEffect(() => {
    verifyUser();
  }, [verifyUser]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "get-tab-id" }, (response) => {
      if (response?.tabId !== undefined && response?.tabId !== null) {
        tabIdRef.current = response.tabId;
        recomputeRecordingUiAllowed("tab-id");
      }
    });

    chrome.storage.local.get(
      [
        "activeTab",
        "tabRecordedID",
        "recordingUiTabId",
        "recordingStartTime",
        "recordingBeepTabId",
        "recordingNow",
      ],
      (result) => {
        activeTabRef.current = result.activeTab ?? null;
        tabRecordedIdRef.current = result.tabRecordedID ?? null;
        recordingUiTabRef.current = result.recordingUiTabId ?? null;
        recordingStartTimeRef.current = result.recordingStartTime ?? null;
        recordingBeepTabIdRef.current = result.recordingBeepTabId ?? null;
        recomputeRecordingUiAllowed("storage-mount");
      },
    );
  }, [recomputeRecordingUiAllowed]);

  // Recompute the recording-UI scope on visibility/focus. Unlike
  // reconcileOnVisible (which bails during active recording), this runs during
  // recording too, so a tab the user switches to mid-recording re-scopes. Flow
  // changes (recording/type/scoping) trigger a recompute from the storage
  // onChanged listener below. Deps are the stable callback only; this effect
  // runs before `contentState` is declared, so it must not reference it.
  useEffect(() => {
    recomputeRecordingUiAllowed("mount");
    const onVisible = () => recomputeRecordingUiAllowed("visibility");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [recomputeRecordingUiAllowed]);

  // Permissions-Policy camera=()/microphone=() surfaces as NotAllowedError, not a
  // real permission issue. This top-page probe misses feature=(self) (facebook.com);
  // that's caught by the permissions.html iframe message. display-capture blocks only region.
  useEffect(() => {
    try {
      const pp = document.permissionsPolicy || document.featurePolicy;
      if (!pp || typeof pp.allowsFeature !== "function") return;
      const cameraBlocked = !pp.allowsFeature("camera");
      const micBlocked = !pp.allowsFeature("microphone");
      const displayCaptureBlocked = !pp.allowsFeature("display-capture");
      if (cameraBlocked || micBlocked || displayCaptureBlocked) {
        setContentState((prev) => ({
          ...prev,
          sitePermissionsBlocked:
            prev.sitePermissionsBlocked || cameraBlocked || micBlocked,
          siteDisplayCaptureBlocked:
            prev.siteDisplayCaptureBlocked || displayCaptureBlocked,
        }));
      }
    } catch {}
  }, []);

  const startRecording = useCallback(() => {
    const shouldClearCountdown =
      !contentStateRef.current?.isCountdownVisible &&
      !contentStateRef.current?.countdownActive;
    if (contentStateRef.current.alarm) {
      if (contentStateRef.current.alarmTime === 0) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          alarm: false,
        }));
        chrome.storage.local.set({ alarm: false });
        setTimer(0);
      } else {
        setTimer(contentStateRef.current.alarmTime);
      }
    } else {
      setTimer(0);
    }
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: true,
      paused: false,
      timeWarning: false,
      pendingRecording: false,
      preparingRecording: false,
      ...(shouldClearCountdown
        ? { countdownActive: false, isCountdownVisible: false }
        : {}),
    }));
    if (tabIdRef.current != null) {
      const preferredTab =
        tabRecordedIdRef.current ??
        recordingUiTabRef.current ??
        tabIdRef.current;
      chrome.storage.local.set({ recordingBeepTabId: preferredTab });
      recordingBeepTabIdRef.current = preferredTab;
    }
    chrome.storage.local.set({ restarting: false });
    traceStep("recordingStarted");
    setStartFlowOutcome("ok");
  }, []);

  const restartRecording = useCallback(() => {
    // Suppress the stop beep: restart transitions recording true→false briefly.
    suppressStopBeepRef.current = true;
    const sourceTabId = tabIdRef.current ?? activeTabRef.current ?? null;
    chrome.storage.local.set({ restarting: true });
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "handle-restart", sourceTabId });
      if (contentStateRef.current.alarm) {
        setTimer(contentStateRef.current.alarmTime);
      } else {
        setTimer(0);
      }
      setContentState((prevContentState) => ({
        ...prevContentState,
        recording: false,
        time: 0,
        paused: false,
        // Restart-wait flag: shows the RecordingLoader during the
        // restart gap. The normal pre-countdown loader doesn't fire
        // here because restart reuses streams (no picker → no
        // visibility flip). Wrapper.jsx skips its visibility gate
        // when this is true. Clears on next countdown / recording.
        restartingRecording: true,
      }));
    }, 100);
  }, []);

  useEffect(() => {
    (async () => {
      let realSupport = false;

      if ("VideoEncoder" in window) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec: "vp8",
            width: 16,
            height: 16,
          });
          realSupport = support.supported;
        } catch {}
      }

      chrome.storage.local.set({ realWebCodecsSupport: realSupport });
    })();
  }, []);

  const stopRecording = useCallback(() => {
    // re-entry guard: if a previous stop is still finalizing, ignore.
    if (contentStateRef.current.finalizingRecording) return;
    chrome.runtime.sendMessage({ type: "clear-recording-alarm" });
    const isMulti = contentStateRef.current.multiMode;
    // Preserve the user's tool state in multi-mode so they keep their
    // pen / blur / cursor selection between scenes. Single-mode still
    // tears them down because the editor takes over after stop.
    chrome.storage.local.set({
      restarting: false,
      tabRecordedID: null,
      ...(isMulti
        ? {}
        : {
            drawingMode: false,
            blurMode: false,
            cursorMode: "none",
            cursorEffects: [],
          }),
    });
    // Keep the RecordingLoader up until BG opens the editor. Setting
    // recording:false here would flash an idle "00:00" toolbar during
    // the 1-6s finalize window.
    setContentState((prevContentState) => ({
      ...prevContentState,
      finalizingRecording: true,
      paused: false,
      timeWarning: false,
      tabCaptureFrame: false,
      pipEnded: false,
      // Preserve tool state in multi so reopen-popup-multi can
      // carry it to the next scene.
      ...(isMulti
        ? {}
        : {
            drawingMode: false,
            blurMode: false,
            toolbarMode: "",
            cursorMode: "none",
            cursorEffects: [],
          }),
    }));
    const elements = document.querySelectorAll(".screenity-blur");
    elements.forEach((element) => {
      element.classList.remove("screenity-blur");
    });
    perfMark("Content stop-click", { reason: "content-toolbar-stop" });
    // Play the stop beep on click, not via the recording-state effect.
    // finalizingRecording keeps contentState.recording true through
    // finalize / multi-reopen, so the effect-driven beep would fire
    // seconds late. Always fire on click + always suppress the effect.
    try {
      playBeep(stopBeepRef, "assets/sounds/beep.mp3");
    } catch {}
    suppressStopBeepRef.current = true;
    chrome.runtime.sendMessage(
      { type: "stop-recording-tab", reason: "content-toolbar-stop" },
      (res) => {
      if (!res || res.ok !== true) {
        console.warn("Stop command not acknowledged, retrying…");
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: "stop-recording-tab",
            reason: "content-toolbar-stop-retry",
          });
        }, 200);
      }
      },
    );
    // Watchdog: clear finalizing if BG never signals editor-open.
    // 30s is past worst-case (encoder flush is ~15s cap).
    setTimeout(() => {
      setContentState((prev) => {
        if (!prev.finalizingRecording) return prev;
        const wasMulti = prev.multiMode === true;
        return {
          ...prev,
          finalizingRecording: false,
          preparingRecording: false,
          pendingRecording: false,
          recording: false,
          paused: false,
          time: 0,
          timer: 0,
          timeWarning: false,
          tabCaptureFrame: false,
          pipEnded: false,
          showExtension: wasMulti ? true : false,
          showPopup: wasMulti ? true : true,
          // Preserve tool state in multi-mode (see editor-open cleanup
          // for the rationale).
          drawingMode: wasMulti ? prev.drawingMode : false,
          blurMode: wasMulti ? prev.blurMode : false,
          toolbarMode: wasMulti ? prev.toolbarMode : "",
          cursorMode: wasMulti ? prev.cursorMode : "none",
          cursorEffects: wasMulti ? prev.cursorEffects : [],
          cameraActive: false,
        };
      });
      setTimer(0);
    }, 30000);
  });

  const pauseRecording = useCallback((dismiss) => {
    if (contentStateRef.current?.paused) return;
    chrome.runtime.sendMessage({ type: "pause-recording-tab" });

    // Freeze the timer immediately. Recorder's storage write lags
    // 50-150ms through BG IPC, visible as the timer continuing while
    // the dismiss-confirm modal is open.
    pausedRef.current = true;
    pausedAtRef.current = Date.now();

    setTimeout(() => {
      setContentState((prev) => ({
        ...prev,
        paused: true,
      }));
      if (!dismiss) {
        contentStateRef.current.openToast(
          chrome.i18n.getMessage("pausedRecordingToast"),
          function () {},
        );
      }
    }, 100);
  });

  const resumeRecording = useCallback(() => {
    if (!contentStateRef.current?.paused) return;
    chrome.runtime.sendMessage({ type: "resume-recording-tab" });

    // Mirror Recorder's totalPausedMs locally so the elapsed value
    // stays stable on unfreeze instead of jumping when storage lands.
    const now = Date.now();
    if (pausedAtRef.current) {
      totalPausedMsRef.current =
        (totalPausedMsRef.current || 0) +
        Math.max(0, now - pausedAtRef.current);
    }
    pausedRef.current = false;
    pausedAtRef.current = null;

    setContentState((prev) => ({
      ...prev,
      paused: false,
    }));
  });

  const dismissRecording = useCallback((reason = "user-dismiss") => {
    setStartFlowOutcome("cancelled");
    suppressStopBeepRef.current = true;
    chrome.runtime.sendMessage({ type: "clear-recording-alarm" });
    chrome.storage.local.set({
      restarting: false,
      tabRecordedID: null,
      drawingMode: false,
      blurMode: false,
      cursorMode: "none",
      cursorEffects: [],
    });
    // Stamp the dismiss with the project it is meant for, so a stale dismiss
    // can't tear down a different (back-to-back) recording.
    chrome.storage.local.get(["projectId"], (res) => {
      chrome.runtime.sendMessage({
        type: "dismiss-recording-tab",
        reason: typeof reason === "string" ? reason : "user-dismiss",
        projectId: res?.projectId || null,
      });
    });
    setContentState((prevContentState) => ({
      ...prevContentState,
      recording: false,
      paused: false,
      showExtension: false,
      timeWarning: false,
      showPopup: true,
      time: 0,
      timer: 0,
      tabCaptureFrame: false,
      pendingRecording: false,
      preparingRecording: false,
      pipEnded: false,
      blurMode: false,
      drawingMode: false,
      // Mirror the storage write to avoid a frame where the cursor overlay
      // renders on top of a "dismissed" UI while onChanged propagates.
      cursorMode: "none",
      cursorEffects: [],
    }));
    const elements = document.querySelectorAll(".screenity-blur");
    elements.forEach((element) => {
      element.classList.remove("screenity-blur");
    });
    setTimer(0);
  });

  const checkChromeCapturePermissions = useCallback(async () => {
    const permissions = ["desktopCapture", "alarms", "offscreen"];

    if (
      contentStateRef.current?.isLoggedIn &&
      contentStateRef.current?.isSubscribed
    ) {
      permissions.push("clipboardWrite");
    }

    const containsPromise = new Promise((resolve) => {
      chrome.permissions.contains({ permissions }, (result) => {
        resolve(result);
      });
    });

    const result = await containsPromise;

    if (!result) {
      const requestPromise = new Promise((resolve) => {
        chrome.permissions.request({ permissions }, (granted) => {
          resolve(granted);
        });
      });

      const granted = await requestPromise;

      if (!granted) {
        return false;
      } else {
        chrome.runtime.sendMessage({ type: "add-alarm-listener" });
        return true;
      }
    } else {
      return true;
    }
  }, []);

  // Must be invoked synchronously from a user-gesture handler so the
  // activation propagates through sendMessage. Awaiting the returned Promise
  // is fine; awaiting anything before invoking is not.
  const checkChromeCapturePermissionsSW = useCallback(() => {
    const { isLoggedIn, isSubscribed } = contentStateRef.current || {};
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "check-capture-permissions", isLoggedIn, isSubscribed },
        (response) => {
          resolve(Boolean(response && response.status === "ok"));
        },
      );
    });
  }, []);

  const startStreaming = useCallback(async () => {
    // Double-click guard: a previous start may still be in flight.
    const snap = await chrome.storage.local.get([
      "pendingRecording",
      "recording",
      "restarting",
    ]);
    if (snap.pendingRecording || snap.recording || snap.restarting) {
      return;
    }

    // Region capture runs getDisplayMedia in our in-page iframe, so a host page
    // that won't delegate display-capture (e.g. facebook.com) rejects it before any
    // picker. The popup disables this, but the shortcut path doesn't, so backstop it.
    if (
      contentStateRef.current?.recordingType === "region" &&
      contentStateRef.current?.siteDisplayCaptureBlocked
    ) {
      contentStateRef.current.openToast?.(
        chrome.i18n.getMessage("tabRecordingDisabledToast"),
        4000,
      );
      return;
    }

    // Kick off synchronously: later awaits (initStartFlowTrace, Pro storage
    // quota) would consume the click's user-gesture before it reaches
    // chrome.permissions.request in the SW.
    const isExtensionPage = window.location.href.includes("chrome-extension://");
    const permissionPromise = isExtensionPage
      ? null
      : checkChromeCapturePermissionsSW();

    const attemptId = `ra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    await initStartFlowTrace(attemptId, {
      recordingType: contentStateRef.current.recordingType,
      isPro: Boolean(
        contentStateRef.current.isLoggedIn &&
        contentStateRef.current.isSubscribed &&
        CLOUD_FEATURES_ENABLED,
      ),
      countdown: Boolean(contentStateRef.current.countdown),
    });
    traceStep("startStreaming");
    perfReset();
    perfMark("Content startStreaming.click", {
      recordingType: contentStateRef.current.recordingType,
    });

    // Overlay non-blocking while pending; popup stays open until recorder tab
    // takes focus. Clear countdownCancelled to avoid stale block. Storage
    // write must precede recorder-tab open so the activation listener sees it.
    chrome.storage.local.set({ pendingRecording: true });
    setContentState((prev) => ({
      ...prev,
      pendingRecording: true,
      countdownCancelled: false,
      // Reset the latched loader gate for the new session; the
      // overlay can show during this session's pre-countdown wait
      // until the countdown appears, then it's permanently off.
      countdownEverShown: false,
    }));

    let permission = false;

    if (
      contentStateRef.current?.isLoggedIn &&
      contentStateRef.current?.isSubscribed &&
      CLOUD_FEATURES_ENABLED
    ) {
      const storageResponse = await chrome.runtime.sendMessage({
        type: "check-storage-quota",
      });

      const { success, canUpload, error } = storageResponse;

      if (success && canUpload === false) {
        contentStateRef.current.openModal(
          chrome.i18n.getMessage("storageLimitReachedTitle"),
          chrome.i18n.getMessage("storageLimitReachedDescription"),
          chrome.i18n.getMessage("manageStorageButtonLabel"),
          chrome.i18n.getMessage("closeModalLabel"),
          () => {
            window.open(process.env.SCREENITY_APP_BASE, "_blank");
          },
          () => {},
        );
      } else if (!success) {
        const isSubError = error === "Subscription inactive";
        const isAuthError = error === "Not authenticated";

        if (isSubError) {
          contentStateRef.current.setContentState((prev) => ({
            ...prev,
            isSubscribed: false,
          }));
        } else if (isAuthError) {
          contentStateRef.current.setContentState((prev) => ({
            ...prev,
            isSubscribed: false,
            isLoggedIn: false,
            screenityUser: null,
            proSubscription: null,
          }));
        }

        const message = isAuthError
          ? chrome.i18n.getMessage("storageCheckFailAuthDescription")
          : chrome.i18n.getMessage("storageCheckFailDescription");

        contentStateRef.current.openModal(
          chrome.i18n.getMessage("storageCheckFailTitle"),
          message,
          chrome.i18n.getMessage("retryButtonLabel"),
          chrome.i18n.getMessage("closeModalLabel"),
          async () => {
            window.location.reload();
          },
          () => {},
        );
      }

      if (!success || (success && canUpload === false)) {
        setStartFlowOutcome("error", {
          error: canUpload === false ? "storage-limit" : (error || "quota-check-failed"),
        });
        // Explicit storage write; see note on the removed
        // contentState→storage useEffect.
        chrome.storage.local.set({ pendingRecording: false });
        setContentState((prev) => ({
          ...prev,
          pendingRecording: false,
          preparingRecording: false,
        }));
        return;
      }
    }

    if (isExtensionPage) {
      permission = await checkChromeCapturePermissions();
    } else {
      permission = await permissionPromise;
    }

    if (!permission) {
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("chromePermissionsModalTitle"),
        chrome.i18n.getMessage("chromePermissionsModalDescription"),
        chrome.i18n.getMessage("chromePermissionsModalAction"),
        chrome.i18n.getMessage("chromePermissionsModalCancel"),
        () => {
          // Direct call so the click's gesture reaches the sync permission check.
          startStreaming();
        },
        () => {},
        null,
        chrome.i18n.getMessage("learnMoreDot"),
        URL,
        true,
      );
      setStartFlowOutcome("cancelled", { error: "permission-denied" });
      chrome.storage.local.set({ pendingRecording: false });
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
        preparingRecording: false,
      }));
      return;
    }

    const data = await chrome.runtime.sendMessage({ type: "available-memory" });

    if (
      data.quota < 524288000 &&
      !contentStateRef.current.isLoggedIn &&
      !contentStateRef.current.isSubscribed
    ) {
      if (typeof contentStateRef.current.openModal === "function") {
        let clear = null;
        let clearAction = () => {};
        const helpURL =
          "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb";

        const response = await chrome.runtime.sendMessage({
          type: "check-restore",
        });
        if (response.restore) {
          clear = chrome.i18n.getMessage("clearSpaceButton");
          clearAction = () => {
            chrome.runtime.sendMessage({ type: "clear-recordings" });
          };
        }

        contentStateRef.current.openModal(
          chrome.i18n.getMessage("notEnoughSpaceTitle"),
          chrome.i18n.getMessage("notEnoughSpaceDescription"),
          clear,
          chrome.i18n.getMessage("permissionsModalDismiss"),
          clearAction,
          () => {},
          null,
          chrome.i18n.getMessage("learnMoreDot"),
          helpURL,
          false,
          chrome.i18n.getMessage("getHelpButton"),
          () => {
            triggerSupportDownload({ source: "not-enough-space" });
            chrome.runtime.sendMessage({
              type: "report-error",
              errorCode: "REC_RUN_MEMORY",
              source: "not-enough-space",
              zipBundled: true,
            });
          },
        );
      }
      setStartFlowOutcome("error", { error: "insufficient-memory" });
      chrome.storage.local.set({ pendingRecording: false });
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
        preparingRecording: false,
      }));
      return;
    }
    chrome.storage.local.set({
      tabRecordedID: null,
    });

    // Sent only after the mic-muted modal is confirmed: this makes the recorder
    // call getDisplayMedia, so sending it earlier pops the picker behind the modal.
    const sendRegionCropTarget = () => {
      if (
        contentStateRef.current.recordingType === "region" &&
        contentStateRef.current.cropTarget &&
        contentStateRef.current.regionCaptureRef?.contentWindow
      ) {
        contentStateRef.current.regionCaptureRef.contentWindow.postMessage(
          {
            type: "crop-target",
            target: contentStateRef.current.cropTarget,
            width: contentStateRef.current.regionWidth,
            height: contentStateRef.current.regionHeight,
          },
          "*",
        );
      }
    };

    setContentState((prevContentState) => ({
      ...prevContentState,
      showOnboardingArrow: false,
    }));

    if (
      !contentStateRef.current.micActive &&
      contentStateRef.current.askMicrophone
    ) {
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("micMutedModalTitle"),
        chrome.i18n.getMessage("micMutedModalDescription"),
        chrome.i18n.getMessage("micMutedModalAction"),
        chrome.i18n.getMessage("micMutedModalCancel"),
        () => {
          // Crop target first (after the user confirmed mic-off): this flushes
          // the recorder's deferred streaming-data and starts getDisplayMedia.
          sendRegionCropTarget();
          chrome.runtime.sendMessage({
            type: "desktop-capture",
            region:
              contentStateRef.current.recordingType === "region" ? true : false,
            customRegion: contentStateRef.current.customRegion,
            offscreenRecording: contentStateRef.current.offscreenRecording,
            camera:
              contentStateRef.current.recordingType === "camera" ? true : false,
          });
          setContentState((prevContentState) => ({
            ...prevContentState,

            surface: "default",
            pipEnded: false,
          }));
        },
        () => {
          setStartFlowOutcome("cancelled", { error: "mic-muted-cancel" });
          chrome.storage.local.set({ pendingRecording: false });
          setContentState((prevContentState) => ({
            ...prevContentState,
            pendingRecording: false,
            preparingRecording: false,
          }));
        },
        false,
        false,
        false,
        false,
        chrome.i18n.getMessage("noShowAgain"),
        () => {
          setContentState((prevContentState) => ({
            ...prevContentState,
            askMicrophone: false,
          }));
          chrome.storage.local.set({ askMicrophone: false });
        },
      );
    } else {
      // Crop target first: flushes the recorder's deferred streaming-data and
      // starts getDisplayMedia (no mic modal to gate behind in this branch).
      sendRegionCropTarget();
      perfMark("Content desktop-capture.sent");
      // Sync recordingType to storage so the cloudrecorder tab reads
      // the current pick, not a stale value from a prior session.
      // Mismatch causes the CR dispatch to land in the null-tabID
      // branch and crash with REC_START_CANCEL.
      chrome.storage.local.set({
        recordingType: contentStateRef.current.recordingType || "screen",
      });
      chrome.runtime.sendMessage({
        type: "desktop-capture",
        region:
          contentStateRef.current.recordingType === "region" ? true : false,
        customRegion: contentStateRef.current.customRegion,
        offscreenRecording: contentStateRef.current.offscreenRecording,
        camera:
          contentStateRef.current.recordingType === "camera" ? true : false,
      });
      traceStep("desktopCaptureSent");
      setContentState((prevContentState) => ({
        ...prevContentState,

        surface: "default",
        pipEnded: false,
      }));
    }
  }, [contentStateRef]);

  const tryRestartRecording = useCallback(() => {
    if (!contentStateRef.current.paused) {
      contentStateRef.current.pauseRecording();
    }
    contentStateRef.current.openModal(
      chrome.i18n.getMessage("restartModalTitle"),
      chrome.i18n.getMessage("restartModalDescription"),
      chrome.i18n.getMessage("restartModalRestart"),
      chrome.i18n.getMessage("restartModalResume"),
      () => {
        contentStateRef.current.restartRecording();
      },
      () => {
        contentStateRef.current.resumeRecording();
      },
    );
  }, []);

  const tryDismissRecording = useCallback(() => {
    if (contentStateRef.current.askDismiss) {
      if (!contentStateRef.current.paused) {
        contentStateRef.current.pauseRecording(true);
      }
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("discardModalTitle"),
        chrome.i18n.getMessage("discardModalDescription"),
        chrome.i18n.getMessage("discardModalDiscard"),
        chrome.i18n.getMessage("discardModalResume"),
        () => {
          contentStateRef.current.dismissRecording("user-discard-confirmed");
        },
        () => {
          contentStateRef.current.resumeRecording();
        },
      );
    } else {
      contentStateRef.current.dismissRecording("user-discard");
    }
  }, [contentStateRef]);

  const handleDevicePermissions = (data) => {
    if (data && data != undefined && data.success) {
      const audioInput = data.audioinput;
      const videoInput = data.videoinput;
      const cameraPermission = data.cameraPermission;
      const microphonePermission = data.microphonePermission;

      setContentState((prevContentState) => ({
        ...prevContentState,
        audioInput: audioInput,
        videoInput: videoInput,
        cameraPermission: cameraPermission,
        microphonePermission: microphonePermission,
      }));

      const audioInputById = Array.isArray(audioInput)
        ? Object.fromEntries(
            audioInput.map((device) => [device.deviceId, device.label]),
          )
        : {};
      const videoInputById = Array.isArray(videoInput)
        ? Object.fromEntries(
            videoInput.map((device) => [device.deviceId, device.label]),
          )
        : {};

      const defaultAudioInputLabel =
        audioInputById[contentStateRef.current.defaultAudioInput] || "";
      const defaultVideoInputLabel =
        videoInputById[contentStateRef.current.defaultVideoInput] || "";

      setContentState((prevContentState) => ({
        ...prevContentState,
        defaultAudioInputLabel:
          defaultAudioInputLabel || prevContentState.defaultAudioInputLabel,
        defaultVideoInputLabel:
          defaultVideoInputLabel || prevContentState.defaultVideoInputLabel,
      }));

      chrome.storage.local.set({
        defaultAudioInputLabel:
          defaultAudioInputLabel ||
          contentStateRef.current.defaultAudioInputLabel,
        defaultVideoInputLabel:
          defaultVideoInputLabel ||
          contentStateRef.current.defaultVideoInputLabel,
      });

      chrome.runtime.sendMessage({
        type: "switch-camera",
        id: contentStateRef.current.defaultVideoInput,
      });

      if (!contentStateRef.current.setDevices) {
        if (audioInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            defaultAudioInput: audioInput[0].deviceId,
            defaultAudioInputLabel: audioInput[0].label || "",
            micActive: true,
          }));
          chrome.storage.local.set({
            defaultAudioInput: audioInput[0].deviceId,
            defaultAudioInputLabel: audioInput[0].label || "",
            micActive: true,
          });
        }
        if (videoInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            defaultVideoInput: videoInput[0].deviceId,
            defaultVideoInputLabel: videoInput[0].label || "",
            cameraActive: true,
          }));
          chrome.storage.local.set({
            defaultVideoInput: videoInput[0].deviceId,
            defaultVideoInputLabel: videoInput[0].label || "",
            cameraActive: true,
          });
        }
        if (audioInput.length > 0 || videoInput.length > 0) {
          setContentState((prevContentState) => ({
            ...prevContentState,
            setDevices: true,
          }));
          chrome.storage.local.set({
            setDevices: true,
          });
        }
      }
    } else {
      setContentState((prevContentState) => ({
        ...prevContentState,
        cameraPermission: false,
        microphonePermission: false,
      }));
      if (contentStateRef.current.askForPermissions) {
        if (contentStateRef.current.sitePermissionsBlocked) {
          // Site's Permissions-Policy blocks camera/mic; not user-grantable. Warn
          // instead of the "check your permissions" modal that implies the user
          // can fix it in the address bar.
          contentStateRef.current.openWarning?.(
            chrome.i18n.getMessage("cameraMicBlockedTitle"),
            chrome.i18n.getMessage("cameraMicBlockedDescription"),
            "VideoOffIcon",
            10000,
          );
        } else {
          contentStateRef.current.openModal(
            chrome.i18n.getMessage("permissionsModalTitle"),
            chrome.i18n.getMessage("permissionsModalDescription"),
            chrome.i18n.getMessage("permissionsModalDismiss"),
            chrome.i18n.getMessage("permissionsModalNoShowAgain"),
            () => {},
            () => {
              noMorePermissions();
            },
            chrome.runtime.getURL("assets/helper/permissions.webp"),
            chrome.i18n.getMessage("learnMoreDot"),
            URL2,
            true,
            false,
          );
        }
      }
    }
  };

  const noMorePermissions = useCallback(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      askForPermissions: false,
    }));
    chrome.storage.local.set({ askForPermissions: false });
  });

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.type === "screenity-permissions") {
        handleDevicePermissions(event.data);
      } else if (event.data.type === "screenity-permissions-loaded") {
        setContentState((prevContentState) => ({
          ...prevContentState,
          permissionsLoaded: true,
        }));
      } else if (event.data.type === "screenity-site-policy") {
        // Accurate host-page Permissions-Policy read from the cross-origin
        // permissions.html iframe: feature=(self) (e.g. facebook.com) blocks
        // our iframe even though the top-page probe above sees it as allowed.
        const camMicBlocked =
          event.data.cameraAllowed === false ||
          event.data.microphoneAllowed === false;
        const displayBlocked = event.data.displayCaptureAllowed === false;
        setContentState((prevContentState) => ({
          ...prevContentState,
          sitePermissionsBlocked:
            prevContentState.sitePermissionsBlocked || camMicBlocked,
          siteDisplayCaptureBlocked:
            prevContentState.siteDisplayCaptureBlocked || displayBlocked,
        }));
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const [contentState, setContentStateInternal] = useState({
    color: "#4597F7",
    strokeWidth: 2,
    drawingMode: false,
    tool: "pen",
    undoStack: [],
    redoStack: [],
    canvas: null,
    swatch: 1,
    time: 0,
    timer: 0,
    processingProgress: 0,
    recording: false,
    // True between stop click and editor-open (or watchdog fire).
    // Drives the toolbar "Saving recording…" state during finalize.
    // for 1-6s in the background.
    finalizingRecording: false,
    // True between restart click and next countdown / recording.
    // Drives the RecordingLoader during the restart gap. Cleared by
    // the storage listener on recording → true (or restarting →
    // by the countdown handler when the countdown begins.
    restartingRecording: false,
    // Mirrors storage.recording even during finalize (when local
    // contentState.recording stays true for UI continuity). Post-stop
    // loader gates on !encoderActive so it can't bleed into the video.
    encoderActive: false,
    // Latches the pre-countdown loader closed once the countdown
    // appears, so it can't re-show in the countdown-end → recording=true
    // gap (capture is already live by then and would burn in).
    // Reset on every fresh start.
    countdownEverShown: false,
    startRecording: startRecording,
    restartRecording: restartRecording,
    stopRecording: stopRecording,
    pauseRecording: pauseRecording,
    resumeRecording: resumeRecording,
    dismissRecording: dismissRecording,
    startStreaming: startStreaming,
    setToolbarMode: null,
    openModal: null,
    openToast: null,
    // Page-level Permissions-Policy disallows camera/mic. Lets us show a
    // site-specific warning instead of the misleading "check your permissions" one.
    sitePermissionsBlocked: false,
    // Page-level Permissions-Policy disallows display-capture (e.g.
    // facebook.com). Region capture runs getDisplayMedia in-page, so it can't
    // start here; lets us disable the tab-area tab instead of failing silently.
    siteDisplayCaptureBlocked: false,
    timeWarning: false,
    audioInput: [],
    videoInput: [],
    setDevices: false,
    defaultAudioInput: "none",
    defaultVideoInput: "none",
    defaultAudioInputLabel: "",
    defaultVideoInputLabel: "",
    cameraActive: false,
    micActive: false,
    sortBy: "newest",
    paused: false,
    toolbarPosition: {
      left: true,
      right: false,
      bottom: true,
      top: false,
      offsetX: 0,
      offsetY: 100,
    },
    popupPosition: {
      left: false,
      right: true,
      top: true,
      bottom: false,
      offsetX: 0,
      offsetY: 0,
      fixed: true,
    },
    cameraDimensions: {
      size: 200,
      x: 100,
      y: 100,
    },
    cameraFlipped: false,
    backgroundEffect: "blur",
    backgroundEffectsActive: false,
    countdown: true,
    showExtension: false,
    showPopup: false,
    blurMode: false,
    recordingType: "screen",
    customRegion: false,
    regionWidth: 800,
    surface: "default",
    regionHeight: 500,
    regionX: 100,
    regionY: 100,
    fromRegion: false,
    cropTarget: null,
    hideToolbar: false,
    alarm: false,
    alarmTime: 5 * 60,
    fromAlarm: false,
    pendingRecording: false,
    askForPermissions: true,
    cameraPermission: true,
    microphonePermission: true,
    askMicrophone: true,
    recordingShortcut: "⌥⇧D",
    toggleDrawingModeShortcut: "",
    toggleBlurModeShortcut: "",
    toggleCursorModeShortcut: "",
    cursorMode: "none",
    cursorEffects: [],
    shape: "rectangle",
    shapeFill: false,
    pushToTalk: false,
    zoomEnabled: false,
    offscreenRecording: false,
    // kill-switch for the offscreen recorder host (default ON); only false
    // falls back to the legacy pinned recorder tab
    useOffscreenCloud: true,
    isAddingImage: false,
    pipEnded: false,
    tabCaptureFrame: false,
    showOnboardingArrow: false,
    offline: false,
    updateChrome: false,
    permissionsChecked: false,
    permissionsLoaded: false,
    parentRef: null,
    shadowRef: null,
    settingsOpen: false,
    hideUIAlerts: false,
    toolbarHover: false,
    hideUI: false,
    bigTab: "record",
    askDismiss: true,
    quality: "max",
    systemAudio: true,
    openWarning: false,
    hasOpenedBefore: false,
    qualityValue: "1080p",
    fpsValue: "30",
    fastRecorderBeta: null,
    fastRecorderStatus: null,
    useWebCodecsRecorder: true,
    countdownActive: false,
    countdownCancelled: false,
    multiMode: false,
    isCountdownVisible: false,
    multiSceneCount: 0,
    preparingRecording: false,
    wasLoggedIn: false,
    hasSeenInstantModeModal: false,
    instantMode: false,
    onboarding: false,
    showProSplash: false,
    hasSubscribedBefore: false,
    startRecordingAfterCountdown: () => {
      if (!contentStateRef.current.countdownCancelled) {
        contentStateRef.current.startRecording();
      }
    },
    cancelCountdown: () => {
      setStartFlowOutcome("cancelled");
      // Eagerly clear flags so the action button doesn't see stale
      // isRecordingActive before BG processes dismiss-recording-tab.
      chrome.storage.local.set({
        pendingRecording: false,
        recording: false,
        restarting: false,
      });
      chrome.runtime.sendMessage({ type: "diag-countdown-cancelled" }).catch(() => {});
      setContentState((prev) => ({
        ...prev,
        countdownActive: false,
        countdownCancelled: true,
        isCountdownVisible: false,
        recording: false,
        showPopup: true,
        showExtension: true,
      }));
      contentStateRef.current.dismissRecording("countdown-cancelled");
    },
    resetCountdown: () => {
      setContentState((prev) => ({
        ...prev,
        countdownCancelled: false,
      }));
    },
    onCountdownFinished: () => {
      const isTarget = isTargetTab();
      const cancelled = Boolean(contentStateRef.current?.countdownCancelled);
      lifecycle("Content.ContentState", "onCountdownFinished", {
        isTarget,
        cancelled,
      });
      if (!cancelled && isTarget) {
        suppressStartBeepRef.current = true;
        lifecycle("Content.ContentState", "beep-play-attempt", {
          beep: "start",
        });
        playBeep(startBeepRef, "assets/sounds/beep2.mp3");
      }
    },
  });
  contentStateRef.current = contentState;

  // Re-scope the recording UI when the recording flow changes (recording / type
  // / countdown / preparing). Placed after `contentState` is declared so it can
  // depend on it; recompute reads fresh state via contentStateRef.
  useEffect(() => {
    recomputeRecordingUiAllowed("flow");
  }, [
    recomputeRecordingUiAllowed,
    contentState.recording,
    contentState.recordingType,
    contentState.countdownActive,
    contentState.isCountdownVisible,
    contentState.preparingRecording,
    contentState.pendingRecording,
  ]);

  setContentState = (updater) => {
    if (typeof updater === "function") {
      setContentStateInternal((prevState) => {
        const newState = updater(prevState);
        contentStateRef.current = newState;
        return newState;
      });
    } else {
      setContentStateInternal(updater);
      contentStateRef.current = updater;
    }
  };

  const playBeep = (ref, filename) => {
    const calledAt = Date.now();
    const wasPreloaded = !!ref.current;
    if (!ref.current) {
      ref.current = new Audio(chrome.runtime.getURL(filename));
    }
    const audio = ref.current;
    audio.volume = 0.5;
    try {
      audio.currentTime = 0;
    } catch {}
    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise
        .then(() => {
          lifecycle("Content.ContentState", "beep-play-ok", {
            filename,
            wasPreloaded,
            elapsedMs: Date.now() - calledAt,
          });
        })
        .catch((error) => {
          console.warn("Beep playback failed:", error);
          lifecycle("Content.ContentState", "beep-play-fail", {
            filename,
            err: String(error?.message || error).slice(0, 120),
            elapsedMs: Date.now() - calledAt,
          });
        });
    }
  };

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "sync-recording-state" }, (state) => {
      if (!state) return;
      setContentState((prev) => ({ ...prev, ...state }));
      setTimeout(() => {
        hydratedRef.current = true;
        prevRecordingRef.current = Boolean(state.recording);
      }, 0);
    });
  }, []);

  useEffect(() => {
    if (!contentState.preparingRecording) return;
    let canceled = false;
    let pollTimer = null;

    const getStatus = async () => {
      const { fastRecorderActiveRecordingId, postStopRecordingId } =
        await chrome.storage.local.get([
          "fastRecorderActiveRecordingId",
          "postStopRecordingId",
        ]);
      const recordingId =
        fastRecorderActiveRecordingId || postStopRecordingId || null;
      if (!recordingId) return null;
      const key = `freeFinalizeStatus:${recordingId}`;
      const res = await chrome.storage.local.get([key]);
      return res[key] || null;
    };

    const applyStatus = (status) => {
      if (!status || canceled) return;
      const pct =
        typeof status.percent === "number" ? Math.round(status.percent) : 0;
      setContentState((prev) => ({
        ...prev,
        processingProgress: pct,
      }));
    };

    const onChanged = (changes, area) => {
      if (area !== "local") return;
      const entry = Object.keys(changes).find((k) =>
        k.startsWith("freeFinalizeStatus:"),
      );
      if (!entry) return;
      applyStatus(changes[entry].newValue);
    };

    chrome.storage.onChanged.addListener(onChanged);

    // Seed once; subsequent updates arrive via onChanged.
    (async () => {
      const status = await getStatus();
      applyStatus(status);
    })();

    return () => {
      canceled = true;
      chrome.storage.onChanged.removeListener(onChanged);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [contentState.preparingRecording]);

  // Stuck-state diagnostics: writes to startFlowTrace when pending/preparing lingers.
  useEffect(() => {
    const PENDING_TIMEOUT_MS = 30000;
    const PREPARING_TIMEOUT_MS = 45000;

    if (contentState.recording) return;

    let timer = null;
    let fired = false;

    if (
      contentState.pendingRecording &&
      !contentState.preparingRecording
    ) {
      timer = setTimeout(() => {
        if (fired) return;
        fired = true;
        setStartFlowOutcome("stuck", {
          stuck: {
            state: "pending",
            since: Date.now() - PENDING_TIMEOUT_MS,
            durationMs: PENDING_TIMEOUT_MS,
          },
        });
      }, PENDING_TIMEOUT_MS);
    } else if (contentState.preparingRecording) {
      timer = setTimeout(() => {
        if (fired) return;
        fired = true;
        setStartFlowOutcome("stuck", {
          stuck: {
            state: "preparing",
            since: Date.now() - PREPARING_TIMEOUT_MS,
            durationMs: PREPARING_TIMEOUT_MS,
          },
        });
      }, PREPARING_TIMEOUT_MS);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    contentState.pendingRecording,
    contentState.preparingRecording,
    contentState.recording,
  ]);

  useEffect(() => {
    const isRecording = Boolean(contentState.recording);
    if (!hydratedRef.current) {
      prevRecordingRef.current = isRecording;
      return;
    }
    if (prevRecordingRef.current === null) {
      prevRecordingRef.current = isRecording;
      return;
    }
    if (!isTargetTab()) {
      prevRecordingRef.current = isRecording;
      return;
    }

    if (prevRecordingRef.current === false && isRecording === true) {
      if (
        recordingBeepTabIdRef.current != null &&
        tabIdRef.current != null &&
        recordingBeepTabIdRef.current !== tabIdRef.current
      ) {
        prevRecordingRef.current = isRecording;
        return;
      }
      // Countdown plays its own start beep.
      if (
        contentStateRef.current?.countdownActive ||
        contentStateRef.current?.isCountdownVisible
      ) {
        return;
      }
      const startTime = recordingStartTimeRef.current;
      const hasStartTime = Number.isFinite(startTime) && startTime > 0;
      const sessionMarker = hasStartTime ? startTime : Date.now();
      const isNewSession = sessionMarker !== lastBeepStartTimeRef.current;
      if (!isNewSession) {
        prevRecordingRef.current = isRecording;
        return;
      }
      lastBeepStartTimeRef.current = sessionMarker;
      if (suppressStartBeepRef.current) {
        suppressStartBeepRef.current = false;
      } else {
        playBeep(startBeepRef, "assets/sounds/beep2.mp3");
      }
    } else if (prevRecordingRef.current === true && isRecording === false) {
      if (suppressStopBeepRef.current) {
        suppressStopBeepRef.current = false;
      } else {
        playBeep(stopBeepRef, "assets/sounds/beep.mp3");
      }
    }

    prevRecordingRef.current = isRecording;
  }, [contentState.recording, isTargetTab]);

  useEffect(() => {
    const version = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    const MIN_CHROME_VERSION = 109;

    if (version && parseInt(version[2], 10) < MIN_CHROME_VERSION) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        updateChrome: true,
      }));
    }
  }, []);

  useEffect(() => {
    if (typeof contentState.openWarning === "function") {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const warningList = [
        "youtube.com",
        "meet.google.com",
        "zoom.us",
        "hangouts.google.com",
        "teams.microsoft.com",
        "web.whatsapp.com",
        "web.skype.com",
        "discord.com",
        "vimeo.com",
      ];

      if (
        !contentState.recording &&
        // The capture is already live through the countdown, so re-opening here
        // on a dep change would put the toast in the recording's first frames.
        !contentState.countdownActive &&
        isMac &&
        warningList.some((el) => window.location.href.includes(el)) &&
        contentState.recordingType != "region" &&
        contentState.recordingType != "camera"
      ) {
        contentState.openWarning(
          chrome.i18n.getMessage("audioWarningTitle"),
          chrome.i18n.getMessage(
            "audioWarningDescription",
            chrome.i18n.getMessage("tabType"),
          ),
          "AudioIcon",
          10000,
          "bottom",
        );
      } else if (
        window.location.href.includes("playground.html") &&
        window.location.href.includes("chrome-extension://") &&
        !contentState.recording
      ) {
        contentState.openWarning(
          chrome.i18n.getMessage("extensionNotSupportedTitle"),
          chrome.i18n.getMessage("extensionNotSupportedDescription"),
          "NotSupportedIcon",
          10000,
        );
      } else if (
        !contentState.recording &&
        contentState.sitePermissionsBlocked &&
        contentState.recordingType === "camera"
      ) {
        // Host page's Permissions-Policy blocks camera/mic in our cross-origin iframe
        // (e.g. facebook.com), which the viewer can't grant; warn instead of the modal.
        // Only camera recordings touch in-page camera/mic; others route through the request flow.
        contentState.openWarning(
          chrome.i18n.getMessage("cameraMicBlockedTitle"),
          chrome.i18n.getMessage("cameraMicBlockedDescription"),
          "VideoOffIcon",
          10000,
        );
      }
    }
  }, [
    contentState.openWarning,
    contentState.recording,
    contentState.recordingType,
    contentState.sitePermissionsBlocked,
  ]);

  useEffect(() => {
    if (!contentState) return;
    if (typeof contentState.openModal === "function") {
      setContentState((prevContentState) => ({
        ...prevContentState,
        tryRestartRecording: tryRestartRecording,
        tryDismissRecording: tryDismissRecording,
      }));
    }
  }, [contentState.openModal]);

  // Tick the timer from cached refs synchronously. Refs are kept fresh
  // by the storage.onChanged listener (cheap; only fires when the
  // values change). The async fallback path runs once at mount and
  // when refs are uninitialized; the hot loop never awaits storage
  // again, so a contended chrome.storage IPC layer can't freeze the
  // timer display.
  const tickTimerFromRefs = useCallback(() => {
    const recording = recordingFlagRef.current;
    const startTime = recordingStartTimeRef.current;
    if (!recording || !startTime) {
      setTimer(0);
      return;
    }
    const now = Date.now();
    const basePaused = totalPausedMsRef.current || 0;
    const extraPaused =
      pausedRef.current && pausedAtRef.current
        ? Math.max(0, now - pausedAtRef.current)
        : 0;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now - startTime - basePaused - extraPaused) / 1000),
    );

    if (contentStateRef.current?.alarm) {
      const alarmTime = contentStateRef.current?.alarmTime || 0;
      const nextRemaining = Math.max(0, alarmTime - elapsedSeconds);
      setTimer((prev) => (prev === nextRemaining ? prev : nextRemaining));
      return;
    }
    setTimer((prev) => (prev === elapsedSeconds ? prev : elapsedSeconds));
  }, []);

  const updateTimerFromStorage = useCallback(async () => {
    const seq = ++timerReadSeqRef.current;
    const { recording, recordingStartTime, paused, pausedAt, totalPausedMs } =
      await chrome.storage.local.get([
        "recording",
        "recordingStartTime",
        "paused",
        "pausedAt",
        "totalPausedMs",
      ]);
    if (seq !== timerReadSeqRef.current) return;
    // Sync the refs so the next tick path is synchronous.
    recordingFlagRef.current = Boolean(recording);
    recordingStartTimeRef.current = recordingStartTime || null;
    pausedRef.current = Boolean(paused);
    pausedAtRef.current = pausedAt || null;
    totalPausedMsRef.current = totalPausedMs || 0;
    tickTimerFromRefs();
  }, [tickTimerFromRefs]);

  useEffect(() => {
    // One-time seed from storage to populate refs, then tick from
    // refs synchronously. Storage onChanged keeps refs fresh; the
    // hot tick never awaits IPC again.
    updateTimerFromStorage();
    const interval = setInterval(() => {
      if (document.hidden) return;
      tickTimerFromRefs();
    }, 1000);
    const handleVisibility = () => {
      if (!document.hidden) {
        // On visibility change, refresh refs from storage (in case
        // we missed onChanged events while hidden), then tick.
        updateTimerFromStorage();
      }
    };
    const handleFocus = () => updateTimerFromStorage();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [updateTimerFromStorage, tickTimerFromRefs]);

  // Reconcile stale recording-flow state when the tab becomes visible.
  // Storage onChanged events may not fire reliably on suspended/hidden
  // tabs, so finalizingRecording can latch true even after the
  // recording has fully stopped elsewhere. Without this, Wrapper.jsx's
  // 800ms post-stop loader timer fires on the next hide→show
  // transition and the "Preparing..." overlay appears.
  useEffect(() => {
    const reconcileOnVisible = async () => {
      if (document.hidden) return;
      try {
        const snap = await chrome.storage.local.get([
          "recording",
          "restarting",
        ]);
        if (snap.recording || snap.restarting) return;
        setContentState((prev) =>
          prev.finalizingRecording ||
          prev.preparingRecording ||
          prev.pendingRecording ||
          prev.restartingRecording ||
          prev.recording
            ? {
                ...prev,
                finalizingRecording: false,
                preparingRecording: false,
                pendingRecording: false,
                restartingRecording: false,
                recording: false,
              }
            : prev,
        );
      } catch {}
    };
    document.addEventListener("visibilitychange", reconcileOnVisible);
    window.addEventListener("focus", reconcileOnVisible);
    // Also run once on mount in case the tab was already visible when
    // the listener attached (e.g., HMR or late content-script inject).
    reconcileOnVisible();
    return () => {
      document.removeEventListener("visibilitychange", reconcileOnVisible);
      window.removeEventListener("focus", reconcileOnVisible);
    };
  }, []);

  useEffect(() => {
    const onChanged = (changes, area) => {
      if (area !== "local") return;
      let shouldUpdateTimer = false;

      if (changes.activeTab) {
        activeTabRef.current = changes.activeTab.newValue ?? null;
      }
      if (changes.tabRecordedID) {
        tabRecordedIdRef.current = changes.tabRecordedID.newValue ?? null;
      }
      if (changes.recordingUiTabId) {
        recordingUiTabRef.current = changes.recordingUiTabId.newValue ?? null;
      }
      if (changes.recordingStartTime) {
        recordingStartTimeRef.current =
          changes.recordingStartTime.newValue ?? null;
      }
      // Mirror pause/recording state into refs the timer reads
      // synchronously each tick. Keeps the visual tick correct even
      // when chrome.storage.local.get blocks on a contended IPC layer.
      if (changes.recording) {
        recordingFlagRef.current = Boolean(changes.recording.newValue);
        // Clear the restart-wait loader as soon as the next
        // recording starts. Storage flip true → false would also
        // qualify but that's handled by the cleanup paths that fire
        // around stop; here we specifically catch the
        // restart→recording-resumes transition.
        if (changes.recording.newValue === true) {
          setContentState((prev) =>
            prev.restartingRecording
              ? { ...prev, restartingRecording: false }
              : prev,
          );
        }
        // Recording true → false: clear start-side flow flags the
        // sandboxTab listener might have missed on a hidden tab. Leave
        // finalizingRecording alone so the toolbar stop button stays
        // disabled until sandboxTab (or the 30s watchdog) lands.
        if (
          changes.recording.oldValue === true &&
          changes.recording.newValue === false
        ) {
          setContentState((prev) =>
            prev.preparingRecording ||
            prev.pendingRecording ||
            prev.restartingRecording
              ? {
                  ...prev,
                  preparingRecording: false,
                  pendingRecording: false,
                  restartingRecording: false,
                }
              : prev,
          );
        }
      }
      // Same clear when storage.restarting flips false (BG side
      // wraps up the restart flow). Defensive backstop.
      if (
        changes.restarting &&
        changes.restarting.oldValue === true &&
        changes.restarting.newValue === false
      ) {
        setContentState((prev) =>
          prev.restartingRecording
            ? { ...prev, restartingRecording: false }
            : prev,
        );
      }
      if (changes.paused) {
        pausedRef.current = Boolean(changes.paused.newValue);
      }
      if (changes.pausedAt) {
        pausedAtRef.current = changes.pausedAt.newValue ?? null;
      }
      if (changes.totalPausedMs) {
        totalPausedMsRef.current = changes.totalPausedMs.newValue ?? 0;
      }
      if (changes.recordingBeepTabId) {
        recordingBeepTabIdRef.current =
          changes.recordingBeepTabId.newValue ?? null;
      }
      if (
        changes.screenityToken ||
        changes.screenityUser ||
        changes.isSubscribed ||
        changes.proSubscription ||
        changes.lastAuthCheck ||
        changes.isLoggedIn
      ) {
        // Coalesce: loginWithWebsite writes isLoggedIn + isSubscribed +
        // lastAuthCheck in quick succession.
        clearTimeout(verifyDebounceRef.current);
        verifyDebounceRef.current = setTimeout(verifyUser, 2000);
      }
      if (changes.recordingNow) {
        shouldUpdateTimer = true;
      }
      // Without this sync, the record button stays stuck on "Starting
      // recording..." after a teardown the React state didn't observe
      // (e.g. native Stop-sharing, SW-cleared start-fail).
      if (changes.pendingRecording) {
        const next = Boolean(changes.pendingRecording.newValue);
        if (!next) {
          setContentState((prev) => ({
            ...prev,
            pendingRecording: false,
            preparingRecording: false,
          }));
        }
      }
      if (changes.paused) {
        setContentState((prev) => ({
          ...prev,
          paused: Boolean(changes.paused.newValue),
        }));
        shouldUpdateTimer = true;
      }
      if (changes.cameraActive && isTargetTab()) {
        // CameraWrap renders off contentState.cameraActive; without this listener
        // a storage toggle (from another tab's popup, automation seed) never reaches React.
        setContentState((prev) => ({
          ...prev,
          cameraActive: Boolean(changes.cameraActive.newValue),
        }));
      }
      // sandboxTab appearing means BG opened the editor tab and the
      // finalize handoff is done; tear down recording UI (toolbar,
      // camera, drawing/blur/cursor, preparing overlay). Storage-
      // driven so it fires even on a non-recording tab. Covers free/local
      // single-scene stop; multi-scene reuses the editor tab and cleans up
      // via reopen-popup-multi.
      const sandboxTabAppeared =
        changes.sandboxTab && changes.sandboxTab.newValue != null;
      // Cloud single-scene has no sandboxTab (its app opens in a new tab),
      // so the finalize toolbar would otherwise linger until the 30s
      // watchdog. pendingEditorOpen is written when the upload finishes and
      // the app opens, so treat it as the same handoff-done signal.
      const cloudEditorOpening =
        changes.pendingEditorOpen && changes.pendingEditorOpen.newValue != null;
      if (sandboxTabAppeared || cloudEditorOpening) {
        const wasMulti = contentStateRef.current?.multiMode === true;
        setContentState((prev) =>
          prev.finalizingRecording || prev.recording
            ? {
                ...prev,
                finalizingRecording: false,
                preparingRecording: false,
                pendingRecording: false,
                recording: false,
                paused: false,
                time: 0,
                timer: 0,
                timeWarning: false,
                tabCaptureFrame: false,
                pipEnded: false,
                showExtension: wasMulti ? true : false,
                showPopup: wasMulti ? true : true,
                // Preserve tool state in multi so the user's drawing
                // setup carries into the next scene; single-mode clears.
                drawingMode: wasMulti ? prev.drawingMode : false,
                blurMode: wasMulti ? prev.blurMode : false,
                toolbarMode: wasMulti ? prev.toolbarMode : "",
                cursorMode: wasMulti ? prev.cursorMode : "none",
                cursorEffects: wasMulti ? prev.cursorEffects : [],
                cameraActive: false,
              }
            : prev,
        );
        setTimer(0);
        // Match the old stop handler's DOM cleanup; pre-clear blur
        // overlays in case they survived the React tree teardown.
        try {
          const elements = document.querySelectorAll(".screenity-blur");
          elements.forEach((el) => el.classList.remove("screenity-blur"));
        } catch {}
      }
      if (changes.recording) {
        const isRecording = Boolean(changes.recording.newValue);
        // Read recordingType from this batch; the React ref may lag.
        const recordingTypeFromChange =
          changes.recordingType?.newValue ?? null;
        lifecycle("Content.ContentState", "recording-flag-observed", {
          isRecording,
          isTargetTab: isTargetTab(),
          recordingType:
            recordingTypeFromChange ??
            contentStateRef.current?.recordingType ??
            null,
        });
        if (isRecording && !isTargetTab()) {
          // Tab/region recordings: clear UI flags that preparing-recording set on non-target tabs.
          const recordingType =
            recordingTypeFromChange ??
            contentStateRef.current?.recordingType;
          const isTabBound =
            recordingType === "tab" || recordingType === "region";
          if (isTabBound) {
            setContentState((prev) => ({
              ...prev,
              recording: false,
              showExtension: false,
              showPopup: false,
              preparingRecording: false,
              countdownActive: false,
              isCountdownVisible: false,
              drawingMode: false,
              blurMode: false,
              cursorMode: "none",
              cursorEffects: [],
              // Camera bubble belongs to the captured tab; the cameraActive
              // listener is isTargetTab-gated so stale-true would stick here.
              cameraActive: false,
            }));
          } else {
            setContentState((prev) => ({
              ...prev,
              recording: false,
            }));
          }
          return;
        }
        const shouldHideCountdown =
          isRecording &&
          !contentStateRef.current?.isCountdownVisible &&
          !contentStateRef.current?.countdownActive;
        // BG flips recording=false ~100ms after stop is clicked. If
        // we're locally in the finalizing window (user pressed stop,
        // editor not yet open), suppress the flip; otherwise the
        // toolbar drops the recording surface and looks idle while
        // the editor is still being prepared. sandboxTab → newValue
        // is what clears the finalizing state cleanly.
        const isLocallyFinalizing =
          !isRecording &&
          contentStateRef.current?.finalizingRecording === true;
        if (isLocallyFinalizing) {
          // Keep the toolbar-facing `recording` flag true so its
          // Recording UI persists during finalize, but expose the
          // BG-acknowledged state via encoderActive so the post-stop
          // loader can gate on it. Encoder can keep capturing many
          // seconds after stop on contended Chrome; without the gate
          // the loader bleeds into the recorded video.
          setContentState((prev) =>
            prev.encoderActive !== false
              ? { ...prev, encoderActive: false }
              : prev,
          );
          shouldUpdateTimer = false;
        } else {
          setContentState((prev) => ({
            ...prev,
            recording: isRecording,
            encoderActive: isRecording,
            ...(shouldHideCountdown
              ? {
                  countdownActive: false,
                  isCountdownVisible: false,
                }
              : {}),
          }));
          shouldUpdateTimer = true;
        }
      }
      if (changes.cursorEffects) {
        const nextEffects = normalizeCursorEffects(
          changes.cursorEffects.newValue,
        );
        const fallbackMode =
          changes.cursorMode?.newValue ||
          contentStateRef.current?.cursorMode ||
          "none";
        const nextMode = deriveCursorMode(nextEffects, fallbackMode);
        setContentState((prev) => ({
          ...prev,
          cursorEffects: nextEffects,
          cursorMode: nextMode,
        }));
      } else if (changes.cursorMode) {
        const mode = changes.cursorMode.newValue || "none";
        const fallbackEffects = mode !== "none" ? [mode] : [];
        setContentState((prev) => ({
          ...prev,
          cursorMode: mode,
          cursorEffects:
            Array.isArray(prev.cursorEffects) && prev.cursorEffects.length > 0
              ? prev.cursorEffects
              : fallbackEffects,
        }));
      }
      if (
        changes.recordingNow ||
        changes.paused ||
        changes.recording ||
        changes.recordingStartTime ||
        changes.pausedAt ||
        changes.totalPausedMs
      ) {
        shouldUpdateTimer = true;
      }
      if (shouldUpdateTimer) {
        updateTimerFromStorage();
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [isTargetTab, updateTimerFromStorage, verifyUser]);

  useEffect(() => {
    if (!contentState.customRegion) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        cropTarget: null,
      }));
    }
  }, [contentState.customRegion]);

  useEffect(() => {
    if (contentState.hideToolbar && contentState.hideUI) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        drawingMode: false,
        blurMode: false,
      }));
    }
  }, [contentState.hideToolbar, contentState.hideUI]);

  useEffect(() => {
    if (window.__screenitySetupHandlersInitialized) return;
    window.__screenitySetupHandlersInitialized = true;
    setupHandlers();
  }, []);

  // Storage is one-way (storage → contentState via
  // chrome.storage.onChanged). Don't mirror back via useEffect:
  // startStreaming's cleanup branches setContentState false
  // transiently, and a reverse-sync useEffect would propagate
  // those false values to storage and flicker the popup button.
  // Each cleanup branch in startStreaming writes storage itself.

  useEffect(() => {
    if (!contentState.qualityValue) {
      const suggested = "1080p";
      setContentState((prev) => ({ ...prev, qualityValue: suggested }));
      chrome.storage.local.set({ qualityValue: suggested });
    }
  }, []);

  useEffect(() => {
    if (contentState.pushToTalk) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        micActive: false,
      }));

      chrome.storage.local.set({
        micActive: false,
      });

      chrome.runtime.sendMessage({
        type: "set-mic-active-tab",
        active: false,
        defaultAudioInput: contentState.defaultAudioInput,
      });
    }
  }, [contentState.pushToTalk]);

  useEffect(() => {
    if (contentState.backgroundEffectsActive) {
      chrome.runtime.sendMessage({ type: "background-effects-active" });
    } else {
      chrome.runtime.sendMessage({ type: "background-effects-inactive" });
    }
  }, [contentState.backgroundEffectsActive]);

  useEffect(() => {
    if (contentState.backgroundEffectsActive) {
      chrome.runtime.sendMessage({
        type: "set-background-effect",
        effect: contentState.backgroundEffect,
      });
    }
  }, [contentState.backgroundEffect, contentState.backgroundEffectsActive]);

  useEffect(() => {
    if (!contentState.parentRef) return;

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    if (isMac) return;

    const parentDiv = contentState.parentRef;

    const elements = parentDiv.querySelectorAll("*");
    elements.forEach((element) => {
      element.classList.add("screenity-scrollbar");
    });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.add("screenity-scrollbar");
            }
          });

          removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.remove("screenity-scrollbar");
            }
          });
        }
      }
    });

    observer.observe(parentDiv, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [contentState.parentRef]);

  // Programmatically add custom scrollbars
  useEffect(() => {
    if (!contentState.shadowRef) return;

    // Check if on mac
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    if (isMac) return;

    const shadowRoot = contentState.shadowRef.shadowRoot;

    const elements = shadowRoot.querySelectorAll("*");
    elements.forEach((element) => {
      element.classList.add("screenity-scrollbar");
    });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.add("screenity-scrollbar");
            }
          });

          removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.remove("screenity-scrollbar");
            }
          });
        }
      }
    });

    observer.observe(shadowRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [
    contentState.parentRef,
    contentState.shadowRef,
    contentState.bigTab,
    contentState.recordingType,
  ]);

  useEffect(() => {
    if (!contentState.hideUI) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        hideUIAlerts: false,
        hideToolbar: false,
        toolbarHover: false,
      }));
    }
  }, [contentState.hideUI]);

  // Recorder sets regionAwaitingCropTarget when its crop-target is missing; we
  // re-send it over storage (postMessage can drop). Gated to an active start.
  const cropTargetWantedRef = useRef(false);
  const sendCropTargetToRecorder = useCallback(() => {
    const s = contentStateRef.current;
    // Hard gate (see cropTargetGate): only answer the recorder during an actual
    // start, never on an idle region toggle/tweak.
    if (!shouldResendCropTarget(s)) return;
    const regionWin = s.regionCaptureRef?.contentWindow || null;
    if (!regionWin) return;
    regionWin.postMessage(
      {
        type: "crop-target",
        target: s.cropTarget,
        width: s.regionWidth,
        height: s.regionHeight,
      },
      "*",
    );
  }, []);

  useEffect(() => {
    const onChanged = (changes, area) => {
      if (area !== "local" || !changes.regionAwaitingCropTarget) return;
      // Mirror the recorder's "waiting" flag: reset on clear so the re-send
      // below can't fire on an idle region tweak and start outside a real one.
      if (!changes.regionAwaitingCropTarget.newValue) {
        cropTargetWantedRef.current = false;
        return;
      }
      cropTargetWantedRef.current = true;
      sendCropTargetToRecorder();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [sendCropTargetToRecorder]);

  // The recorder can ask before the async derivation resolves; send once it
  // does, but only while it is actually waiting (cropTargetWantedRef).
  useEffect(() => {
    if (!cropTargetWantedRef.current) return;
    if (!contentState.cropTarget) return;
    sendCropTargetToRecorder();
  }, [contentState.cropTarget, sendCropTargetToRecorder]);

  useEffect(() => {
    updateFromStorage();
  }, []);

  // Memoize: a fresh array literal would re-render every consumer per parent update.
  const providerValue = useMemo(
    () => [contentState, setContentState, timer, setTimer],
    [contentState, timer],
  );

  return (
    <contentStateContext.Provider value={providerValue}>
      {props.children}
      <Shortcuts shortcuts={contentState.shortcuts} />
      {process.env.SCREENITY_DEV_MODE === "true" && (
        <DevHUD contentStateRef={contentStateRef} setContentState={setContentState} />
      )}
    </contentStateContext.Provider>
  );
};

export default ContentState;
