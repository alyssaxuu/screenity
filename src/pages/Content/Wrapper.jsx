import React, { useContext, useRef, useEffect, useState } from "react";

import PopupContainer from "./popup/PopupContainer";
import Toolbar from "./toolbar/Toolbar";
import Camera from "./camera/Camera";
import CameraOnly from "./camera-only/CameraOnly";
// Static import (fabric is ~313KB). React.lazy can't dynamic-import in
// content scripts on strict-CSP pages: host script-src blocks the
// chunk insertion even with web_accessible_resources. Verified
// ChunkLoadError on google.com.
import Canvas from "./canvas/Canvas";
import Countdown from "./countdown/Countdown";
import Modal from "./modal/Modal";
import Warning from "./warning/Warning";

import Region from "./region/Region";

// Using ShadowDOM
import root from "react-shadow";

// Import styles raw to add into the ShadowDOM
import styles from "!raw-loader!./styles/app.css";

import ZoomContainer from "./utils/ZoomContainer";
import BlurTool from "./utils/BlurTool";
import CursorModes from "./utils/CursorModes";

import { contentStateContext } from "./context/ContentState";

import { startClickTracking } from "./cursor/trackClicks";

const RecordingLoader = () => {
  const label = chrome.i18n.getMessage("preparingLabel") || "Preparing...";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999999999,
      }}
      aria-label="Loading overlay"
      role="alert"
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.15)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: 20,
          padding: 40,
          width: 160,
          height: 160,
          boxShadow: `
        0 8px 32px 0 rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(255, 255, 255, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.1)
      `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'Satoshi-Medium, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
          userSelect: "none",
          animation: "fadeIn 0.3s ease-out",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            border: "3px solid rgba(255, 255, 255, 0.2)",
            borderTop: "3px solid rgba(255, 255, 255, 0.8)",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <div
          style={{
            marginTop: 20,
            fontSize: 15,
            fontWeight: 500,
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </div>
        <style>
          {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}
        </style>
      </div>
    </div>
  );
};

