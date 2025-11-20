import React from "react";

import { CameraResizeIcon } from "../../toolbar/components/SVG";

const ResizeHandle = ({ position }) => {
  return (
    <div className="camera-resize">
      <CameraResizeIcon />
    </div>
  );
};

export default ResizeHandle;
