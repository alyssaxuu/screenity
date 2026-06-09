// RecorderUI.jsx
import React from "react";
import RecorderShell from "../Components/RecorderShell";

const isTabFromUrl = new URLSearchParams(window.location.search).has("tab");

const RecorderUI = ({ started, isTab }) => {
  const title = started
    ? chrome.i18n.getMessage("recorderSelectProgressTitle")
    : isTab || isTabFromUrl
    ? chrome.i18n.getMessage("preparingLabel")
    : chrome.i18n.getMessage("recorderSelectTitle");
  const subtitle = chrome.i18n.getMessage("recorderSelectDescription");

  return (
    <RecorderShell
      title={title}
      subtitle={subtitle}
      started={started}
      isTab={isTab}
    />
  );
};

export default RecorderUI;