const Wrapper = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const shadowRef = useRef(null);
  const parentRef = useRef(null);
  const permissionsRef = useRef(null);
  const regionCaptureRef = useRef(null);
  const contentStateRef = useRef(contentState);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  // Delayed loader: only show after 800ms in a wait window
  // (pre-countdown setup or post-stop finalize), never during
  // countdown or active recording. Skip the flash when start
  // resolves in <500ms.
  const LOADER_DELAY_MS = 800;
  const inPreCountdownWait =
    Boolean(contentState.pendingRecording) &&
    // Popup stays open showing "starting recording" until ready-to-record
    // (stream acquired) closes it; that's the pre-acquisition feedback, so
    // don't stack the loader on top. Only fill the post-popup → countdown gap.
    !contentState.showPopup &&
    !contentState.countdownActive &&
    !contentState.isCountdownVisible &&
    !contentState.recording &&
    // Latched after first countdown appearance. Prevents re-show in
    // the countdown-end → recording-true gap (capture is already
    // live by then for region/desktop).
    !contentState.countdownEverShown;
  // Gate post-stop loader on encoderActive=false. Encoder can keep
  // capturing several seconds after stop click on contended Chrome
  // (seen up to 9s in diag); without this gate the loader gets baked
  // into the recorded video.
  const inPostStopWait =
    Boolean(contentState.finalizingRecording) &&
    contentState.encoderActive === false;
  // Restart wait: streams are reused, no picker pop, so the
  // visibility-hidden gate below never fires. Without this flag the
  // toolbar would just freeze.
  const inRestartWait = Boolean(contentState.restartingRecording);
  // The real "starting" gap is the post-acquisition preparing window: stream
  // acquired → cloud project created → countdown. preparingRecording is true
  // throughout it, the popup is already closed, document is visible, and no
  // recorder tab exists — so show the loader here (bypassing the hide gate).
  // pendingRecording/inPreCountdownWait is only true for ~10ms before the
  // countdown, so it can't drive this. Gate on the offscreen host (default ON).
  const inPreparingWait =
    Boolean(contentState.preparingRecording) &&
    !contentState.countdownActive &&
    !contentState.isCountdownVisible &&
    !contentState.recording &&
    contentState.useOffscreenCloud !== false;
  const waitActive =
    inPreCountdownWait || inPostStopWait || inRestartWait || inPreparingWait;
  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    if (!waitActive) {
      setShowLoader(false);
      return;
    }
    // Only show after a hide → show round-trip. If the tab never went
    // hidden, the recorder tab's own loading state is what the user
    // sees; our overlay would just flash on the source tab.
    let timeoutId = null;
    let wasHiddenThisWait = false;
    const armTimer = () => {
      if (document.hidden) return;
      if (!wasHiddenThisWait) return;
      timeoutId = setTimeout(() => {
        if (!document.hidden) setShowLoader(true);
      }, LOADER_DELAY_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        wasHiddenThisWait = true;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = null;
        setShowLoader(false);
      } else if (!timeoutId) {
        armTimer();
      }
    };
    // Post-stop skips the visibility gate (stop click is on the
    // active tab; show feedback there immediately after 800ms).
    if (inPostStopWait) {
      wasHiddenThisWait = true;
    }
    // Same exemption for restart: the click is on the source tab and
    // the recorder doesn't reopen a picker, so the tab never goes
    // hidden. Without skipping the gate, the loader wouldn't fire and
    // the user sees a frozen toolbar for the full restart window.
    if (inRestartWait) {
      wasHiddenThisWait = true;
    }
    // Preparing window (post-acquisition): no recorder tab steals focus, so
    // skip the hide gate and let the loader show during the cloud-prep gap.
    if (inPreparingWait) {
      wasHiddenThisWait = true;
    }
    armTimer();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [waitActive, inPostStopWait, inRestartWait, inPreparingWait]);

  useEffect(() => {
    if (!parentRef.current) return;

    setContentState((prevContentState) => ({
      ...prevContentState,
      parentRef: parentRef.current,
    }));
  }, [parentRef.current]);

  useEffect(() => {
    if (!shadowRef.current) return;
    setContentState((prevContentState) => ({
      ...prevContentState,
      shadowRef: shadowRef.current,
    }));
  }, [shadowRef.current]);

  useEffect(() => {
    if (!regionCaptureRef.current) return;
    setContentState((prevContentState) => ({
      ...prevContentState,
      regionCaptureRef: regionCaptureRef.current,
    }));
  }, [regionCaptureRef.current]);

  useEffect(() => {
    if (contentState.permissionsChecked) return;
    if (!permissionsRef.current) return;
    if (!contentState.showExtension) return;
    if (!contentState.permissionsLoaded) return;

    permissionsRef.current.contentWindow.postMessage(
      {
        type: "screenity-get-permissions",
      },
      "*"
    );

    setContentState((prevContentState) => ({
      ...prevContentState,
      permissionsChecked: true,
    }));
  }, [
    permissionsRef.current,
    contentState.showExtension,
    contentState.permissionsLoaded,
  ]);

  useEffect(() => {
    let stopTracking = null;

    // Start tracking clicks only when recording starts
    if (contentState.recording) {
      stopTracking = startClickTracking(
        contentState.customRegion,
        contentState.regionWidth,
        contentState.regionHeight,
        contentState.regionX,
        contentState.regionY,
        contentStateRef
      );
    }

    return () => {
      stopTracking?.();
    };
  }, [
    contentState.recording,
    contentState.customRegion,
    contentState.regionWidth,
    contentState.regionHeight,
    contentState.regionX,
    contentState.regionY,
  ]);

  return (
    <div ref={parentRef}>
      {contentState.showExtension && (
        <iframe
          className="screenity-iframe"
          style={{
            // all: "unset",
            display: "none",
            visibility: "hidden",
          }}
          ref={permissionsRef}
          src={chrome.runtime.getURL("permissions.html")}
          allow="camera *; microphone *"
        ></iframe>
      )}
      {contentState.hasOpenedBefore && (
        <iframe
          className="screenity-iframe"
          style={{
            // all: "unset",
            display: "none",
            visibility: "hidden",
          }}
          ref={regionCaptureRef}
          src={
            contentState.isSubscribed
              ? chrome.runtime.getURL("cloudrecorder.html?injected=true")
              : chrome.runtime.getURL("region.html")
          }
          allow="camera *; microphone *; display-capture *"
        ></iframe>
      )}

      {contentState.zoomEnabled && <ZoomContainer />}
      <BlurTool />
      {(contentState.showExtension || contentState.recording) &&
      contentState.recordingUiAllowed !== false ? (
        <div>
          {!contentState.recording &&
            !contentState.drawingMode &&
            !contentState.blurMode && (
              <div
                style={{
                  // all: "unset",
                  width: "100%",
                  height: "100%",
                  zIndex: 999999999,
                  pointerEvents:
                    contentState.pendingRecording ||
                    contentState.preparingRecording
                      ? "none"
                      : "all",
                  position: "fixed",
                  background:
                    window.location.href.indexOf(
                      chrome.runtime.getURL("setup.html")
                    ) === -1 &&
                    window.location.href.indexOf(
                      chrome.runtime.getURL("playground.html")
                    ) === -1 &&
                    !contentState.pendingRecording &&
                    !contentState.preparingRecording
                      ? "rgba(0,0,0,0.15)"
                      : "rgba(0,0,0,0)",
                  top: 0,
                  left: 0,
                }}
                onClick={() => {
                  const onboardingActive =
                    document.documentElement.classList.contains(
                      "screenity-driver-active"
                    ) || Boolean(document.querySelector(".driver-overlay"));
                  if (onboardingActive) return;

                  if (
                    window.location.href.indexOf(
                      chrome.runtime.getURL("setup.html")
                    ) === -1 &&
                    window.location.href.indexOf(
                      chrome.runtime.getURL("playground.html")
                    ) === -1 &&
                    !contentState.pendingRecording &&
                    !contentState.customRegion
                  ) {
                    setContentState((prevContentState) => ({
                      ...prevContentState,
                      showExtension: false,
                      showPopup: false,
                    }));
                  }
                }}
              ></div>
            )}
          {(contentState.drawingMode || contentState.blurMode) && (
            // Key on multiSceneCount only: fresh fabric per scene,
            // but drawings persist through the pre-record → record
            // transition within a scene.
            <Canvas key={`canvas-${contentState.multiSceneCount || 0}`} />
          )}
          <CursorModes />
          <root.div
            className="root-container"
            id="screenity-root-container"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              position: "absolute",
              pointerEvents: "none",
              left: "0px",
              top: "0px",
              zIndex: 9999999999,
              // Isolation: prevent host-page inherited typography from
              // leaking through the shadow-DOM boundary.
              fontFamily: "'Satoshi-Medium', sans-serif",
              fontSize: "16px",
              lineHeight: "normal",
              letterSpacing: "normal",
              wordSpacing: "normal",
              textTransform: "none",
              textIndent: "0",
              textAlign: "left",
              color: "#29292F",
              direction: "ltr",
              whiteSpace: "normal",
              fontStyle: "normal",
              fontVariant: "normal",
              fontWeight: "normal",
            }}
            ref={shadowRef}
          >
            <div className="container">
              <Warning />
              {contentState.recordingType === "region" &&
                contentState.customRegion && <Region />}
              {shadowRef.current && <Modal shadowRef={shadowRef} />}
              {/*
                Render-time double-check: even if `showLoader` is true,
                hide the pre-countdown loader the moment countdownActive
                / isCountdownVisible flips on. The 800ms loader timer
                can fire in the same scheduler tick as the
                ready-to-record handler, producing a one-frame overlap
                where both the "Processing your recording…" overlay and
                the countdown render simultaneously. Tying visibility
                to the live contentState here closes that frame -
                showLoader still gets cleared by the useEffect cleanup
                on the next tick, but the user never sees the overlap.
              */}
              {showLoader &&
                !contentState.countdownActive &&
                !contentState.isCountdownVisible && <RecordingLoader />}
              <Countdown />
              {contentState.recordingType != "camera" &&
                !contentState.onboarding &&
                !(
                  contentState.isSubscribed === false &&
                  contentState.isLoggedIn === true
                ) &&
                !(!contentState.isLoggedIn && contentState.wasLoggedIn) && (
                  <Camera shadowRef={shadowRef} />
                )}
              {contentState.recordingType === "camera" && (
                <CameraOnly shadowRef={shadowRef} />
              )}
              {!(contentState.hideToolbar && contentState.hideUI) &&
                !contentState.onboarding &&
                !(
                  contentState.isSubscribed === false &&
                  contentState.isLoggedIn === true
                ) &&
                !(!contentState.isLoggedIn && contentState.wasLoggedIn) && (
                  <Toolbar />
                )}
              {contentState.showPopup && (
                <PopupContainer shadowRef={shadowRef} />
              )}
            </div>
            <style type="text/css">{styles}</style>
          </root.div>
        </div>
      ) : (
        <div></div>
      )}
    </div>
  );
};

export default Wrapper;
