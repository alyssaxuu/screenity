import React, { useContext, useRef, useEffect } from "react";
import styles from "../../styles/player/_Nav.module.scss";
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

// Icons
import { ReactSVG } from "react-svg";

const URL = "/assets/";

const StarIcon = URL + "editor/icons/help-nav.svg";
const HeartIcon = URL + "editor/icons/heart.svg";
const UnlockIcon = URL + "editor/icons/unlock.svg";

const PlayerNav = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context
  const contentStateRef = useRef(null);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  return (
    <div className={styles.nav}>
      <div className={styles.navWrap}>
        <div
          onClick={() => {
            chrome.runtime.sendMessage({ type: "open-home" });
          }}
          aria-label="home"
          className={styles.navLeft}
        >
          <img src={URL + "editor/logo.svg"} alt="Screenity Logo" />
        </div>
        <div className={styles.navRight}>
          <button
            className="button simpleButton blueButton"
            onClick={() => {
              chrome.runtime.sendMessage({ type: "open-help" });
            }}
          >
            <ReactSVG src={StarIcon} />
            {chrome.i18n.getMessage("getHelpNav")}
          </button>
          <button
            className="button primaryButton"
            onClick={() => {
              chrome.runtime.sendMessage({ type: "pricing" });
            }}
          >
            <ReactSVG src={UnlockIcon} />{" "}
            {chrome.i18n.getMessage("unlockMoreFeatures") ||
              "Unlock more features"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerNav;
