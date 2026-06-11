import React, { useContext, useState, Suspense, lazy } from "react";
import styles from "../../styles/player/_Content.module.scss";

// Components
import VideoPlayer from "../../components/player/VideoPlayer";
// Cropper drags in react-advanced-cropper (~218KB) and is only rendered
// when the user opens the crop tool. Lazy-load so it doesn't eat the
// editor's initial parse budget on every recording-stop.
const CropperWrap = lazy(() =>
  import("../../components/editor/CropperWrap"),
);
import HelpButton from "../../components/player/HelpButton";
import ProBanner from "../../components/global/ProBanner";
import ReviewBanner from "../../components/global/ReviewBanner";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Content = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context
  return (
    <div className={styles.content}>
      <div className={styles.wrap}>
        {contentState.mode === "audio" && <VideoPlayer />}
        {contentState.mode === "player" && <VideoPlayer />}
        {contentState.mode === "crop" && (
          <Suspense fallback={null}>
            <CropperWrap />
          </Suspense>
        )}
      </div>
      {contentState.mode === "crop" && <HelpButton />}
      {contentState.reviewPrompt ? (
        <ReviewBanner />
      ) : (
        // While eligible for the review prompt (waiting on the interaction
        // gate), reserve the slot so the Pro banner doesn't flash.
        !contentState.reviewEligible &&
        contentState.bannerSupport && <ProBanner />
      )}
    </div>
  );
};

export default Content;
