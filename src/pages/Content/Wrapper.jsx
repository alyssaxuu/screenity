import React, { useContext, useRef, useEffect } from "react";

// Components
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
// dist?
import styles from "!raw-loader!./styles/app.css";

// Utils
import ZoomContainer from "./utils/ZoomContainer";
import BlurTool from "./utils/BlurTool";
import CursorModes from "./utils/CursorModes";

// Context
import { contentStateContext } from "./context/ContentState";

const Wrapper = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const shadowRef = useRef(null);
  const parentRef = useRef(null);
  const permissionsRef = useRef(null);
  const regionCaptureRef = useRef(null);

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
          src={chrome.runtime.getURL("region.html")}
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
              <Countdown />
              {contentState.recordingType != "camera" && (
                <Camera shadowRef={shadowRef} />
              )}
              {contentState.recordingType === "camera" && (
                <CameraOnly shadowRef={shadowRef} />
              )}
              {!(contentState.hideToolbar && contentState.hideUI) && (
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
