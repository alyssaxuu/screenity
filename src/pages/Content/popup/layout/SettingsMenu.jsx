// Work in progress - settings for the recording

import React, { useState, useContext, useRef, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { MoreIconPopup } from "../../toolbar/components/SVG";

import TooltipWrap from "../components/TooltipWrap";

import { CheckWhiteIcon, DropdownGroup } from "../../images/popup/images";

import { buildDiagnosticZip } from "../../../utils/buildDiagnosticZip";
import { physicalScreenSize, screenFits } from "../../../utils/physicalScreenSize";

// Context
import { contentStateContext } from "../../context/ContentState";
import {
  probeFastRecorderSupport,
  shouldUseFastRecorder,
  resolveFastRecorderUserSetting,
  getFastRecorderStickyState,
} from "../../../../media/fastRecorderGate";
import { resetOnboardingSeen } from "../onboarding/storage";
import { runProPopupOnboardingIfNeeded } from "../onboarding/proOnboarding";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
const DEV_MODE = process.env.SCREENITY_DEV_MODE === "true";

// Inline: the portal's inherited stylesheet varies.
const QUALITY_LABEL_STYLE = {
  padding: "10px 22px 4px",
  fontSize: 12,
  lineHeight: 1,
  letterSpacing: "0.02em",
  color: "#6e7684",
  userSelect: "none",
};
const QUALITY_SEPARATOR_STYLE = {
  height: 1,
  backgroundColor: "#ececf1",
  margin: "6px 22px",
};

const FPS_OPTIONS = ["60", "30", "24", "15", "10", "5"];

const SettingsMenu = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const [restore, setRestore] = useState(false);
  const [cloudRestore, setCloudRestore] = useState(false);
  const [openQuality, setOpenQuality] = useState(false);
  const [openResize, setOpenResize] = useState(false);
  const [RAM, setRAM] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [fastRecorderInfo, setFastRecorderInfo] = useState({
    status: null,
    probe: null,
    decision: null,
    disabled: false,
    disabledReason: null,
    disabledDetails: null,
    disabledAt: null,
  });

  const handleTroubleshooting = () => {
    if (typeof contentState.openModal === "function") {
      contentState.openModal(
        chrome.i18n.getMessage("troubleshootModalTitle"),
        chrome.i18n.getMessage("troubleshootModalDescription"),
        chrome.i18n.getMessage("troubleshootModalButton"),
        chrome.i18n.getMessage("sandboxEditorCancelButton"),
        async () => {
          try {
            const { blob, filename } = await buildDiagnosticZip({
              source: "popup-settings",
              extraConfig: {
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
              },
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          } catch (err) {
            console.error("[Screenity] Troubleshooting export failed:", err);
          }
        },
        () => {},
      );
    }
  };

  useEffect(() => {
    // Full display, not avail*: the menu bar/taskbar cut would hide 4K on a native 4K monitor.
    const { width: w, height: h } = physicalScreenSize(
      window.screen,
      window.devicePixelRatio
    );
    setWidth(w);
    setHeight(h);

    // Fix RAM detection on macOS
    const isMac = navigator.userAgent.includes("Macintosh");
    const ram = isMac ? 32 : Number(navigator.deviceMemory) || 4;
    setRAM(ram);
  }, []);

  const getFastRecDebug = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("fastRecDebug") === "1";
    } catch {
      return false;
    }
  };

  // A probe from before the ladder-v2 gate has no supports4k; count it stale.
  const hasLadderFields = (probe) => {
    if (!probe || !probe.details) return false;
    return (
      Array.isArray(probe.details.attemptSummary) &&
      probe.details.attemptSummary.length > 0 &&
      Boolean(probe.details.selectedVideoConfig) &&
      typeof probe.details.supports4k === "boolean"
    );
  };

  const runFastRecorderProbe = async (source = "auto") => {
    if (!contentState) return;
    const userSetting = resolveFastRecorderUserSetting(
      contentState.useWebCodecsRecorder,
    );
    const sticky = await getFastRecorderStickyState();
    const probe = await probeFastRecorderSupport();
    const useFast = shouldUseFastRecorder(userSetting, probe, sticky);
    const decision = {
      useFast,
      why:
        userSetting === false
          ? "user_disabled"
          : sticky?.disabled && userSetting !== true
          ? "sticky_disabled"
          : probe.ok
          ? "probe_ok"
          : "probe_failed",
      at: Date.now(),
    };
    const status = {
      userSetting,
      probe: { ...probe, at: probe.at || Date.now() },
        decision,
        disabled: Boolean(sticky?.disabled),
        disabledReason: sticky?.reason || null,
        disabledDetails: sticky?.details || null,
        disabledAt: null,
        updatedAt: Date.now(),
      };
    try {
      await chrome.storage.local.set({ fastRecorderStatus: status });
    } catch {}
    setFastRecorderInfo({
      status,
      probe: status.probe,
      decision,
      disabled: status.disabled,
      disabledReason: status.disabledReason,
      disabledDetails: status.disabledDetails,
      disabledAt: status.disabledAt,
    });
    if (getFastRecDebug()) {
      console.log("[FastRecorderStatus]", { source, status });
    }
    return status;
  };

  const migrateFastRecorderStatus = async () => {
    const existing = await chrome.storage.local.get(["fastRecorderStatus"]);
    if (existing.fastRecorderStatus) {
      const status = existing.fastRecorderStatus;
      if (!hasLadderFields(status?.probe)) {
        await runFastRecorderProbe("stale-status");
        const refreshed = await chrome.storage.local.get(["fastRecorderStatus"]);
        return refreshed.fastRecorderStatus || status;
      }
      return status;
    }
    const legacy = await chrome.storage.local.get([
      "fastRecorderBeta",
      "fastRecorderProbe",
      "fastRecorderDecision",
      "fastRecorderDisabledForDevice",
      "fastRecorderDisabledReason",
      "fastRecorderDisabledDetails",
      "fastRecorderDisabledAt",
    ]);
    const status = {
      userSetting:
        legacy.fastRecorderBeta === true
          ? true
          : legacy.fastRecorderBeta === false
          ? false
          : null,
      probe: legacy.fastRecorderProbe || null,
      decision: legacy.fastRecorderDecision || null,
      disabled: Boolean(legacy.fastRecorderDisabledForDevice),
      disabledReason: legacy.fastRecorderDisabledReason || null,
      disabledDetails: legacy.fastRecorderDisabledDetails || null,
      disabledAt: legacy.fastRecorderDisabledAt || null,
      updatedAt: Date.now(),
    };
    try {
      await chrome.storage.local.set({ fastRecorderStatus: status });
    } catch {}
    if (!hasLadderFields(status.probe)) {
      await runFastRecorderProbe("stale-legacy");
      const refreshed = await chrome.storage.local.get(["fastRecorderStatus"]);
      return refreshed.fastRecorderStatus || status;
    }
    return status;
  };

  useEffect(() => {
    let canceled = false;
    (async () => {
      const status = await migrateFastRecorderStatus();
      if (canceled) return;
      setFastRecorderInfo((prev) => ({
        ...prev,
        status,
        probe: status?.probe || null,
        decision: status?.decision || null,
        disabled: Boolean(status?.disabled),
        disabledReason: status?.disabledReason || null,
        disabledDetails: status?.disabledDetails || null,
        disabledAt: status?.disabledAt || null,
      }));
      const staleHours = 12;
      const probeAgeMs =
        status?.probe?.at && Number.isFinite(status.probe.at)
          ? Date.now() - status.probe.at
          : Infinity;
      const shouldRun =
        !status?.probe ||
        probeAgeMs > staleHours * 60 * 60 * 1000 ||
        !hasLadderFields(status?.probe);
      if (shouldRun) {
        await runFastRecorderProbe("effect");
      }
    })();
    return () => {
      canceled = true;
    };
  }, [contentState?.useWebCodecsRecorder]);

  // Unset reads as auto, matching resolveQualityValue/resolveFps.
  const qualityChoice = contentState.qualityValue ?? "auto";
  const fpsChoice = contentState.fpsValue ?? "auto";
  const qualityIsAuto = qualityChoice === "auto" && fpsChoice === "auto";

  const updateQuality = (patch) => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      ...patch,
    }));
    chrome.storage.local.set(patch);
  };

  // Offered on smaller screens too: 4k is a fit-inside box, never upscaled, and
  // the screen is only picked later in Chrome's share picker.
  const supports4k =
    fastRecorderInfo?.probe?.details?.supports4k === true && RAM >= 8;

  // A saved 4k stays visible and checked while the probe is unknown, and when
  // RAM now rules it out. Only a definite probe miss hides it: the recorder
  // drops that pick to 1080p, so 1080p shows as checked.
  const probeMissed4k = fastRecorderInfo?.probe?.details?.supports4k === false;
  const show4k = supports4k || (qualityChoice === "4k" && !probeMissed4k);
  const shownQuality =
    qualityChoice === "4k" && probeMissed4k ? "1080p" : qualityChoice;

  // When 4k is offered, lower rungs ignore the screen gate for the same reason.
  const fitsScreen = (w, h) => supports4k || screenFits({ width, height }, w, h);

  const qualityOptions = [
    ...(show4k ? [{ value: "4k", disabled: !supports4k }] : []),
    { value: "1080p", disabled: RAM < 4 || !fitsScreen(1920, 1080) },
    { value: "720p", disabled: RAM < 2 || !fitsScreen(1280, 720) },
    { value: "480p", disabled: false },
    { value: "360p", disabled: false },
    { value: "240p", disabled: false },
  ];

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

        if (CLOUD_FEATURES_ENABLED && contentState.isSubscribed) {
          chrome.runtime
            .sendMessage({ type: "check-cloud-restore" })
            .then((response) => {
              setCloudRestore(response?.cloudRestore ?? false);
            })
            .catch(() => setCloudRestore(false));
        }

        chrome.storage.local.get(["fastRecorderStatus"], (result) => {
          const status = result.fastRecorderStatus || null;
          setFastRecorderInfo((prev) => ({
            ...prev,
            status,
            probe: status?.probe || null,
            decision: status?.decision || null,
            disabled: Boolean(status?.disabled),
            disabledReason: status?.disabledReason || null,
            disabledDetails: status?.disabledDetails || null,
            disabledAt: status?.disabledAt || null,
          }));
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
                      !screenFits({ width, height }, 1920, 1080)
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
                      disabled={!screenFits({ width, height }, 1920, 1080)}
                    >
                      1920 x 1080 (1080p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      !screenFits({ width, height }, 1280, 720)
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
                      disabled={!screenFits({ width, height }, 1280, 720)}
                    >
                      1280 x 720 (720p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      !screenFits({ width, height }, 640, 480)
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
                      disabled={!screenFits({ width, height }, 640, 480)}
                    >
                      640 x 480 (480p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      !screenFits({ width, height }, 480, 360)
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
                      disabled={!screenFits({ width, height }, 480, 360)}
                    >
                      480 x 360 (360p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                  <TooltipWrap
                    content={
                      !screenFits({ width, height }, 320, 240)
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
                      disabled={!screenFits({ width, height }, 320, 240)}
                    >
                      320 x 240 (240p)
                    </DropdownMenu.Item>
                  </TooltipWrap>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}
          {!contentState.isSubscribed && (
            <DropdownMenu.Sub
              open={openQuality}
              onOpenChange={(open) => {
                if (open) {
                  setOpenResize(false);
                }
                setOpenQuality(open);
              }}
            >
              <DropdownMenu.SubTrigger className="DropdownMenuItem">
                {chrome.i18n.getMessage("qualityLabel") +
                  ": " +
                  chrome.i18n.getMessage(
                    qualityIsAuto ? "qualityAutoLabel" : "qualityCustomLabel"
                  )}
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
                    value={qualityIsAuto ? "auto" : ""}
                    onValueChange={() =>
                      updateQuality({
                        qualityValue: "auto",
                        fpsValue: "auto",
                      })
                    }
                  >
                    <DropdownMenu.RadioItem
                      className="ScreenityDropdownMenuItem"
                      value="auto"
                    >
                      {chrome.i18n.getMessage("qualityAutoLabel")}
                      <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                        <img src={CheckWhiteIcon} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                  </DropdownMenu.RadioGroup>
                  <DropdownMenu.CheckboxItem
                    className="ScreenityDropdownMenuItem"
                    disabled={fpsChoice !== "auto"}
                    onSelect={(e) => {
                      e.preventDefault();
                    }}
                    onCheckedChange={(checked) =>
                      updateQuality({ smootherMotion: checked })
                    }
                    checked={contentState.smootherMotion === true}
                  >
                    {chrome.i18n.getMessage("smootherMotionLabel")}
                    <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                      <img src={CheckWhiteIcon} />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.CheckboxItem>
                  <DropdownMenu.Separator style={QUALITY_SEPARATOR_STYLE} />
                  <DropdownMenu.Label style={QUALITY_LABEL_STYLE}>
                    {chrome.i18n.getMessage("resolutionGroupLabel")}
                  </DropdownMenu.Label>
                  <DropdownMenu.RadioGroup
                    value={shownQuality}
                    onValueChange={(value) =>
                      updateQuality({ qualityValue: value })
                    }
                  >
                    <DropdownMenu.RadioItem
                      className="ScreenityDropdownMenuItem"
                      value="auto"
                    >
                      {chrome.i18n.getMessage("qualityAutoLabel")}
                      <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                        <img src={CheckWhiteIcon} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                    {qualityOptions.map(({ value, disabled }) => (
                      <TooltipWrap
                        key={value}
                        content={
                          disabled
                            ? chrome.i18n.getMessage("maxResolutionTooltip")
                            : ""
                        }
                      >
                        <DropdownMenu.RadioItem
                          className="ScreenityDropdownMenuItem"
                          value={value}
                          disabled={disabled}
                        >
                          {value}
                          <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                            <img src={CheckWhiteIcon} />
                          </DropdownMenu.ItemIndicator>
                        </DropdownMenu.RadioItem>
                      </TooltipWrap>
                    ))}
                  </DropdownMenu.RadioGroup>
                  <DropdownMenu.Separator style={QUALITY_SEPARATOR_STYLE} />
                  <DropdownMenu.Label style={QUALITY_LABEL_STYLE}>
                    {chrome.i18n.getMessage("frameRateGroupLabel")}
                  </DropdownMenu.Label>
                  <DropdownMenu.RadioGroup
                    value={fpsChoice}
                    onValueChange={(value) =>
                      updateQuality({ fpsValue: value })
                    }
                  >
                    <DropdownMenu.RadioItem
                      className="ScreenityDropdownMenuItem"
                      value="auto"
                    >
                      {chrome.i18n.getMessage("qualityAutoLabel")}
                      <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                        <img src={CheckWhiteIcon} />
                      </DropdownMenu.ItemIndicator>
                    </DropdownMenu.RadioItem>
                    {FPS_OPTIONS.map((value) => (
                      <DropdownMenu.RadioItem
                        key={value}
                        className="ScreenityDropdownMenuItem"
                        value={value}
                      >
                        {value} fps
                        <DropdownMenu.ItemIndicator className="ScreenityItemIndicator">
                          <img src={CheckWhiteIcon} />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
          )}
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
          {!contentState.isSubscribed &&
            !contentState.isLoggedIn &&
            fastRecorderInfo?.probe?.ok === true &&
            fastRecorderInfo?.probe?.details?.selectedVideoConfig && (
              <DropdownMenu.CheckboxItem
                className="DropdownMenuItem"
                onSelect={(e) => {
                  e.preventDefault();
                }}
                onCheckedChange={(checked) => {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    useWebCodecsRecorder: checked,
                  }));
                  chrome.storage.local.set({
                    useWebCodecsRecorder: checked,
                    ...(checked
                      ? {
                          lastWebCodecsFailureAt: null,
                          lastWebCodecsFailureCode: null,
                        }
                      : {}),
                  });
                }}
                checked={contentState.useWebCodecsRecorder !== false}
              >
                {chrome.i18n.getMessage("webcodecsToggleLabel")}
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
          <DropdownMenu.Item
            className="DropdownMenuItem"
            onSelect={(e) => {
              e.preventDefault();
              handleTroubleshooting();
            }}
          >
            {chrome.i18n.getMessage("downloadForTroubleshootingOption")}
          </DropdownMenu.Item>

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
            <>
              {contentState.isLoggedIn && contentState.isSubscribed && (
                <DropdownMenu.Item
                  className="DropdownMenuItem"
                  onSelect={async (e) => {
                    e.preventDefault();
                    await resetOnboardingSeen(["proPopupCore", "proCameraInfo"]);
                    props.setOpen(false);
                    runProPopupOnboardingIfNeeded({
                      rootContext: props.shadowRef?.current?.shadowRoot || document,
                      isPro: Boolean(
                        contentState.isLoggedIn && contentState.isSubscribed
                      ),
                      isLoggedIn: Boolean(contentState.isLoggedIn),
                      popupOpen: Boolean(
                        contentState.showPopup && contentState.showExtension
                      ),
                      cameraEnabled: Boolean(contentState.cameraActive),
                      pendingRecording: Boolean(contentState.pendingRecording),
                      preparingRecording: Boolean(contentState.preparingRecording),
                      recording: Boolean(contentState.recording),
                      countdownActive: Boolean(contentState.countdownActive),
                      isCountdownVisible: Boolean(contentState.isCountdownVisible),
                      forceStart: true,
                    });
                  }}
                >
                  {chrome.i18n.getMessage("resetOnboardingOption") ||
                    "Reset onboarding"}
                </DropdownMenu.Item>
              )}
              {contentState.isLoggedIn && contentState.isSubscribed && (
                <DropdownMenu.Item
                  className="DropdownMenuItem"
                  onSelect={(e) => {
                    e.preventDefault();
                    chrome.runtime.sendMessage({
                      type: "restore-cloud-recording",
                    });
                  }}
                  disabled={!cloudRestore}
                >
                  {chrome.i18n.getMessage("recoverLastRecordingOption")}
                </DropdownMenu.Item>
              )}
            </>
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
                    wasLoggedIn: true,
                    isSubscribed: false,
                    screenityUser: null,
                    proSubscription: null,
                    bigTab: "record",
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
