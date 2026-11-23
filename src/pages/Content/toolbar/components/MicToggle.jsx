import React, { useContext, useEffect, useState } from "react";
import * as Toggle from "@radix-ui/react-toggle";

// Components
import TooltipWrap from "./TooltipWrap";

import { MicIcon } from "./SVG";

// Context
import { contentStateContext } from "../../context/ContentState";

const MicToggle = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  // Set by the cloud recorder while it is getting the same mic back mid-take.
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let live = true;
    chrome.storage.local.get(["micReconnecting"]).then((r) => {
      if (live) setReconnecting(r.micReconnecting === true);
    });
    const onChanged = (changes, area) => {
      if (area === "local" && changes.micReconnecting) {
        setReconnecting(changes.micReconnecting.newValue === true);
      }
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      live = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  return (
    <TooltipWrap
      shortcut={contentState.toggleMicShortcut}
      content={
        reconnecting
          ? chrome.i18n.getMessage("micReconnectingTooltip")
          : contentState.microphonePermission && contentState.micActive
          ? chrome.i18n.getMessage("disableMicrophoneTooltip")
          : contentState.microphonePermission && !contentState.micActive
          ? chrome.i18n.getMessage("enableMicrophoneTooltip")
          : chrome.i18n.getMessage("noMicrophonePermissionsTooltip")
      }
    >
      <div className="ToolbarToggleWrap">
        <Toggle.Root
          className="ToolbarModeItemSingle"
          aria-label="Toggle microphone"
          pressed={contentState.micActive}
          disabled={
            reconnecting ||
            !contentState.microphonePermission ||
            contentState.defaultAudioInput === "none"
          }
          onPressedChange={(pressed) => {
            setContentState((prevContentState) => ({
              ...prevContentState,
              micActive: pressed,
            }));

            chrome.storage.local.set({
              micActive: pressed,
            });

            chrome.runtime.sendMessage({
              type: "set-mic-active-tab",
              active: pressed,
              defaultAudioInput: contentState.defaultAudioInput,
            });

            // Show toast
            contentState.openToast(
              pressed
                ? chrome.i18n.getMessage("micOnToast")
                : chrome.i18n.getMessage("micOffToast"),
              () => {},
              undefined,
              { quietWhileRecording: true }
            );
          }}
        >
          <MicIcon />
        </Toggle.Root>
      </div>
    </TooltipWrap>
  );
};

export default MicToggle;
