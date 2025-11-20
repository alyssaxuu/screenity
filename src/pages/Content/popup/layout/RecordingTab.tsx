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
  CheckWhiteIcon,
  CloseWhiteIcon,
} from "../../images/popup/images";

import { BaseSwitch } from "../components/Switch";
import TooltipWrap from "../components/TooltipWrap";

// Context
import { contentStateContext } from "../../context/ContentState";

const RecordingTab = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  const [tabRecordingDisabled, setTabRecordingDisabled] = useState(false);
  const [showModalSoon, setShowModalSoon] = useState(false); // 👈 NEW

  useEffect(() => {
    if (tabRecordingDisabled && contentState.recordingType === "region") {
      setContentState((prev) => ({
        ...prev,
        recordingType: "screen",
      }));
      chrome.storage.local.set({ recordingType: "screen" });

      contentState.openToast?.(
        chrome.i18n.getMessage("tabRecordingDisabledToast"),
        4000
      );
    }
  }, [tabRecordingDisabled]);

  useEffect(() => {
    const currentUrl = window.location.href;
    const isBlocked = currentUrl.includes(process.env.SCREENITY_APP_BASE);

    setTabRecordingDisabled(isBlocked);

    if (isBlocked && contentState.recordingType === "region") {
      setContentState((prev) => ({
        ...prev,
        recordingType: "screen",
      }));
      chrome.storage.local.set({ recordingType: "screen" });

      contentState.openToast?.(
        chrome.i18n.getMessage("tabRecordingDisabledToast"),
        4000
      );
    }
  }, [contentState.recordingType]);

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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowModalSoon(false);
    };
    if (showModalSoon) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModalSoon]);

  return (
    <div className="recording-ui">
      <Tabs.Root
        className="TabsRoot"
        defaultValue="screen"
        onValueChange={onValueChange}
        value={contentState.recordingType}
      >
        {contentState.recordingToScene && (
          <div className="projectActiveBanner">
            <div className="projectActiveBannerLeft">
              {chrome.i18n.getMessage("addingToLabel") || "Adding to: "}
              {contentState.recordingProjectTitle}
            </div>
            {(!contentState.multiMode ||
              contentState.multiSceneCount === 0) && (
              <div className="projectActiveBannerRight">
                <div className="projectActiveBannerDivider"></div>
                <div
                  className="projectActiveBannerClose"
                  onClick={() => {
                    setContentState((prev) => ({
                      ...prev,
                      projectTitle: "",
                      projectId: null,
                      activeSceneId: null,
                      recordingToScene: false,
                      multiMode: false,
                      multiSceneCount: 0,
                      multiProjectId: null,
                    }));

                    // also in chrome local storage
                    chrome.storage.local.set({
                      recordingProjectTitle: "",
                      projectId: null,
                      activeSceneId: null,
                      recordingToScene: false,
                      multiMode: false,
                      multiProjectId: null,
                    });

                    // show toast
                    contentState.openToast(
                      chrome.i18n.getMessage("projectRecordingCancelledToast"),
                      3000
                    );
                  }}
                >
                  <img src={CloseWhiteIcon} alt="Close" />
                </div>
              </div>
            )}
          </div>
        )}
        <Tabs.List
          className={"TabsList"}
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
          <TooltipWrap
            content={
              tabRecordingDisabled
                ? chrome.i18n.getMessage("tabRecordingDisabledTooltip") ||
                  "Tab recording is disabled on this page."
                : ""
            }
            side={"bottom"}
          >
            <Tabs.Trigger
              className="TabsTrigger"
              value="region"
              tabIndex={0}
              disabled={tabRecordingDisabled}
              onClick={(e) => {
                if (tabRecordingDisabled) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              style={
                tabRecordingDisabled
                  ? { cursor: "not-allowed", opacity: 0.5 }
                  : {}
              }
            >
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
          </TooltipWrap>
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
          <div className="TabsTriggerSpacer"></div>
          <div className="TabsTrigger">
            <TooltipWrap
              content={
                !contentState.isLoggedIn
                  ? "Record multiple scenes with Screenity Pro"
                  : "Record scenes one after another"
              }
              side={"bottom"}
            >
              <div
                className="TabsTriggerLabel"
                style={{
                  opacity: contentState.isLoggedIn ? 1 : 0.5,

                  cursor: contentState.isLoggedIn ? "pointer" : "not-allowed",
                }}
                onClick={() => {
                  // If not logged in, show the modal instead of toggling
                  if (!contentState.isLoggedIn) {
                    setShowModalSoon(true);
                  }
                }}
              >
                <div
                  className="TabsTriggerIcon"
                  style={{
                    width: "33px",
                    position: "relative", // For the badge positioning
                    pointerEvents: contentState.isLoggedIn ? "auto" : "none",
                  }}
                >
                  {contentState.multiMode &&
                  contentState.multiSceneCount > 0 ? (
                    <div
                      className="FinishButton"
                      onClick={() => {
                        // Send finish message to background to finalize multi project
                        chrome.runtime.sendMessage({
                          type: "finish-multi-recording",
                        });
                        setContentState((prev) => ({
                          ...prev,
                          showExtension: false,
                          hasOpenedBefore: true,
                          showPopup: false,
                        }));
                      }}
                      style={{
                        cursor: "pointer",
                        width: "28px",
                        height: "28px",
                        background: "#3080F8",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={CheckWhiteIcon}
                        alt="Finish"
                        style={{ width: "13px", height: "13px" }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "-7px",
                          left: "-7px",
                          background: "#78C072",
                          color: "white",
                          fontSize: "12px",
                          fontWeight: "bold",
                          borderRadius: "50%",
                          width: "18px",
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {contentState.multiSceneCount}
                      </div>
                    </div>
                  ) : (
                    <BaseSwitch
                      label={"Multi recording"}
                      name="multiRecording"
                      value="multiMode"
                      checked={contentState.multiMode}
                      onChange={(checked) => {
                        setContentState((prevContentState) => ({
                          ...prevContentState,
                          multiMode: checked,
                        }));
                        chrome.storage.local.set({ multiMode: checked });

                        if (checked) {
                          chrome.storage.local
                            .get(["hasSeenMultiRecordingInfo"])
                            .then((res) => {
                              if (!res.hasSeenMultiRecordingInfo) {
                                contentState.openModal(
                                  chrome.i18n.getMessage(
                                    "multiRecordingModeTitle"
                                  ) || "Multi-recording mode",
                                  chrome.i18n.getMessage(
                                    "multiRecordingModeDescription"
                                  ) ||
                                    "Record multiple scenes, like your screen, camera, or both, one after another. This is great for doing multiple takes, switching views, or breaking your recording into parts. When you’re done, click Finish to open the editor with all your scenes combined in one project.",
                                  "Got it",
                                  chrome.i18n.getMessage(
                                    "permissionsModalDismiss"
                                  ) || "Dismiss",
                                  () => {},
                                  () => {},
                                  null,
                                  "",
                                  "",
                                  true,
                                  false
                                );

                                // Mark as seen
                                chrome.storage.local.set({
                                  hasSeenMultiRecordingInfo: true,
                                });
                              }
                            });
                          chrome.storage.local.set({ instantMode: false });
                          setContentState((prevContentState) => ({
                            ...prevContentState,
                            instantMode: false,
                          }));
                        }
                      }}
                    />
                  )}
                </div>
                <span>
                  {contentState.multiMode && contentState.multiSceneCount > 0
                    ? chrome.i18n.getMessage("finishLabelMulti") || "Finish"
                    : chrome.i18n.getMessage("multiLabel") || "Multi"}
                </span>
              </div>
            </TooltipWrap>
          </div>
          {/* <Tabs.Trigger
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
          </Tabs.Trigger> */}
        </Tabs.List>

        {showModalSoon && (
          <div
            className="ModalSoon strong"
            style={{
              zIndex: 999999999999,
            }}
          >
            <button
              aria-label="Close"
              onClick={() => setShowModalSoon(false)}
              style={{
                position: "absolute",
                top: -10,
                right: -10,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgb(252 252 252)",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                cursor: "pointer",
              }}
            >
              <img
                src={CloseWhiteIcon}
                alt=""
                style={{ width: 14, height: 14, filter: "invert(0.4)" }}
              />
            </button>
            {/* 👇 Embed the video here */}
            <video
              src={chrome.runtime.getURL("assets/videos/pro.mp4")}
              autoPlay
              loop
              muted
              playsInline
              style={{
                width: "100%",
                borderRadius: "6px",
                marginBottom: "20px",
              }}
            />
            <div className="ModalSoonTitle">
              {chrome.i18n.getMessage("shareModalSandboxTitle")}
            </div>

            <div className="ModalSoonDescription">
              {chrome.i18n.getMessage("shareModalSandboxDescription")}
            </div>

            <div
              className="ModalSoonButton"
              onClick={() => {
                chrome.runtime.sendMessage({ type: "pricing" });
              }}
            >
              {chrome.i18n.getMessage("shareModalSandboxButton")}
            </div>

            <button
              onClick={() => {
                chrome.runtime.sendMessage({ type: "handle-login" });
              }}
              className="ModalSoonSecondary"
              style={{
                marginTop: 16,
                width: "100%",
                background: "transparent",
                border: "none",
                color: "#6B7280",
                fontSize: 13,
                textAlign: "center",
                cursor: "pointer",
              }}
            >
              {chrome.i18n.getMessage("shareModalSandboxLogin")}
            </button>
          </div>
        )}
        <Tabs.Content className="TabsContent" value="screen">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="region">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="camera">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default RecordingTab;
