// Work in progress - settings for the recording

import React, { useState, useContext, useRef, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { MoreIconPopup } from "../../toolbar/components/SVG";

import TooltipWrap from "../components/TooltipWrap";

import { CheckWhiteIcon, DropdownGroup } from "../../images/popup/images";

import JSZip from "jszip";

// Context
import { contentStateContext } from "../../context/ContentState";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

const SettingsMenu = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [restore, setRestore] = useState(false);
  const [oldChrome, setOldChrome] = useState(false);
  const [openQuality, setOpenQuality] = useState(false);
  const [openResize, setOpenResize] = useState(false);
  const [openFPS, setOpenFPS] = useState(false);
  const [RAM, setRAM] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // Check chrome version
    const chromeVersion = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
    const MIN_CHROME_VERSION = 110;

    if (chromeVersion && parseInt(chromeVersion[2], 10) < MIN_CHROME_VERSION) {
      setOldChrome(true);
    }
  }, []);

  const handleTroubleshooting = () => {
    if (typeof contentState.openModal === "function") {
      contentState.openModal(
        chrome.i18n.getMessage("troubleshootModalTitle"),
        chrome.i18n.getMessage("troubleshootModalDescription"),
        chrome.i18n.getMessage("troubleshootModalButton"),
        chrome.i18n.getMessage("sandboxEditorCancelButton"),
        () => {
          const userAgent = navigator.userAgent;
          let platformInfo = {};
          chrome.runtime
            .sendMessage({ type: "get-platform-info" })
            .then((response) => {
              platformInfo = response;
              const manifestInfo = chrome.runtime.getManifest().version;

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

  useEffect(() => {
    // More accurate screen detection
    const w = window.screen.availWidth * window.devicePixelRatio;
    const h = window.screen.availHeight * window.devicePixelRatio;
    setWidth(Math.round(w));
    setHeight(Math.round(h));

    // Fix RAM detection on macOS
    const isMac = navigator.userAgent.includes("Macintosh");
    const ram = isMac ? 32 : Number(navigator.deviceMemory) || 4;
    setRAM(ram);
  }, []);

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
          {!contentState.isSubscribed && !contentState.isLoggedIn && (
            <DropdownMenu.Sub
              open={openResize}
              onOpenChange={(open) => {
                if (open) {
                  setOpenFPS(false);
                  setOpenQuality(false);
                }
                setOpenResize(open);
              }}
            >
              <DropdownMenu.SubTrigger className="DropdownMenuItem">
                {chrome.i18n.getMessage("resizeWindowLabel")}
                <div className="ItemIndicatorArrow">
                  <img src={DropdownGroup} />
                </div>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className="ScreenityDropdownMenuContent"
                  sideOffset={0}
                  alignOffset={-3}
                >
                  <TooltipWrap
                    content={
                      width < 3840 || height < 2160
                        ? chrome.i18n.getMessage("screenTooSmallTooltip")
                        : ""
                    }
                  >
                    <DropdownMenu.Item
                      className="ScreenityDropdownMenuItem"
                      onClick={(e) => {
                        chrome.runtime.sendMessage({
                          type: "resize-window",
                          width: 3840,
                          height: 2160,
                        });
                      }}
                      disabled={width < 3840 || height < 2160}
                    >
                      3840 x 2160 (4k)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      width < 1920 || height < 1080
                        ? chrome.i18n.getMessage("screenTooSmallTooltip")
                        : ""
                    }
                  >
                    <DropdownMenu.Item
                      className="ScreenityDropdownMenuItem"
                      onClick={(e) => {
                        chrome.runtime.sendMessage({
                          type: "resize-window",
                          width: 1920,
                          height: 1080,
                        });
                      }}
                      disabled={width < 1920 || height < 1080}
                    >
                      1920 x 1080 (1080p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      width < 1280 || height < 720
                        ? chrome.i18n.getMessage("screenTooSmallTooltip")
                        : ""
                    }
                  >
                    <DropdownMenu.Item
                      className="ScreenityDropdownMenuItem"
                      onClick={(e) => {
                        chrome.runtime.sendMessage({
                          type: "resize-window",
                          width: 1280,
                          height: 720,
                        });
                      }}
                      disabled={width < 1280 || height < 720}
                    >
                      1280 x 720 (720p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      width < 640 || height < 480
                        ? chrome.i18n.getMessage("screenTooSmallTooltip")
                        : ""
                    }
                  >
                    <DropdownMenu.Item
                      className="ScreenityDropdownMenuItem"
                      onClick={(e) => {
                        chrome.runtime.sendMessage({
                          type: "resize-window",
                          width: 640,
                          height: 480,
                        });
                      }}
                      disabled={width < 640 || height < 480}
                    >
                      640 x 480 (480p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      width < 480 || height < 360
                        ? chrome.i18n.getMessage("screenTooSmallTooltip")
                        : ""
                    }
                  >
                    <DropdownMenu.Item
                      className="ScreenityDropdownMenuItem"
                      onClick={(e) => {
                        chrome.runtime.sendMessage({
                          type: "resize-window",
                          width: 480,
                          height: 360,
                        });
                      }}
                      disabled={width < 480 || height < 360}
                    >
                      480 x 360 (360p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      width < 320 || height < 240
                        ? chrome.i18n.getMessage("screenTooSmallTooltip")
                        : ""
                    }
                  >
                    <DropdownMenu.Item
                      className="ScreenityDropdownMenuItem"
                      onClick={(e) => {
                        chrome.runtime.sendMessage({
                          type: "resize-window",
                          width: 320,
                          height: 240,
                        });
                      }}
                      disabled={width < 320 || height < 240}
                    >
                      320 x 240 (240p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}
          {!contentState.isSubscribed && !contentState.isLoggedIn && (
            <DropdownMenu.Sub
              open={openQuality}
              onOpenChange={(open) => {
                if (open) {
                  setOpenFPS(false);
                  setOpenResize(false);
                }
                setOpenQuality(open);
              }}
            >
              <DropdownMenu.SubTrigger className="DropdownMenuItem">
                {chrome.i18n.getMessage("maxResolutionLabel") +
                  " (" +
                  contentState.qualityValue +
                  ")"}
                <div className="ItemIndicatorArrow">
                  <img src={DropdownGroup} />
                </div>
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  className="ScreenityDropdownMenuContent"
                  sideOffset={0}
                  alignOffset={-3}
                >
                  <DropdownMenu.RadioGroup
                    value={contentState.qualityValue}
                    onValueChange={(value) => {
                      setContentState((prevContentState) => ({
                        ...prevContentState,
                        qualityValue: value,
                      }));
                      chrome.storage.local.set({
                        qualityValue: value,
                      });
                    }}
                  >
                    <TooltipWrap
                      content={
                        RAM < 8 || width < 3840 || height < 2160
                          ? chrome.i18n.getMessage("maxResolutionTooltip")
                          : ""
                      }
                    >
                      <DropdownMenu.RadioItem
                        className="ScreenityDropdownMenuItem"
                        value="4k"
                        disabled={RAM < 8 || width < 3840 || height < 2160}
                      >
                        4k
                        <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                          <img src={CheckWhiteIcon} />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    </TooltipWrap>
                    <TooltipWrap
                      content={
                        RAM < 4 || width < 1920 || height < 1080
                          ? chrome.i18n.getMessage("maxResolutionTooltip")
                          : ""
                      }
                    >
                      <DropdownMenu.RadioItem
                        className="ScreenityDropdownMenuItem"
                        value="1080p"
                        disabled={RAM < 4 || width < 1920 || height < 1080}
                      >
                        1080p
                        <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                          <img src={CheckWhiteIcon} />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    </TooltipWrap>
                    <TooltipWrap
                      content={
                        RAM < 2 || width < 1280 || height < 720
                          ? chrome.i18n.getMessage("maxResolutionTooltip")
                          : ""
                      }
                    >
                      <DropdownMenu.RadioItem
                        className="ScreenityDropdownMenuItem"
                        value="720p"
                        disabled={RAM < 2 || width < 1280 || height < 720}
                      >
                        720p
                        <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                          <img src={CheckWhiteIcon} />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    </TooltipWrap>
                    <DropdownMenu.RadioItem
                      className="ScreenityDropdownMenuItem"
                      value="480p"
                    >
                      480p
                      <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                        <img src={CheckWhiteIcon} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                    <DropdownMenu.RadioItem
                      className="ScreenityDropdownMenuItem"
                      value="360p"
                    >
                      360p
                      <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                        <img src={CheckWhiteIcon} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                    <DropdownMenu.RadioItem
                      className="ScreenityDropdownMenuItem"
                      value="240p"
                    >
                      240p
                      <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                        <img src={CheckWhiteIcon} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}
          {/*
          <DropdownMenu.Sub
            open={openFPS}
            onOpenChange={(open) => {
              if (open) {
                setOpenQuality(false);
              }
              setOpenFPS(open);
            }}
          >
            <DropdownMenu.SubTrigger className="DropdownMenuItem">
              {chrome.i18n.getMessage("maxFPSLabel") +
                " (" +
                contentState.fpsValue +
                ")"}
              <div className="ItemIndicatorArrow">
                <img src={DropdownGroup} />
              </div>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="ScreenityDropdownMenuContent"
                sideOffset={0}
                alignOffset={-3}
              >
                <DropdownMenu.RadioGroup
                  value={contentState.fpsValue}
                  onValueChange={(value) => {
                    setContentState((prevContentState) => ({
                      ...prevContentState,
                      fpsValue: value,
                    }));
                    chrome.storage.local.set({
                      fpsValue: value,
                    });
                  }}
                >
                  <DropdownMenu.RadioItem
                    className="ScreenityDropdownMenuItem"
                    value="60"
                  >
                    60
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem
                    className="ScreenityDropdownMenuItem"
                    value="30"
                  >
                    30
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem
                    className="ScreenityDropdownMenuItem"
                    value="24"
                  >
                    24
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem
                    className="ScreenityDropdownMenuItem"
                    value="10"
                  >
                    10
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem
                    className="ScreenityDropdownMenuItem"
                    value="5"
                  >
                    5
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                  <DropdownMenu.RadioItem
                    className="ScreenityDropdownMenuItem"
                    value="1"
                  >
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                    1
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
					*/}
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
          {!oldChrome &&
            !contentState.isSubscribed &&
            !contentState.isLoggedIn && (
              <DropdownMenu.CheckboxItem
                className="DropdownMenuItem"
                onSelect={(e) => {
                  e.preventDefault();
                }}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    chrome.runtime.sendMessage({ type: "close-backup-tab" });
                  }
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    backup: checked,
                    backupSetup: false,
                  }));
                  chrome.storage.local.set({
                    backup: checked,
                    backupSetup: false,
                  });
                }}
                checked={contentState.backup}
              >
                {chrome.i18n.getMessage("backupsToggle")}
                <DropdownMenu.ItemIndicator className="ItemIndicator">
                  <img src={CheckWhiteIcon} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.CheckboxItem>
            )}
          {!contentState.isSubscribed && !contentState.isLoggedIn && (
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
          )}
          {!contentState.isSubscribed && !contentState.isLoggedIn && (
            <DropdownMenu.Item
              className="DropdownMenuItem"
              onSelect={(e) => {
                e.preventDefault();
                handleTroubleshooting();
              }}
            >
              {chrome.i18n.getMessage("downloadForTroubleshootingOption")}
            </DropdownMenu.Item>
          )}

          {contentState.isLoggedIn && !CLOUD_FEATURES_ENABLED && (
            <DropdownMenu.Item
              className="DropdownMenuItem"
              onSelect={(e) => {
                e.preventDefault();
                chrome.runtime.sendMessage({ type: "open-account-settings" });
              }}
            >
              {chrome.i18n.getMessage("accountSettingsOption")}
            </DropdownMenu.Item>
          )}
          {contentState.isLoggedIn && !CLOUD_FEATURES_ENABLED && (
            <DropdownMenu.Item
              className="DropdownMenuItem"
              onSelect={(e) => {
                e.preventDefault();
                chrome.runtime.sendMessage({
                  type: "open-support",
                  name: contentState.screenityUser?.name || "",
                  email: contentState.screenityUser?.email || "",
                });
              }}
            >
              {chrome.i18n.getMessage("supportSettingsOption")}
            </DropdownMenu.Item>
          )}
          {CLOUD_FEATURES_ENABLED && (
            <DropdownMenu.Item
              className="DropdownMenuItem"
              onSelect={(e) => {
                e.preventDefault();
                if (contentState.isLoggedIn) {
                  // Log out flow
                  chrome.runtime.sendMessage({ type: "handle-logout" });
                  setContentState((prev) => ({
                    ...prev,
                    isLoggedIn: false,
                    isSubscribed: false,
                    screenityUser: null,
                    proSubscription: null,
                  }));
                  contentState.openToast(
                    chrome.i18n.getMessage("loggedOutToastTitle"),
                    () => {},
                    2000
                  );
                } else {
                  // Log in flow (open login page)
                  chrome.runtime.sendMessage({ type: "handle-login" });
                }
                props.setOpen(false); // Close the menu after action
              }}
            >
              {contentState.isLoggedIn
                ? chrome.i18n.getMessage("logoutButtonLabel") || "Log out"
                : chrome.i18n.getMessage("loginButtonLabel") ||
                  "Log in or sign up"}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default SettingsMenu;
