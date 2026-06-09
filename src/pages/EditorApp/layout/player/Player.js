import React, { useContext, useState, Suspense, lazy } from "react";

// Components
import PlayerNav from "./PlayerNav";
// Crop and Audio nav only render in their respective modes; player
// mode is the initial state on editor open. Lazy-loading avoids
// pulling their trees into the editor's cold-load critical path.
const CropNav = lazy(() => import("../editor/CropNav"));
const AudioNav = lazy(() => import("../editor/AudioNav"));
import RightPanel from "./RightPanel";
import Content from "./Content";

import styles from "../../styles/player/_Player.module.scss";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Player = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context

  return (
    <div className={styles.layout}>
      {contentState.mode === "crop" && (
        <Suspense fallback={null}>
          <CropNav />
        </Suspense>
      )}
      {contentState.mode === "player" && <PlayerNav />}
      {contentState.mode === "audio" && (
        <Suspense fallback={null}>
          <AudioNav />
        </Suspense>
      )}
      <div className={styles.content}>
        <Content />
        <RightPanel />
      </div>
    </div>
  );
};

export default Player;
