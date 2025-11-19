import React, { useContext, useRef, useEffect } from "react";

import PopupContainer from "./popup/PopupContainer";
import Toolbar from "./toolbar/Toolbar";
import Camera from "./camera/Camera";
import CameraOnly from "./camera-only/CameraOnly";
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
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            letterSpacing: "-0.01em",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          Preparing recording...
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
      {contentState.showExtension || contentState.recording ? (
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
                  pointerEvents: "all",
                  position: "fixed",
                  background:
                    window.location.href.indexOf(
                      chrome.runtime.getURL("setup.html")
                    ) === -1 &&
                    window.location.href.indexOf(
                      chrome.runtime.getURL("playground.html")
                    ) === -1 &&
                    !contentState.pendingRecording
                      ? "rgba(0,0,0,0.15)"
                      : "rgba(0,0,0,0)",
                  top: 0,
                  left: 0,
                }}
                onClick={() => {
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
          <Canvas />
          <CursorModes />
          <root.div
            className="root-container"
            id="screenity-root-container"
            style={{
              // all: "initial",
              display: "block",
              width: "100%",
              height: "100%",
              position: "absolute",
              pointerEvents: "none",
              left: "0px",
              top: "0px",
              zIndex: 9999999999,
            }}
            ref={shadowRef}
          >
            <div className="container">
              <Warning />
              {contentState.recordingType === "region" &&
                contentState.customRegion && <Region />}
              {shadowRef.current && <Modal shadowRef={shadowRef} />}
              {contentState.preparingRecording && <RecordingLoader />}
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
