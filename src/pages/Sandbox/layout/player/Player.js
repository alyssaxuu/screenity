import React, { useContext, useEffect, useState } from "react";

// Components
import PlayerNav from "./PlayerNav";
import CropNav from "../editor/CropNav";
import AudioNav from "../editor/AudioNav";
import RightPanel from "./RightPanel";
import Content from "./Content";

import styles from "../../styles/player/_Player.module.scss";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Player = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context


useEffect(() => {
  if (contentState.videoUploadContentService) {
    chrome.storage.local.clear(() => {
      console.log("Extension local storage cleared");

      // Open external site in a new tab
  chrome.tabs.create({ url: `https://devapp.demokraft.ai/studio?studio_video_id=${contentState?.studio_video_id}` }, () => {
        // Close the extension popup after redirect
        window.close();
      });    });
  }
}, [contentState.videoUploadContentService]);

  return (
    <div className={styles.layout}>
      <div    style={{
        position:"fixed",
        top:"0px",
        left:"0px",
        width:"100%",
        height:"100%",
        background:"rgba(0,0,0,0.2)",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        backdropFilter: "saturate(180%) blur(10px)",
        zIndex:"999999999999"
        
      }}>
        <div className={styles.loader}>

        </div>
      </div>
      {contentState.mode === "crop" && <CropNav />}
      {contentState.mode === "player" && <PlayerNav />}
      {contentState.mode === "audio" && <AudioNav />}
      <div className={styles.content}>
        <Content />
        <RightPanel />
      </div>
    </div>
  );
};

export default Player;
