// Work in progress - settings for the recording

import React, { useState, useContext } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { MoreIconPopup } from "../../toolbar/components/SVG";

import { CheckWhiteIcon } from "../../images/popup/images";

// Context
import { contentStateContext } from "../../context/ContentState";

const SettingsMenu = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [restore, setRestore] = useState(false);

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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default SettingsMenu;
