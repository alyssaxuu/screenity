import React, { useState, useEffect, useContext } from "react";

import * as Toolbar from "@radix-ui/react-toolbar";

import { CameraCloseIcon, CameraMoreIcon } from "../../toolbar/components/SVG";

// Context
import { contentStateContext } from "../../context/ContentState";

const CameraToolbar = () => {
  const [contentState, setContentState] = useContext(contentStateContext);

  return (
    <Toolbar.Root className="camera-toolbar">
      <Toolbar.Button
        className="CameraToolbarButton"
        onClick={() => {
          setContentState((prevContentState) => ({
            ...prevContentState,
            cameraActive: false,
          }));
          chrome.storage.local.set({ cameraActive: false });
        }}
      >
        <CameraCloseIcon />
      </Toolbar.Button>
      <Toolbar.Button className="CameraToolbarButton CameraMore">
        <CameraMoreIcon />
      </Toolbar.Button>
    </Toolbar.Root>
  );
};

export default CameraToolbar;
