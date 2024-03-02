import React, { useContext, useState } from "react";
import styles from "../../styles/player/_Content.module.scss";

// Components
import VideoPlayer from "../../components/player/VideoPlayer";
import CropperWrap from "../../components/editor/CropperWrap";
import HelpButton from "../../components/player/HelpButton";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Content = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context
  return (
    <div className={styles.content}>
      <div className={styles.wrap}>
        {contentState.mode === "audio" && <VideoPlayer />}
        {contentState.mode === "player" && <VideoPlayer />}
        {contentState.mode === "crop" && <CropperWrap />}
      </div>
      <HelpButton />
    </div>
  );
};

export default Content;
