import React, { useEffect, useState } from "react";
import SoloDev from "../../../../assets/solo-dev.png";
// import EditorPreview from "../../../../assets/editor-preview.png"; // replace with actual screenshot file

const Welcome = (props) => {
  const isUpdated = props.isBack;
  const clearBack = props.clearBack;
  const [learntAboutPro, setLearntAboutPro] = useState(false);

  useEffect(() => {
    // if (isUpdated) {
    chrome.storage.local.get("learntAboutPro", (res) => {
      if (res.learntAboutPro) setLearntAboutPro(true);
    });
    // }
  }, []);

  return (
    <div
      className="announcement"
      style={{
        marginTop: "50px",
        paddingBottom: "0px",
      }}
    >
      <div className="announcement-wrap">
        <div className="announcement-details">
          <div className="welcome-title">
            {!isUpdated
              ? chrome.i18n.getMessage("welcomePopupTitle")
              : chrome.i18n.getMessage("welcomeBackPopupTitle")}
          </div>
          <div className="welcome-description">
            {chrome.i18n.getMessage("welcomePopupDescriptionTop")}
            <br />
            {chrome.i18n.getMessage("welcomePopupDescriptionBottom")}
          </div>
          <div
            className="welcome-cta"
            style={{
              marginBottom: "30px",
            }}
            onClick={() => {
              if (isUpdated) clearBack();
              props.setOnboarding(false);
              props.setContentState((prev) => ({
                ...prev,
                onboarding: false,
              }));
              chrome.storage.local.set({ onboarding: false });
            }}
          >
            👋 {chrome.i18n.getMessage("welcomePopupCTA")}
          </div>
        </div>
      </div>

      <div className="welcome-content">
        <div className="welcome-content-wrap">
          <div className="welcome-content-title">
            {!isUpdated
              ? chrome.i18n.getMessage("welcomeProTitle")
              : chrome.i18n.getMessage("welcomeBackProTitle") ||
                "Want to do more with your recordings?"}
          </div>

          <div className="welcome-video">
            <div
              className="video-wrapper"
              style={{
                overflow: "hidden",
                display: "inline-block",
                borderRadius: "10px",
              }}
            >
              <video
                src={chrome.runtime.getURL("assets/videos/pro.mp4")}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  display: "block",
                  width: "calc(100% + 2px)", // +1 left, +1 right
                  height: "calc(100% + 3px)", // +1 top, +2 bottom
                  transform: "translate(-1px, -1px)", // shift left + top
                }}
              />
            </div>
          </div>

          <p
            className="welcome-content-description"
            style={{
              color: "#6E7684",
              textAlign: "center",
            }}
          >
            {learntAboutPro
              ? chrome.i18n.getMessage("welcomeProDescription") ||
                "Sign in to save your videos to the cloud, share with a link, and access advanced editing features."
              : chrome.i18n.getMessage("welcomeBackProDescription") ||
                "Sign in to save your videos to the cloud, share with a link, and access advanced editing features."}
          </p>

          {/* <div
            onClick={() => {
              if (!isUpdated || learntAboutPro) {
                chrome.runtime.sendMessage({ type: "handle-login" });
              } else {
                chrome.storage.local.set({ learntAboutPro: true });
                chrome.runtime.sendMessage({ type: "pricing" });
                setLearntAboutPro(true);
              }
            }}
            role="button"
            className="main-button dashboard-button"
            tabIndex="0"
            style={{
              zIndex: 99,
              marginTop: "25px",
            }}
          >
            <span className="main-button-label">
              {!isUpdated || learntAboutPro
                ? chrome.i18n.getMessage("welcomeProButton") ||
                  "Sign in to unlock paid features"
                : !learntAboutPro
                ? chrome.i18n.getMessage("welcomeBackProCTA") ||
                  "Learn more about Screenity Pro"
                : chrome.i18n.getMessage("welcomeBackProCTAAfterLearn") ||
                  "Sign in to unlock paid features"}
            </span>
          </div> */}

          <div
            onClick={() => {
              if (learntAboutPro) {
                // After they've seen the Pro info, trigger sign in
                chrome.runtime.sendMessage({ type: "handle-login" });
              } else {
                // First click: show pricing page and mark as "learnt"
                chrome.storage.local.set({ learntAboutPro: true });
                chrome.runtime.sendMessage({ type: "pricing" });
                setLearntAboutPro(true);
              }
            }}
            role="button"
            className="main-button dashboard-button"
            tabIndex="0"
            style={{
              zIndex: 99,
              marginTop: "25px",
            }}
          >
            <span className="main-button-label">
              {learntAboutPro
                ? chrome.i18n.getMessage("welcomeProButton") ||
                  "Sign in to unlock paid features"
                : chrome.i18n.getMessage("welcomeBackProCTA") ||
                  "Learn more about Screenity Pro"}
            </span>
          </div>
          <a
            className="welcome-support"
            href="https://alyssax.substack.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              cursor: "pointer",
            }}
          >
            {chrome.i18n.getMessage("welcomeProSupport") ||
              "Support development by a solo indie maker "}
            <img src={chrome.runtime.getURL(SoloDev)} alt="Alyssa X" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
