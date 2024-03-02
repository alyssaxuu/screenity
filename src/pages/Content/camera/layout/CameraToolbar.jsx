import React, { useState, useEffect, useContext } from "react";

import * as Toolbar from "@radix-ui/react-toolbar";
// Tooltip
import TooltipWrap from "../../toolbar/components/TooltipWrap";

import { CameraCloseIcon, Pip } from "../../toolbar/components/SVG";

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
      {contentState.recording && contentState.surface === "monitor" && (
        <TooltipWrap
          content={chrome.i18n.getMessage("togglePictureinPictureModeTooltip")}
        >
          <Toolbar.Button
            className="CameraToolbarButton CameraMore"
            onClick={() => {
              chrome.runtime.sendMessage({ type: "toggle-pip" });
            }}
          >
            <Pip />
          </Toolbar.Button>
        </TooltipWrap>
      )}
    </Toolbar.Root>
  );
};

export default CameraToolbar;
