import React, { useEffect, useContext, useRef, useState } from "react";

// Context
import { contentStateContext } from "../../context/ContentState";

const CameraWrap = (props) => {
  const [contentState, setContentState] = React.useContext(contentStateContext);

  return (
    <div>
      <iframe
        style={{
          width: "80vw",
          outline: "none",
          border: "none",
          pointerEvents: "none",
          zIndex: 0,
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          margin: "auto",
        }}
        className={contentState.cameraFlipped ? "camera-flipped" : ""}
        src={chrome.runtime.getURL("camera.html")}
        allow="camera; microphone"
      ></iframe>
    </div>
  );
};

export default CameraWrap;
