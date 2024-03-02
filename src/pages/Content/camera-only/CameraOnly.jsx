import React, { useContext } from "react";

import CameraWrap from "./layout/CameraWrap";

// Context
import { contentStateContext } from "../context/ContentState";

const CameraOnly = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  return (
    <div className="camera-page">
      {contentState.defaultVideoInput != "none" &&
        contentState.cameraActive &&
        contentState.recordingType === "camera" && (
          <CameraWrap shadowRef={props.shadowRef} />
        )}
    </div>
  );
};

export default CameraOnly;
