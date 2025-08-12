import React, { useEffect, useContext, useState, useRef } from "react";

import Dropdown from "../components/Dropdown";
import Switch from "../components/Switch";
import RegionDimensions from "../components/RegionDimensions";
import Settings from "./Settings";
import { contentStateContext } from "../../context/ContentState";
import { CameraOffBlue, MicOffBlue } from "../../images/popup/images";
import * as Dialog from "@radix-ui/react-dialog";

import BackgroundEffects from "../components/BackgroundEffects";

import { AlertIcon, TimeIcon, NoInternet } from "../../toolbar/components/SVG";

const RecordingType = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [cropActive, setCropActive] = useState(false);
     const [description, setDescription] = useState("");

    const [open, setOpen] = useState(false);

  const [time, setTime] = useState(0);
  const [URL, setURL] = useState(
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9"
  );
  const [URL2, setURL2] = useState(
    "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9"
  );

  const buttonRef = useRef(null);
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  useEffect(() => {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
        `https://translate.google.com/translate?sl=en&tl=${locale}&u=https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9`
      );
      setURL2(
        `https://translate.google.com/translate?sl=en&tl=${locale}&u=https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/how-to-grant-screenity-permission-to-record-your-camera-and-microphone/x6U69TnrbMjy5CQ96Er2E9`
      );
    }
  }, []);

  useEffect(() => {
    // Convert seconds to mm:ss
    let minutes = Math.floor(contentState.alarmTime / 60);
    let seconds = contentState.alarmTime - minutes * 60;
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    setTime(minutes + ":" + seconds);
  }, []);

  useEffect(() => {
    // Convert seconds to mm:ss
    let minutes = Math.floor(contentState.alarmTime / 60);
    let seconds = contentState.alarmTime - minutes * 60;
    if (seconds < 10) {
      seconds = "0" + seconds;
    }
    setTime(minutes + ":" + seconds);
  }, [contentState.alarmTime]);

  // Start recording
  const startStreaming = () => {
    setOpen((v) => !v)
    // contentState.startStreaming();
  };

  useEffect(() => {
    // Check if CropTarget is null
    if (typeof CropTarget === "undefined") {
      setCropActive(false);
      setContentState((prevContentState) => ({
        ...prevContentState,
        customRegion: false,
      }));
    } else {
      setCropActive(true);
    }
  }, []);

  useEffect(() => {
    if (contentState.recording) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        pendingRecording: false,
      }));
    }
  }, [contentState.recording]);




  const handleSubmit = (e) => {
    e.preventDefault(); // prevent default close if button inside form
    if (!description.trim()) {
      alert("Please enter a description");
      return;
    }

    // Save to localStorage (or chrome.storage.local if in extension)
  

    chrome.storage.local.set({ videoDescription: description }, () => {
  // alert("Description saved!");
      setOpen(false);
      contentState.startStreaming();
      });
  };



  return (
    <div>
      {contentState.updateChrome && (
        <div className="popup-warning">
          <div className="popup-warning-left">
            <AlertIcon />
          </div>
          <div className="popup-warning-middle">
            <div className="popup-warning-title">
              {chrome.i18n.getMessage("customAreaRecordingDisabledTitle")}
            </div>
            <div className="popup-warning-description">
              {chrome.i18n.getMessage("customAreaRecordingDisabledDescription")}
            </div>
          </div>
          <div className="popup-warning-right">
            <a href={URL} target="_blank">
              {chrome.i18n.getMessage("customAreaRecordingDisabledAction")}
            </a>
          </div>
        </div>
      )}
      {/*contentState.offline && (
        <div className="popup-warning">
          <div className="popup-warning-left">
            <NoInternet />
          </div>
          <div className="popup-warning-middle">
            <div className="popup-warning-title">You are currently offline</div>
            <div className="popup-warning-description">
              Some features are unavailable
            </div>
          </div>
          <div className="popup-warning-right">
            <a href="#">Try again</a>
          </div>
        </div>
			)*/}
      {!cropActive &&
        contentState.recordingType === "region" &&
        !contentState.offline && (
          <div className="popup-warning">
            <div className="popup-warning-left">
              <AlertIcon />
            </div>
            <div className="popup-warning-middle">
              <div className="popup-warning-title">
                {chrome.i18n.getMessage("customAreaRecordingDisabledTitle")}
              </div>
              <div className="popup-warning-description">
                {chrome.i18n.getMessage(
                  "customAreaRecordingDisabledDescription"
                )}
              </div>
            </div>
            <div className="popup-warning-right">
              <a
                href="https://support.google.com/chrome/answer/95414?hl=en-GB&co=GENIE.Platform%3DDesktop"
                target="_blank"
              >
                {chrome.i18n.getMessage("customAreaRecordingDisabledAction")}
              </a>
            </div>
          </div>
        )}
      {!contentState.cameraPermission && (
        <button
          className="permission-button"
          onClick={() => {
            if (typeof contentState.openModal === "function") {
              contentState.openModal(
                chrome.i18n.getMessage("permissionsModalTitle"),
                chrome.i18n.getMessage("permissionsModalDescription"),
                chrome.i18n.getMessage("permissionsModalReview"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  chrome.runtime.sendMessage({
                    type: "extension-media-permissions",
                  });
                },
                () => {},
                chrome.runtime.getURL("assets/helper/permissions.webp"),
                chrome.i18n.getMessage("learnMoreDot"),
                URL2,
                true,
                false
              );
            }
          }}
        >
          <img src={CameraOffBlue} />
          <span>{chrome.i18n.getMessage("allowCameraAccessButton")}</span>
        </button>
      )}
      {/* {contentState.cameraPermission && (
        <Dropdown type="camera" shadowRef={props.shadowRef} />
      )} */}
      {contentState.cameraPermission &&
        contentState.defaultVideoInput != "none" &&
        contentState.cameraActive && (
          <div>
            {/* <Switch
              label={chrome.i18n.getMessage("flipCameraLabel")}
              name="flip-camera"
              value="cameraFlipped"
            />
            <Switch
              label={chrome.i18n.getMessage("backgroundEffectsLabel")}
              name="background-effects-active"
              value="backgroundEffectsActive"
            />
            {contentState.backgroundEffectsActive && <BackgroundEffects />} */}
          </div>
        )}

      {!contentState.microphonePermission && (
        <button
          className="permission-button"
          onClick={() => {
            if (typeof contentState.openModal === "function") {
              contentState.openModal(
                chrome.i18n.getMessage("permissionsModalTitle"),
                chrome.i18n.getMessage("permissionsModalDescription"),
                chrome.i18n.getMessage("permissionsModalReview"),
                chrome.i18n.getMessage("permissionsModalDismiss"),
                () => {
                  chrome.runtime.sendMessage({
                    type: "extension-media-permissions",
                  });
                },
                () => {},
                chrome.runtime.getURL("assets/helper/permissions.webp"),
                chrome.i18n.getMessage("learnMoreDot"),
                URL2,
                true,
                false
              );
            }
          }}
        >
          <img src={MicOffBlue} />
          <span>{chrome.i18n.getMessage("allowMicrophoneAccessButton")}</span>
        </button>
      )}
      {contentState.microphonePermission && (
        <Dropdown type="mic" shadowRef={props.shadowRef} />
      )}
      {/* {((contentState.microphonePermission &&
        contentState.defaultAudioInput != "none" &&
        contentState.micActive) ||
        (contentState.microphonePermission && contentState.pushToTalk)) && (
        <div>
          <iframe
            style={{
              width: "100%",
              height: "30px",
              zIndex: 9999999999,
              position: "relative",
            }}
            allow="camera; microphone"
            src={chrome.runtime.getURL("waveform.html")}
          ></iframe>
          <Switch
            label={
              isMac
                ? chrome.i18n.getMessage("pushToTalkLabel") + " (⌥⇧U)"
                : chrome.i18n.getMessage("pushToTalkLabel") + " (Alt⇧U)"
            }
            name="pushToTalk"
            value="pushToTalk"
          />
        </div>
      )} */}
      {contentState.recordingType === "region" && cropActive && (
        <div>
          <div className="popup-content-divider"></div>
          <Switch
            label={chrome.i18n.getMessage("customAreaLabel")}
            name="customRegion"
            value="customRegion"
          />
          {contentState.customRegion && <RegionDimensions />}
        </div>
      )}
      <button
        role="button"
        className="main-button recording-button"
        ref={buttonRef}
        tabIndex="0"
        onClick={startStreaming}
        disabled={
          contentState.pendingRecording ||
          ((!contentState.cameraPermission || !contentState.cameraActive) &&
            contentState.recordingType === "camera")
        }
      >
        {contentState.alarm && contentState.alarmTime > 0 && (
          <div className="alarm-time-button">
            <TimeIcon />
            {time}
          </div>
        )}
        {/* (!contentState.cameraPermission || !contentState.cameraActive) && */}
        <span className="main-button-label">
          {contentState.pendingRecording
            ? chrome.i18n.getMessage("recordButtonInProgressLabel")
            : 
              contentState.recordingType === "camera"
            ? chrome.i18n.getMessage("recordButtonNoCameraLabel")
            : chrome.i18n.getMessage("recordButtonLabel")}
        </span>
        <span className="main-button-shortcut">
          {contentState.recordingShortcut}
        </span>
      </button>
     <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Overlay
         style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        position: "fixed",
        inset: 0,
        zIndex: 999,
      }}
      />
      <Dialog.Content
    style={{
        backgroundColor: "white",
        borderRadius: "6px",
        boxShadow: "0 10px 15px rgba(0,0,0,0.3)",
        padding: "20px",
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        minWidth: "300px",
        zIndex: 1000,
      }}
  >
   

    <label
      htmlFor="videoDescription"
      style={{
        display: "block",
        marginTop: "20px",
        marginBottom: "8px",
        fontWeight: "bold",
        fontSize: "14px",
      }}
    >
      Can you tell us what is this video about?
    </label>
    <textarea
      id="videoDescription"
      rows={4}
      placeholder="Write your description here..."
      style={{
        width: "100%",
        padding: "8px",
        fontSize: "14px",
        borderRadius: "4px",
        border: "1px solid #ccc",
        resize: "vertical",
      }}
       value={description}
          onChange={(e) => setDescription(e.target.value)}
    />

    <Dialog.Close asChild>
      <button
        style={{
          marginTop: "20px",
          padding: "8px 16px",
          backgroundColor: "#ff9800",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
        }}
                  onClick={handleSubmit}

      >
        Submit
      </button>
    </Dialog.Close>
  </Dialog.Content>
      </Dialog.Root>


      <Settings />

    </div>
  );
};

export default RecordingType;
