import React from "react";
// import EditorPreview from "../../../../assets/editor-preview.png"; // replace with actual screenshot file

const Welcome = (props) => {
  const isUpdated = props.isBack;
  const clearBack = props.clearBack;

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
            {chrome.i18n.getMessage("welcomeProDescription") ||
              "Cloud backup, real editing, and a clean link to share."}
          </p>

          <div
            onClick={() => {
              chrome.runtime.sendMessage({ type: "pricing", source: "welcome" });
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
              {chrome.i18n.getMessage("welcomeProButton") || "Unlock the editor"}
            </span>
            <span
              className="main-button-label"
              style={{
                opacity: 0.55,
                fontWeight: 400,
                marginLeft: "8px",
              }}
            >
              $10/mo
            </span>
          </div>
          <div
            onClick={() => {
              chrome.runtime.sendMessage({ type: "handle-login" });
            }}
            role="button"
            tabIndex="0"
            style={{
              marginTop: "14px",
              fontSize: "13px",
              color: "#6E7684",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            {chrome.i18n.getMessage("shareModalSandboxLogin") ||
              "Already have an account? Log in"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
