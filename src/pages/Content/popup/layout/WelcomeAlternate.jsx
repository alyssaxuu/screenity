import React, { useState, useEffect } from "react";
import CheckBlueIcon from "../../../../assets/check-blue.svg";
import SoloDev from "../../../../assets/solo-dev.png";

const FeatureItem = ({ text }) => {
  // render with a checkmark icon on left and text on right
  return (
    <div className="welcome-feature-item">
      <div className="welcome-feature-icon">
        <img src={chrome.runtime.getURL(CheckBlueIcon)} alt="Checkmark" />
      </div>
      <span className="welcome-feature-item-text">{text}</span>
    </div>
  );
};

const Welcome = (props) => {
  return (
    <div
      className="announcement"
      style={{
        marginTop: "50px",
        paddingBottom: "0px",
      }}
    >
      <div className="announcement-wrap">
        {/* <div className="announcement-hero">
					<img src={chrome.runtime.getURL("assets/helper/hero.png")} />
				</div> */}
        <div className="announcement-details">
          <div className="welcome-title">
            {chrome.i18n.getMessage("welcomePopupTitle")}
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
              props.setOnboarding(false);
              chrome.storage.local.set({ updatingFromOld: false });
            }}
          >
            👋 {chrome.i18n.getMessage("welcomePopupCTA")}
          </div>
        </div>
      </div>
      <div className="welcome-content">
        <div className="welcome-content-wrap">
          <div className="welcome-content-title">
            {chrome.i18n.getMessage("welcomePopupCloudTitle")}
          </div>
          <div className="welcome-video"></div>
          <div className="welcome-feature-list">
            <FeatureItem
              text={chrome.i18n.getMessage("welcomePopupCloudFeature1")}
            />
            <FeatureItem
              text={chrome.i18n.getMessage("welcomePopupCloudFeature2")}
            />
            <FeatureItem
              text={chrome.i18n.getMessage("welcomePopupCloudFeature3")}
            />
            <FeatureItem
              text={chrome.i18n.getMessage("welcomePopupCloudFeature4")}
            />
            <FeatureItem
              text={chrome.i18n.getMessage("welcomePopupCloudFeature5")}
            />
          </div>
          <a
            href={process.env.SCREENITY_APP_BASE}
            target="_blank"
            rel="noopener noreferrer"
            role="button"
            className="main-button dashboard-button"
            tabIndex="0"
            style={{
              zIndex: 99,
              marginTop: "25px",
            }}
          >
            <span className="main-button-label">
              {chrome.i18n.getMessage("welcomePopupCTA")}
            </span>
            <span
              className="main-button-shortcut"
              style={{
                fontSize: "14px",
              }}
            >
              $8/mo
            </span>
          </a>
          <a
            className="welcome-support"
            href="https://https://alyssax.substack.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {chrome.i18n.getMessage("welcomePopupSupport")}{" "}
            <img src={chrome.runtime.getURL(SoloDev)} alt="Alyssa X" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
