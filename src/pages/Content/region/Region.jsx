import React, { useRef, useContext, useEffect } from "react";
import { Rnd } from "react-rnd";

import { contentStateContext } from "../context/ContentState";

const ResizableBox = () => {
  const regionRef = useRef(null);
  const parentRef = useRef(null);
  const cropRef = useRef(null);
  const recordingRef = useRef(null);
  const [contentState, setContentState] = useContext(contentStateContext);

  useEffect(() => {
    recordingRef.current = contentState.recording;
  }, [contentState.recording]);

  useEffect(() => {
    if (contentState.recordingType != "region") return;
    if (!contentState.customRegion) return;
    if (regionRef.current === null) return;
    if (
      contentState.regionWidth === 0 ||
      contentState.regionWidth === undefined
    )
      return;
    if (
      contentState.regionHeight === 0 ||
      contentState.regionHeight === undefined
    )
      return;
    if (contentState.regionX === undefined) return;
    if (contentState.regionY === undefined) return;
    if (contentState.fromRegion) return;

    const parentWidth = parentRef.current.offsetWidth;
    const parentHeight = parentRef.current.offsetHeight;

    const maxWidth = parentWidth - contentState.regionX;
    const maxHeight = parentHeight - contentState.regionY;
    const newWidth = Math.min(contentState.regionWidth, maxWidth);
    const newHeight = Math.min(contentState.regionHeight, maxHeight);

    setContentState((prevContentState) => ({
      ...prevContentState,
      regionWidth: newWidth,
      regionHeight: newHeight,
      fromRegion: true,
    }));

    chrome.storage.local.set({
      regionWidth: newWidth,
      regionHeight: newHeight,
    });

    regionRef.current.updateSize({
      width: newWidth,
      height: newHeight,
      x: contentState.regionX,
      y: contentState.regionY,
    });
    setCropTarget();
  }, [
    contentState.recordingType,
    contentState.customRegion,
    contentState.regionWidth,
    contentState.regionHeight,
    contentState.regionX,
    contentState.regionY,
  ]);

  const setCropTarget = async () => {
    const target = await CropTarget.fromElement(cropRef.current);
    setContentState((prevContentState) => ({
      ...prevContentState,
      cropTarget: target,
    }));
  };

  const handleResize = (e, direction, ref, delta, position) => {
    const width = parseInt(ref.style.width, 10);
    const height = parseInt(ref.style.height, 10);

    setContentState((prevContentState) => ({
      ...prevContentState,
      regionWidth: width,
      regionHeight: height,
      regionX: position.x,
      regionY: position.y,
      fromRegion: true,
    }));

    chrome.storage.local.set({
      regionWidth: width,
      regionHeight: height,
      regionX: position.x,
      regionY: position.y,
    });
    setCropTarget();
  };

  const handleMove = (e, d) => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      regionX: d.x,
      regionY: d.y,
      fromRegion: true,
    }));
    chrome.storage.local.set({
      regionX: d.x,
      regionY: d.y,
    });
    setCropTarget();
  };

  useEffect(() => {
    setCropTarget();
  }, []);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const handleContextMenu = (e) => {
      if (e.target.className.includes("resize-handle")) {
        e.preventDefault();
      }
    };

    parent.addEventListener("contextmenu", handleContextMenu);
    return () => {
      parent.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  // Shadow DOM mouse events retarget to the host and stop at `document`,
  // never reaching `window`. re-resizable listens on `window`, so forward
  // events from our shadow container.
  useEffect(() => {
    const shadowHostId = "screenity-root-container";

    const forwardToWindow = (e) => {
      if (
        e.target?.id === shadowHostId ||
        e.target?.closest?.("#" + shadowHostId)
      ) {
        window.dispatchEvent(
          new MouseEvent(e.type, {
            bubbles: false,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            screenX: e.screenX,
            screenY: e.screenY,
            button: e.button,
            buttons: e.buttons,
          })
        );
      }
    };

    document.addEventListener("mouseup", forwardToWindow);
    document.addEventListener("mousemove", forwardToWindow);
    return () => {
      document.removeEventListener("mouseup", forwardToWindow);
      document.removeEventListener("mousemove", forwardToWindow);
    };
  }, []);

  // Hide handles + dashed outline as soon as the countdown starts (or pending
  // recording is set), not when contentState.recording flips. The latter races
  // the cloudrecorder's first frame capture, leaking handles into the first
  // ~33ms of the recording.
  const hideRegionUI =
    contentState.recording ||
    contentState.countdownActive ||
    contentState.pendingRecording;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        pointerEvents:
          hideRegionUI ||
          contentState.drawingMode ||
          contentState.blurMode
            ? "none"
            : "auto",
      }}
      className={hideRegionUI ? "region-recording" : ""}
      onClick={(e) => {
        if (
          e.target.className.indexOf("resize-handle") === -1 &&
          e.target.className.indexOf("react-draggable") === -1 &&
          e.target.className.indexOf("region-rect") === -1
        ) {
        }
      }}
      ref={parentRef}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
          pointerEvents:
            hideRegionUI ||
            contentState.drawingMode ||
            contentState.blurMode
              ? "none"
              : "auto",
        }}
      >
        <div className="box-hole" />
      </div>
      <Rnd
        ref={regionRef}
        style={{
          position: "relative",
          zIndex: 2,
          pointerEvents:
            hideRegionUI ||
            contentState.drawingMode ||
            contentState.blurMode
              ? "none"
              : "auto",
        }}
        default={{
          x: contentState.regionX,
          y: contentState.regionY,
          width: contentState.regionWidth,
          height: contentState.regionHeight,
        }}
        minWidth={50}
        minHeight={50}
        cancel=".resize-handle-wrapper"
        resizeHandleWrapperClass="resize-handle-wrapper"
        resizeHandleComponent={{
          topLeft: <div className="resize-handle top-left" />,
          top: <div className="resize-handle top" />,
          topRight: <div className="resize-handle top-right" />,
          right: <div className="resize-handle right" />,
          bottomRight: <div className="resize-handle bottom-right" />,
          bottom: <div className="resize-handle bottom" />,
          bottomLeft: <div className="resize-handle bottom-left" />,
          left: <div className="resize-handle left" />,
        }}
        bounds="parent"
        onResizeStop={handleResize}
        onDragStop={handleMove}
        disableDragging={
          hideRegionUI ||
          contentState.drawingMode ||
          contentState.blurMode
        }
        enableResizing={
          !hideRegionUI &&
          !contentState.drawingMode &&
          !contentState.blurMode
        }
      >
        <div
          ref={cropRef}
          className="region-rect"
          style={{
            width: "100%",
            height: "100%",
            outline: hideRegionUI ? "none" : "2px dashed #D9D9D9",
            // Push outline inside the box so it isn't visible in recordings.
            outlineOffset: "2px",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.2)",
            borderRadius: "5px",
            zIndex: 2,
            boxSizing: "border-box",
            pointerEvents:
              hideRegionUI ||
              contentState.drawingMode ||
              contentState.blurMode
                ? "none"
                : "auto",
          }}
        />
      </Rnd>
    </div>
  );
};

export default ResizableBox;
