import React from "react";

const Announcement = (props) => {
  const URL =
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what%E2%80%99s-changed-in-the-new-version-of-screenity/bDtvcwAtw9PPesQeNH4zjE";

  return (
    <div className="welcome">
      <div className="announcement-wrap">
        <div className="announcement-hero">
          <img src={chrome.runtime.getURL("assets/helper/hero.png")} />
        </div>
        <div className="announcement-details">
          <div className="announcement-title">
            {chrome.i18n.getMessage("updateAnnouncementTitle")} 👋
          </div>
          <div className="announcement-description">
            {chrome.i18n.getMessage("updateAnnouncementDescription")}{" "}
            <a href={URL} target="_blank">
              {chrome.i18n.getMessage("updateAnnouncementLearnMore")}
            </a>
          </div>
          <div
            className="announcement-cta"
            onClick={() => {
              props.setOnboarding(false);
              chrome.storage.local.set({ updatingFromOld: false });
            }}
          >
            {chrome.i18n.getMessage("updateAnnouncementButton")}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Announcement;
