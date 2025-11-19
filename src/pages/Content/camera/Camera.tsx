import React, { useContext, useEffect } from "react";

import CameraWrap from "./layout/CameraWrap";

import { contentStateContext } from "../context/ContentState";

const Camera = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  return (
    <div
      className="camera-page"
      style={{
        visibility:
          (contentState.isSubscribed &&
            (!contentState.instantMode || contentState.multiMode)) ||
          !contentState.recording ||
          contentState.onboarding
            ? "hidden"
            : "visible",
        pointerEvents:
          (contentState.isSubscribed &&
            (!contentState.instantMode || contentState.multiMode)) ||
          !contentState.recording ||
          contentState.onboarding
            ? "none"
            : "auto",
      }}
    >
      {contentState.defaultVideoInput != "none" &&
        contentState.cameraActive && <CameraWrap shadowRef={props.shadowRef} />}
    </div>
  );
};

export default Camera;
