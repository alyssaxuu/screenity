import React, { useContext, useState, useEffect } from "react";
import styles from "../../styles/player/_HelpButton.module.scss";
import { ReactSVG } from "react-svg";
import { ContentStateContext } from "../../context/ContentState";

const HelpButton = () => {
  const [contentState] = useContext(ContentStateContext);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1000
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const shouldOffset = contentState.bannerSupport && windowWidth > 900;

  return (
    <button
      className={styles.HelpButton}
      style={shouldOffset ? { bottom: "110px" } : {}}
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
