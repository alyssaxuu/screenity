import React, { useState, useEffect, useContext } from "react";
import styles from "../../styles/player/_RightPanel.module.scss";

// Components
import Dropdown from "../../components/editor/Dropdown";

import { ReactSVG } from "react-svg";

const URL =
  "chrome-extension://" + chrome.i18n.getMessage("@@extension_id") + "/assets/";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const CropUI = (props) => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context

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
      width: parseFloat(value),
      cropPreset: "none",
      fromCropper: false,
    }));
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
      height: parseFloat(value),
      cropPreset: "none",
      fromCropper: false,
    }));
  };

  const handleTop = (e) => {
    let value = e.target.value;
    if (isNaN(value)) {
      return;
    }
    if (value < 0) {
      return;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      top: parseFloat(value),
      fromCropper: false,
    }));
  };

  const handleLeft = (e) => {
    let value = e.target.value;
    if (isNaN(value)) {
      return;
    }
    if (value < 0) {
      return;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      left: parseFloat(value),
      fromCropper: false,
    }));
  };

  return (
    <div>
      {/*
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Dimensions</div>
        <div className={styles.inputSection}>
          <div className={styles.inputSectionTitle}>Preset</div>
          <Dropdown />
        </div>
      </div>
							*/}

      <div className={styles.alert}>
        <div className={styles.buttonLeft}>
          <ReactSVG src={URL + "editor/icons/alert.svg"} />
        </div>
        <div className={styles.buttonMiddle}>
          <div className={styles.buttonTitle}>
            {chrome.i18n.getMessage("croppingInfoTitle")}
          </div>
          <div className={styles.buttonDescription}>
            {chrome.i18n.getMessage("videoProcessingLabelDescription")}
          </div>
        </div>
        <div
          className={styles.buttonRight}
          onClick={() => {
            chrome.runtime.sendMessage({ type: "upgrade-info" });
          }}
        >
          {chrome.i18n.getMessage("learnMoreLabel")}
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {chrome.i18n.getMessage("sandboxCropTitle")}
        </div>
        <div className={styles.inputs}>
          <div className={styles.input}>
            <div className={styles.inputTitle}>
              {chrome.i18n.getMessage("widthLabel")}
            </div>
            <input
              type="text"
              className="input"
              onChange={(e) => handleWidth(e)}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    width: 0,
                  }));
                }
              }}
              value={contentState.width}
            />
            <span>px</span>
          </div>
          <div className={styles.input}>
            <div className={styles.inputTitle}>
              {chrome.i18n.getMessage("heightLabel")}
            </div>
            <input
              type="text"
              className="input"
              onChange={(e) => handleHeight(e)}
              value={contentState.height}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    height: 0,
                  }));
                }
              }}
            />
            <span>px</span>
          </div>
        </div>
        <div className={styles.inputs}>
          <div className={styles.input}>
            <div className={styles.inputTitle}>
              {chrome.i18n.getMessage("leftLabel")}
            </div>
            <input
              type="text"
              className="input"
              onChange={(e) => handleLeft(e)}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    left: 0,
                  }));
                }
              }}
              value={contentState.left}
            />
            <span>px</span>
          </div>
          <div className={styles.input}>
            <div className={styles.inputTitle}>
              {chrome.i18n.getMessage("topLabel")}
            </div>
            <input
              type="text"
              className="input"
              onChange={(e) => handleTop(e)}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    top: 0,
                  }));
                }
              }}
              value={contentState.top}
            />
            <span>px</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropUI;
