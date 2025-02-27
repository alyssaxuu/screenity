import React, { useContext, useState } from "react";
import styles from "../../styles/player/_HelpButton.module.scss";

import { ReactSVG } from "react-svg";

const HelpButton = () => {
  return (
    <button
      className={styles.HelpButton}
      aria-label="Help button"
      onClick={() => {
        chrome.runtime.sendMessage({ type: "open-help" });
      }}
    >
      <ReactSVG
        src="/assets/editor/icons/help.svg"
        width="18px"
        height="18px"
      />
    </button>
  );
};

export default HelpButton;
