// Work in progress - settings for the recording

import React, { useState, useContext, useRef, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { MoreIconPopup } from "../../toolbar/components/SVG";

import { CheckWhiteIcon } from "../../images/popup/images";

import JSZip from "jszip";

// Context
import { contentStateContext } from "../../context/ContentState";

const SettingsMenu = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [restore, setRestore] = useState(false);

  const handleTroubleshooting = () => {
    if (typeof contentState.openModal === "function") {
      contentState.openModal(
        chrome.i18n.getMessage("troubleshootModalTitle"),
        chrome.i18n.getMessage("troubleshootModalDescription"),
        chrome.i18n.getMessage("troubleshootModalButton"),
        chrome.i18n.getMessage("sandboxEditorCancelButton"),
        () => {
          // Need to create a file with the original data, any console logs, and system info
          const userAgent = navigator.userAgent;
          let platformInfo = {};
          chrome.runtime
            .sendMessage({ type: "get-platform-info" })
            .then((response) => {
              platformInfo = response;
              const manifestInfo = chrome.runtime.getManifest().version;

              //const contentStateData = JSON.stringify({ ...contentState });

              // Now we need to create a file with all of this data
              const data = {
                userAgent: userAgent,
                platformInfo: platformInfo,
                manifestInfo: manifestInfo,
                defaultAudioInput: contentState.defaultAudioInput,
                defaultAudioOutput: contentState.defaultAudioOutput,
                defaultVideoInput: contentState.defaultVideoInput,
                quality: contentState.quality,
                systemAudio: contentState.systemAudio,
                audioInput: contentState.audioInput,
                audioOutput: contentState.audioOutput,
                backgroundEffectsActive: contentState.backgroundEffectsActive,
                recording: contentState.recording,
                recordingType: contentState.recordingType,
                askForPermissions: contentState.askForPermissions,
                cameraPermission: contentState.cameraPermission,
                microphonePermission: contentState.microphonePermission,
                askMicrophone: contentState.askMicrophone,
                cursorMode: contentState.cursorMode,
                zoomEnabled: contentState.zoomEnabled,
                offscreenRecording: contentState.offscreenRecording,
                updateChrome: contentState.updateChrome,
                permissionsChecked: contentState.permissionsChecked,
                permissionsLoaded: contentState.permissionsLoaded,
                hideUI: contentState.hideUI,
                alarm: contentState.alarm,
                alarmTime: contentState.alarmTime,
                surface: contentState.surface,
                blurMode: contentState.blurMode,
                //contentState: contentStateData,
              };
              // Create a zip file with the original recording and the data
              const zip = new JSZip();
              zip.file("troubleshooting.json", JSON.stringify(data));
              zip.generateAsync({ type: "blob" }).then(function (blob) {
                const url = window.URL.createObjectURL(blob);

                // Download file
                const a = document.createElement("a");
                a.href = url;
                a.download = "screenity-troubleshooting.zip";
                a.click();
                window.URL.revokeObjectURL(url);

                chrome.runtime.sendMessage({
                  type: "indexed-db-download",
                });
              });
            });
        },
        () => {}
      );
    }
  };

  return (
    <DropdownMenu.Root
      open={props.open}
      onOpenChange={(open) => {
        props.setOpen(open);

        chrome.runtime
          .sendMessage({ type: "check-restore" })
          .then((response) => {
            setRestore(response.restore);
          });
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button className="IconButton" aria-label="Customise options">
          <MoreIconPopup />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal
        container={props.shadowRef.current.shadowRoot.querySelector(
          ".container"
        )}
      >
        <DropdownMenu.Content className="DropdownMenuContent" sideOffset={5}>
          <DropdownMenu.CheckboxItem
            className="DropdownMenuItem"
            onSelect={(e) => {
              e.preventDefault();
            }}
            onCheckedChange={(checked) => {
              setContentState((prevContentState) => ({
                ...prevContentState,
                quality: checked ? "max" : "min",
              }));
              chrome.storage.local.set({
                quality: checked ? "max" : "min",
              });
            }}
            checked={contentState.quality === "max"}
          >
            {chrome.i18n.getMessage("highestQuality")}
            <DropdownMenu.ItemIndicator className="ItemIndicator">
              <img src={CheckWhiteIcon} />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem
            className="DropdownMenuItem"
            onSelect={(e) => {
              e.preventDefault();
            }}
            onCheckedChange={(checked) => {
              setContentState((prevContentState) => ({
                ...prevContentState,
                systemAudio: checked,
              }));
              chrome.storage.local.set({
                systemAudio: checked,
              });
            }}
            checked={contentState.systemAudio}
          >
            {chrome.i18n.getMessage("systemAudioLabel")}
            <DropdownMenu.ItemIndicator className="ItemIndicator">
              <img src={CheckWhiteIcon} />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Item
            className="DropdownMenuItem"
            onSelect={(e) => {
              e.preventDefault();
              chrome.runtime.sendMessage({ type: "restore-recording" });
            }}
            disabled={!restore}
          >
            {chrome.i18n.getMessage("restoreRecording")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="DropdownMenuItem"
            onSelect={(e) => {
              e.preventDefault();
              handleTroubleshooting();
            }}
          >
            {chrome.i18n.getMessage("downloadForTroubleshootingOption")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default SettingsMenu;
