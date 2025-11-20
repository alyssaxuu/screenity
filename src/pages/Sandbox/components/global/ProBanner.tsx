import React, { useContext, useState } from "react";
// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

const ProBanner = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context

  const titleKey = CLOUD_FEATURES_ENABLED
    ? "proBannerTitle"
    : "hostBannerTitle";

  const descriptionKey = CLOUD_FEATURES_ENABLED
    ? "proBannerDescription"
    : "hostBannerDescription";

  return (
    <div className="pro-banner">
      <div className="pro-banner-content">
        <div className="pro-banner-left">
          <video
            src={chrome.runtime.getURL("assets/videos/pro.mp4")}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: "100%" }}
          />
        </div>
        <div className="pro-banner-right">
          <div className="pro-banner-title">
            {chrome.i18n.getMessage(titleKey) ||
              "Unlock cloud sharing, multi-scene editing, auto zooms, captions & more"}
          </div>
          <div className="pro-banner-description">
            {chrome.i18n.getMessage(descriptionKey) ||
              "Screenity will always be free, open-source, and ad-free. Pro helps cover cloud & infra costs, & supports development by a solo indie dev! ❤️"}
          </div>
        </div>
      </div>
      <div className="pro-banner-cta">
        <button
          className="button altButton"
          onClick={() => {
            setContentState((prevContentState) => ({
              ...prevContentState,
              bannerSupport: false,
            }));
            chrome.runtime.sendMessage({ type: "hide-banner" });
          }}
        >
          {chrome.i18n.getMessage("proBannerAltButton") || "Don't show again"}
        </button>
        <button
          className="button primaryDarkButton"
          onClick={() => {
            setContentState((prevContentState) => ({
              ...prevContentState,
              bannerSupport: false,
            }));
            chrome.runtime.sendMessage({ type: "hide-banner" });
            chrome.runtime.sendMessage({ type: "pricing" });
          }}
        >
          {chrome.i18n.getMessage("proBannerButton") || "Try it"}
        </button>
      </div>
    </div>
  );
};

export default ProBanner;
