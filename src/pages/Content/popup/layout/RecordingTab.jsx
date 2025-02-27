import React, { useEffect, useState, useContext } from "react";
import * as Tabs from "@radix-ui/react-tabs";

import RecordingType from "./RecordingType";
import {
  ScreenTabOn,
  ScreenTabOff,
  RegionTabOn,
  RegionTabOff,
  MockupTabOn,
  MockupTabOff,
  CameraTabIconOn,
  CameraTabIconOff,
} from "../../images/popup/images";

// Context
import { contentStateContext } from "../../context/ContentState";

const RecordingTab = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  const onValueChange = (tab) => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      recordingType: tab,
    }));
    chrome.storage.local.set({ recordingType: tab });

    if (tab === "camera") {
      chrome.runtime.sendMessage({ type: "camera-only-update" });
    } else {
      chrome.runtime.sendMessage({ type: "screen-update" });
    }
  };

  return (
    <div className="recording-ui">
      <Tabs.Root
        className="TabsRoot"
        defaultValue="screen"
        onValueChange={onValueChange}
        value={contentState.recordingType}
      >
        <Tabs.List
          className="TabsList"
          aria-label="Manage your account"
          tabIndex={0}
        >
          <Tabs.Trigger className="TabsTrigger" value="screen" tabIndex={0}>
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "screen"
                      ? ScreenTabOn
                      : ScreenTabOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("screenType")}</span>
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger className="TabsTrigger" value="region" tabIndex={0}>
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "region"
                      ? RegionTabOn
                      : RegionTabOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("tabType")}</span>
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger className="TabsTrigger" value="camera" tabIndex={0}>
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "camera"
                      ? CameraTabIconOn
                      : CameraTabIconOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("cameraType")}</span>
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger
            className="TabsTrigger"
            value="mockup"
            tabIndex={0}
            disabled
            style={{ pointerEvents: "none", opacity: 0.5 }}
          >
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "mockup"
                      ? MockupTabOn
                      : MockupTabOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("MockupType")}</span>
            </div>
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className="TabsContent" value="screen">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="region">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="camera">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="mockup">
          WIP
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default RecordingTab;
