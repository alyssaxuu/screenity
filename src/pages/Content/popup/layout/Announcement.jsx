import React, { useState, useEffect } from "react";

const Announcement = (props) => {
  const [URL, setURL] = useState(
    "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what%E2%80%99s-changed-in-the-new-version-of-screenity/bDtvcwAtw9PPesQeNH4zjE"
  );

  useEffect(() => {
    // check i18n locale, and set URL accordingly w/ google translate
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
        "https://translate.google.com/translate?sl=en&tl=" +
          locale +
          "&u=" +
          URL
      );
    }
  }, []);
  return (
    <div className="announcement">
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
