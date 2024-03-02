import React, { useState, useRef, useContext, useEffect } from "react";

// Context
import { contentStateContext } from "../../context/ContentState";

const RegionDimensions = () => {
  const [contentState, setContentState] = useContext(contentStateContext);

  const handleWidth = (e) => {
    let value = e.target.value;
    if (isNaN(value)) {
      return;
    }
    if (value < 0) {
      return;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      regionWidth: value,
      fromRegion: false,
    }));
    chrome.storage.local.set({
      regionWidth: value,
    });
  };

  const handleHeight = (e) => {
    let value = e.target.value;
    if (isNaN(value)) {
      return;
    }
    if (value < 0) {
      return;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      regionHeight: value,
      fromRegion: false,
    }));
    chrome.storage.local.set({
      regionHeight: value,
    });
  };

  return (
    <div className="region-dimensions">
      <div className="region-input">
        <label htmlFor="region-width" style={{ display: "none" }}>
          {chrome.i18n.getMessage("regionWidthLabel")}
        </label>
        <input
          id="region-width"
          onChange={(e) => handleWidth(e)}
          onBlur={(e) => {
            if (e.target.value === "") {
              setContentState((prevContentState) => ({
                ...prevContentState,
                regionWidth: 100,
                fromRegion: false,
              }));
              chrome.storage.local.set({
                regionWidth: 100,
              });
            }
          }}
          value={contentState.regionWidth}
        />
        <span>W</span>
      </div>
      <div className="region-input">
        <label htmlFor="region-height" style={{ display: "none" }}>
          {chrome.i18n.getMessage("regionHeightLabel")}
        </label>
        <input
          id="region-height"
          onChange={(e) => handleHeight(e)}
          onBlur={(e) => {
            if (e.target.value === "") {
              setContentState((prevContentState) => ({
                ...prevContentState,
                regionHeight: 100,
                fromRegion: false,
              }));
              chrome.storage.local.set({
                regionHeight: 100,
              });
            }
          }}
          value={contentState.regionHeight}
        />
        <span>H</span>
      </div>
    </div>
  );
};

export default RegionDimensions;
