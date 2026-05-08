import React, {
  useEffect,
  useContext,
  useRef,
  useState,
  useLayoutEffect,
} from "react";

import { Rnd } from "react-rnd";

import { contentStateContext } from "../../context/ContentState";

import CameraToolbar from "./CameraToolbar";
import ResizeHandle from "../components/ResizeHandle";

const CameraWrap = (props) => {
  const [contentState, setContentState] = React.useContext(contentStateContext);
  const cameraRef = React.useRef();
  const [cx, setCx] = useState(200);
  const [cy, setCy] = useState(200);
  const [w, setW] = useState(200);
  const [h, setH] = useState(200);

  const updateUIPosition = () => {
    const ref =
      props.shadowRef.current.shadowRoot.querySelector(".camera-draggable");
    // Cached: fires at ~60Hz during resize, was 12 reflows/call.
    const refRect = ref.getBoundingClientRect();
    const circleCenterX = refRect.left + refRect.width / 2;
    const circleCenterY = refRect.top + refRect.height / 2;
    const circleRadius = refRect.width / 2;
    const squareBottomRightX = refRect.left + refRect.width;
    const squareBottomRightY = refRect.top + refRect.height;
    const handle =
      props.shadowRef.current.shadowRoot.querySelector(".camera-resize");
    const toolbar =
      props.shadowRef.current.shadowRoot.querySelector(".camera-toolbar");

    const c = Math.sqrt(
      Math.pow(circleCenterX - squareBottomRightX, 2) +
        Math.pow(circleCenterY - squareBottomRightY, 2)
    );
    const a = circleRadius / Math.sqrt(2);
    const r = (c + Math.sqrt(c ** 2 + 16 * a ** 2)) / 4;

    const x = r - r / Math.sqrt(2);
    const y = r - r / Math.sqrt(2);

    const handleRect = handle.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    handle.style.bottom = `${y - handleRect.width / 2}px`;
    handle.style.right = `${x - handleRect.height / 2}px`;
    toolbar.style.top = `${y - toolbarRect.width / 2}px`;
    toolbar.style.left = `${x - toolbarRect.height / 2}px`;
  };

  const saveDimensions = () => {
    const ref =
      props.shadowRef.current.shadowRoot.querySelector(".camera-draggable");
    const rect = ref.getBoundingClientRect();
    const dims = { size: rect.width, x: rect.x, y: rect.y };

    setContentState((prevContentState) => ({
      ...prevContentState,
      cameraDimensions: dims,
    }));
    chrome.storage.local.set({ cameraDimensions: dims });
  };

  useEffect(() => {
    if (!cameraRef.current) return;
    if (!props.shadowRef.current.shadowRoot.querySelector(".camera-resize"))
      return;
    if (!props.shadowRef.current.shadowRoot.querySelector(".camera-toolbar"))
      return;

    updateUIPosition();
  }, [cameraRef.current]);

  // Keep the camera onscreen when the window is resized.
  useLayoutEffect(() => {
    const updateCameraPosition = () => {
      if (
        !props.shadowRef.current.shadowRoot.querySelector(".camera-draggable")
      )
        return;
      const ref =
        props.shadowRef.current.shadowRoot.querySelector(".camera-draggable");
      let xpos = cameraRef.current.getDraggablePosition().x;
      let ypos = cameraRef.current.getDraggablePosition().y;

      const cameraRect = ref.getBoundingClientRect();
      const width = cameraRect.width;
      const height = cameraRect.height;

      const { innerWidth, innerHeight } = window;

      if (xpos + width > innerWidth) {
        xpos = innerWidth - width;
      }
      if (ypos + height > innerHeight) {
        ypos = innerHeight - height;
      }
      // Clamp top/left too: the right/bottom clamp can go negative if the
      // viewport is smaller than the saved bubble (external monitor saved,
      // built-in restored). Rnd's bounds="window" only constrains drag,
      // not initial render.
      if (xpos < 0) xpos = 0;
      if (ypos < 0) ypos = 0;

      cameraRef.current.updatePosition({ x: xpos, y: ypos });

      saveDimensions();
    };

    updateCameraPosition();

    window.addEventListener("resize", updateCameraPosition);

    return () => {
      window.removeEventListener("resize", updateCameraPosition);
    };
  }, []);

  return (
    <div
      style={{
        visibility:
          !contentState.recording && !contentState.pendingRecording
            ? "visible"
            : (!contentState.pipEnded &&
                contentState.surface === "monitor" &&
                (contentState.pendingRecording || contentState.recording)) ||
              (contentState.isSubscribed &&
                (!contentState.instantMode || contentState.multiMode)) ||
              contentState.onboarding
            ? "hidden"
            : "visible",
        pointerEvents:
          !contentState.recording && !contentState.pendingRecording
            ? "auto"
            : (!contentState.pipEnded &&
                contentState.surface === "monitor" &&
                (contentState.pendingRecording || contentState.recording)) ||
              (contentState.isSubscribed &&
                (!contentState.instantMode || contentState.multiMode)) ||
              contentState.onboarding
            ? "none"
            : "auto",
      }}
    >
      <Rnd
        default={{
          x: contentState.cameraDimensions.x,
          y: contentState.cameraDimensions.y,
          width: contentState.cameraDimensions.size,
          height: contentState.cameraDimensions.size,
        }}
        ref={cameraRef}
        className="camera-draggable"
        dragHandleClassName="camera-grab"
        resizeHandleComponent={{
          bottomRight: <ResizeHandle />,
        }}
        minHeight={150}
        minWidth={150}
        enableResizing={{
          bottom: false,
          bottomRight: true,
          bottomLeft: false,
          left: false,
          right: false,
          top: false,
          topRight: false,
          topLeft: false,
        }}
        onResize={(e, direction, ref, delta, position) => {
          updateUIPosition();
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          saveDimensions();
        }}
        onDragStop={(node, x, y) => {
          saveDimensions();
        }}
        lockAspectRatio={1}
        bounds={"window"}
      >
        <div className="camera-grab"></div>
        <CameraToolbar />
        <iframe
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            outline: "none",
            border: "none",
            pointerEvents: "none",
          }}
          className={`screenity-iframe${
            contentState.cameraFlipped ? " camera-flipped" : ""
          }`}
          src={chrome.runtime.getURL("camera.html")}
          allow="camera; microphone"
        ></iframe>
      </Rnd>
    </div>
  );
};

export default CameraWrap;
