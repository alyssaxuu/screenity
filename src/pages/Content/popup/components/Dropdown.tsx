import React, { useEffect, useState, useContext, useRef } from "react";

import * as Select from "@radix-ui/react-select";
import {
  DropdownIcon,
  CheckWhiteIcon,
  CameraOnIcon,
  CameraOffIcon,
  MicOnIcon,
  MicOffIcon,
} from "../../images/popup/images";

// Context
import { contentStateContext } from "../../context/ContentState";

const Dropdown = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [label, setLabel] = useState(chrome.i18n.getMessage("None"));
  const [open, setOpen] = useState(false);

  const updateItems = () => {
    if (props.type === "camera") {
      if (
        contentState.defaultVideoInput === "none" ||
        !contentState.cameraActive
      ) {
        setLabel(chrome.i18n.getMessage("noCameraDropdownLabel"));
      } else {
        // Check if defaultVideoInput is in camdevices, if not set to none
        if (
          contentState.videoInput.find(
            (device) => device.deviceId === contentState.defaultVideoInput
          )
        ) {
          setLabel(
            contentState.videoInput.find(
              (device) => device.deviceId === contentState.defaultVideoInput
            ).label
          );
        } else {
          setLabel(chrome.i18n.getMessage("noCameraDropdownLabel"));
        }
      }
    } else {
      if (
        contentState.defaultAudioInput === "none" ||
        (!contentState.micActive && !contentState.pushToTalk)
      ) {
        setLabel(chrome.i18n.getMessage("noMicrophoneDropdownLabel"));
      } else {
        // Check if defaultAudioInput is in micdevices, if not set to none
        if (
          contentState.audioInput.find(
            (device) => device.deviceId === contentState.defaultAudioInput
          )
        ) {
          setLabel(
            contentState.audioInput.find(
              (device) => device.deviceId === contentState.defaultAudioInput
            ).label
          );
        } else {
          setLabel(chrome.i18n.getMessage("noMicrophoneDropdownLabel"));
        }
      }
    }
  };

  useEffect(() => {
    updateItems();
  }, [
    contentState.defaultAudioInput,
    contentState.defaultVideoInput,
    contentState.audioInput,
    contentState.videoInput,
    contentState.cameraActive,
    contentState.micActive,
  ]);

  useEffect(() => {
    updateItems();
  }, []);

  const toggleActive = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    if (props.type === "camera") {
      if (contentState.cameraActive) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          cameraActive: false,
        }));
        chrome.storage.local.set({
          cameraActive: false,
        });
        setLabel(chrome.i18n.getMessage("noCameraDropdownLabel"));
      } else {
        setContentState((prevContentState) => ({
          ...prevContentState,
          cameraActive: true,
        }));
        chrome.storage.local.set({
          cameraActive: true,
        });
        setLabel(
          contentState.videoInput.find(
            (device) => device.deviceId === contentState.defaultVideoInput
          ).label
        );
      }
    } else {
      if (contentState.micActive) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          micActive: false,
        }));
        chrome.storage.local.set({
          micActive: false,
        });
        setLabel(chrome.i18n.getMessage("noMicrophoneDropdownLabel"));
      } else {
        setContentState((prevContentState) => ({
          ...prevContentState,
          micActive: true,
        }));
        chrome.storage.local.set({
          micActive: true,
        });
        setLabel(
          contentState.audioInput.find(
            (device) => device.deviceId === contentState.defaultAudioInput
          ).label
        );
      }
    }
  };

  const clickedIcon = useRef(false);

  return (
    <Select.Root
      open={open}
      onOpenChange={(open) => {
        if (clickedIcon.current) return;
        setOpen(open);
      }}
      value={
        props.type === "camera" && contentState.cameraActive
          ? contentState.defaultVideoInput
          : props.type === "camera" && !contentState.cameraActive
          ? "none"
          : props.type === "mic" &&
            (contentState.micActive || contentState.pushToTalk)
          ? contentState.defaultAudioInput
          : props.type === "mic" && !contentState.micActive
          ? "none"
          : "none"
      }
      onValueChange={(newValue) => {
        if (props.type === "camera") {
          if (newValue === "none") {
            setContentState((prevContentState) => ({
              ...prevContentState,
              cameraActive: false,
            }));
            chrome.storage.local.set({
              cameraActive: false,
            });
            setLabel(chrome.i18n.getMessage("noCameraDropdownLabel"));
          } else {
            setContentState((prevContentState) => ({
              ...prevContentState,
              defaultVideoInput: newValue,
              cameraActive: true,
            }));
            chrome.storage.local.set({
              defaultVideoInput: newValue,
              cameraActive: true,
            });
            chrome.runtime.sendMessage({
              type: "switch-camera",
              id: newValue,
            });
            setLabel(
              contentState.videoInput.find(
                (device) => device.deviceId === newValue
              ).label
            );
          }
        } else {
          if (newValue === "none") {
            setContentState((prevContentState) => ({
              ...prevContentState,
              micActive: false,
            }));
            chrome.storage.local.set({
              micActive: false,
            });
            setLabel(chrome.i18n.getMessage("noMicrophoneDropdownLabel"));
          } else {
            setContentState((prevContentState) => ({
              ...prevContentState,
              defaultAudioInput: newValue,
              micActive: true,
            }));
            chrome.storage.local.set({
              defaultAudioInput: newValue,
              micActive: true,
            });
            setLabel(
              contentState.audioInput.find(
                (device) => device.deviceId === newValue
              ).label
            );
          }
        }
      }}
    >
      <Select.Trigger className="SelectTrigger" aria-label="Food">
        <Select.Icon
          className="SelectIconType"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(false);
            clickedIcon.current = true;
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(false);
            clickedIcon.current = true;
          }}
          onMouseUp={(e) => {
            clickedIcon.current = false;
          }}
        >
          <div
            className="SelectIconButton"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              toggleActive(e);
              clickedIcon.current = true;
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen(false);
              clickedIcon.current = true;
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onMouseUp={(e) => {
              clickedIcon.current = false;
            }}
          >
            {props.type == "camera" && (
              <img
                src={
                  contentState.defaultVideoInput === "none" ||
                  !contentState.cameraActive
                    ? CameraOffIcon
                    : CameraOnIcon
                }
              />
            )}
            {props.type == "mic" && (
              <img
                src={
                  contentState.defaultAudioInput === "none" ||
                  !contentState.micActive
                    ? MicOffIcon
                    : MicOnIcon
                }
              />
            )}
          </div>
        </Select.Icon>
        <div className="SelectValue">
          <Select.Value
            placeholder={chrome.i18n.getMessage(
              "selectSourceDropdownPlaceholder"
            )}
          >
            {label}
          </Select.Value>
        </div>
        {props.type == "camera" &&
          (contentState.defaultVideoInput == "none" ||
            !contentState.cameraActive) && (
            <div className="SelectOff">
              {chrome.i18n.getMessage("offLabel")}
            </div>
          )}
        {props.type == "mic" &&
          (contentState.defaultAudioInput == "none" ||
            (!contentState.micActive && !contentState.pushToTalk)) && (
            <div className="SelectOff">
              {chrome.i18n.getMessage("offLabel")}
            </div>
          )}
        <Select.Icon className="SelectIconDrop">
          <img src={DropdownIcon} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal
        container={props.shadowRef.current.shadowRoot.querySelector(
          ".container"
        )}
      >
        <Select.Content position="popper" className="SelectContent">
          <Select.ScrollUpButton className="SelectScrollButton"></Select.ScrollUpButton>
          <Select.Viewport className="SelectViewport">
            <Select.Group>
              <SelectItem value="none">
                {props.type == "camera"
                  ? chrome.i18n.getMessage("noCameraDropdownLabel")
                  : chrome.i18n.getMessage("noMicrophoneDropdownLabel")}
              </SelectItem>
            </Select.Group>
            {props.type == "camera" && contentState.videoInput.length > 0 && (
              <Select.Separator className="SelectSeparator" />
            )}
            {props.type == "mic" && contentState.audioInput.length > 0 && (
              <Select.Separator className="SelectSeparator" />
            )}
            <Select.Group>
              {props.type == "camera" &&
                contentState.videoInput.map((device) => (
                  <SelectItem value={device.deviceId} key={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              {props.type == "mic" &&
                contentState.audioInput.map((device) => (
                  <SelectItem value={device.deviceId} key={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
            </Select.Group>
          </Select.Viewport>
          <Select.ScrollDownButton className="SelectScrollButton"></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

const SelectItem = React.forwardRef(
  ({ children, className, ...props }, forwardedRef) => {
    return (
      <Select.Item className="SelectItem" {...props} ref={forwardedRef}>
        <Select.ItemText>{children}</Select.ItemText>
        <Select.ItemIndicator className="SelectItemIndicator">
          <img src={CheckWhiteIcon} />
        </Select.ItemIndicator>
      </Select.Item>
    );
  }
);

export default Dropdown;
