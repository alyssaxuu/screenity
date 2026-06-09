import React, { useState, useEffect, useContext, useRef } from "react";
import styles from "../../styles/player/_RightPanel.module.scss";

import Dropdown from "../../components/editor/Dropdown";
import * as Slider from "@radix-ui/react-slider";
import Switch from "../../components/editor/Switch";

const URL = "/assets/";

import { ReactSVG } from "react-svg";

import { ContentStateContext } from "../../context/ContentState";

const AudioUI = (props) => {
  const [contentState, setContentState] = useContext(ContentStateContext);
  const [audio, setAudio] = useState(null);
  const prevBlob = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (contentState.blob !== prevBlob.current) {
      prevBlob.current = contentState.blob;
      setAudio(null);
      setContentState((prevContentState) => ({
        ...prevContentState,
        volume: 1,
      }));
    }
  }, []);

  const handleAudio = async (e) => {
    const file = e.target.files[0];
    if (!file.type.includes("audio") || file.size === 0) {
      return;
    }

    // Fall back to rawBlob (webm from recovery) if mp4 blob isn't ready.
    const videoBlob =
      contentState.blob || contentState.rawBlob || contentState.webm;
    setAudio(file);
    setContentState((prev) => ({
      ...prev,
      pendingAudio: file,
    }));
  };

  const handleVolume = (e) => {
    let value = e.target.value;
    if (isNaN(value)) {
      return;
    }
    if (value < 0) {
      return;
    }
    if (value > 100) {
      return;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      volume: parseFloat(value) / 100,
    }));
  };

  return (
    <div>
      {contentState.editErrorType === "audio-too-large" && (
        <div className={styles.alert}>
          <div className={styles.buttonLeft}>
            <ReactSVG src={URL + "editor/icons/alert.svg"} />
          </div>
          <div className={styles.buttonMiddle}>
            <div className={styles.buttonTitle}>
              {chrome.i18n.getMessage("editAudioTooLargeTitle")}
            </div>
            <div className={styles.buttonDescription}>
              {chrome.i18n.getMessage("editAudioTooLargeDescription")}
            </div>
          </div>
          <div
            className={styles.buttonRight}
            onClick={() =>
              setContentState((prev) => ({ ...prev, editErrorType: null }))
            }
          >
            {chrome.i18n.getMessage("permissionsModalDismiss")}
          </div>
        </div>
      )}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Audio upload</div>
        <input
          type="file"
          accept="audio/*"
          onChange={handleAudio}
          style={{ display: "none" }}
          ref={inputRef}
        />
        {!audio && (
          <div
            className={styles.uploadArea}
            onClick={() => inputRef.current.click()}
          >
            <ReactSVG src={URL + "editor/icons/upload.svg"} />
            <div className={styles.uploadDetails}>
              <div className={styles.uploadText}>
                {chrome.i18n.getMessage("sandboxAudioDragAndDrop")}
              </div>
              <div className={styles.uploadDescription}>
                {chrome.i18n.getMessage("sandboxAudioOrBrowse")}
              </div>
            </div>
          </div>
        )}
        {audio && (
          <div className={styles.audioDetails}>
            <div className={styles.audioDetailsLeft}>
              <ReactSVG src={URL + "editor/icons/attachment.svg"} />
            </div>
            <div className={styles.audioDetailsMiddle}>
              <span>{audio.name}</span>
            </div>
            <div className={styles.audioDetailsRight}>
              <ReactSVG
                src={URL + "editor/icons/cross.svg"}
                onClick={() => {
                  setAudio(null);
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    blob: prevBlob.current,
                  }));
                  inputRef.current.value = null;
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {chrome.i18n.getMessage("sandboxAudioSettingsTitle")}
        </div>
        <div className={styles.inputs}>
          <div className={`${styles.input} ${styles.inputVolume}`}>
            <div className={styles.inputTitle}>
              {chrome.i18n.getMessage("sandboxAudioVolumeLabel")}
            </div>
            <input
              type="text"
              className="input"
              onChange={(e) => handleVolume(e)}
              value={Math.round(contentState.volume * 100)}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    volume: 0,
                  }));
                }
              }}
            />
            <span>%</span>
          </div>
          <Slider.Root
            className={styles.SliderRoot}
            max={100}
            step={1}
            onValueChange={(newValue) => {
              setContentState((prevContentState) => ({
                ...prevContentState,
                volume: Math.round(newValue) / 100,
              }));
            }}
            value={[contentState.volume * 100]}
          >
            <Slider.Track className={styles.SliderTrack}>
              <Slider.Range className={styles.SliderRange} />
            </Slider.Track>
            <Slider.Thumb className={styles.SliderThumb} aria-label="Volume" />
          </Slider.Root>
        </div>
        <Switch />
      </div>
    </div>
  );
};

export default AudioUI;
