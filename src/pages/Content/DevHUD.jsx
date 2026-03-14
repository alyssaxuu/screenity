import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const Z = 2147483647;

const BTN = {
  padding: "4px 8px",
  fontSize: "11px",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "monospace",
  lineHeight: "1.4",
  boxSizing: "border-box",
};

const DevHUD = ({ contentStateRef, setContentState }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [portalEl, setPortalEl] = useState(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "screenity-dev-hud-portal";
    // Make the container itself invisible/non-interfering but ensure its
    // children (position:fixed) are not clipped by host-page CSS.
    el.style.cssText = [
      "position:fixed !important",
      "top:0 !important",
      "left:0 !important",
      "width:0 !important",
      "height:0 !important",
      "overflow:visible !important",
      "pointer-events:none !important",
      `z-index:${Z} !important`,
      "display:block !important",
      "visibility:visible !important",
      "opacity:1 !important",
    ].join(";");
    document.documentElement.appendChild(el);
    setPortalEl(el);
    return () => el.remove();
  }, []);

  const toast = (msg, ms = 8000) => {
    contentStateRef.current?.openToast?.(msg, () => {}, ms);
  };

  const actions = [
    {
      label: "Stream error modal",
      fn: () => {
        const s = contentStateRef.current;
        s?.openModal?.(
          chrome.i18n.getMessage("streamErrorModalTitle"),
          chrome.i18n.getMessage("streamErrorModalDescription"),
          chrome.i18n.getMessage("permissionsModalDismiss"),
          null,
          () => {},
          () => {},
          null,
          null,
          null,
          false,
          chrome.i18n.getMessage("getHelpButton"),
          () => {
            chrome.runtime.sendMessage({
              type: "report-error",
              errorCode: "DEBUG_TEST",
              source: "stream-error",
            });
          },
        );
      },
    },
    {
      label: "Low storage warning",
      fn: () => toast(chrome.i18n.getMessage("toastStorageLow")),
    },
    {
      label: "Low storage critical",
      fn: () => toast(chrome.i18n.getMessage("toastStorageCritical")),
    },
    {
      label: "Stream ended toast",
      fn: () => toast(chrome.i18n.getMessage("streamEndedWarningToast"), 10000),
    },
    {
      label: "Video track ended",
      fn: () => toast(chrome.i18n.getMessage("videoTrackEndedToast")),
    },
    {
      label: "Audio track ended",
      fn: () => toast(chrome.i18n.getMessage("audioTrackEndedToast")),
    },
    {
      label: "Stop-ack timeout",
      fn: () => toast(chrome.i18n.getMessage("stopAckTimeoutToast")),
    },
    {
      label: "Editor recovery",
      fn: () => toast(chrome.i18n.getMessage("editorRecoveryToast"), 12000),
    },
    {
      label: "Memory limit modal",
      fn: () => {
        const s = contentStateRef.current;
        s?.openModal?.(
          chrome.i18n.getMessage("memoryLimitTitle"),
          chrome.i18n.getMessage("memoryLimitDescription"),
          chrome.i18n.getMessage("understoodButton"),
          null,
          () => {},
          () => {}
        );
      },
    },
    {
      label: "Preparing overlay",
      fn: () => {
        setContentState?.((p) => ({
          ...p,
          preparingRecording: true,
          processingProgress: 42,
        }));
      },
    },
  ];

  if (!portalEl) return null;

  // Shared wrapper style — lives inside the zero-size fixed container,
  // so it needs its own position:fixed to escape.
  const wrapBase = {
    position: "fixed",
    bottom: 6,
    right: 6,
    zIndex: Z,
    pointerEvents: "auto",
    fontFamily: "monospace",
    boxSizing: "border-box",
  };

  const ui = collapsed ? (
    <div
      onClick={() => setCollapsed(false)}
      style={{
        ...wrapBase,
        background: "rgba(0,0,0,0.65)",
        color: "#0f0",
        fontSize: "10px",
        padding: "3px 7px",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      DEV
    </div>
  ) : (
    <div
      style={{
        ...wrapBase,
        background: "rgba(20,20,20,0.9)",
        borderRadius: "6px",
        padding: "8px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        maxWidth: "170px",
        maxHeight: "80vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2px",
        }}
      >
        <span style={{ color: "#0f0", fontSize: "10px" }}>DEV HUD</span>
        <span
          onClick={() => setCollapsed(true)}
          style={{ color: "#888", fontSize: "12px", cursor: "pointer" }}
        >
          x
        </span>
      </div>
      {actions.map((a) => (
        <button key={a.label} style={BTN} onClick={a.fn}>
          {a.label}
        </button>
      ))}
    </div>
  );

  return createPortal(ui, portalEl);
};

export default DevHUD;
