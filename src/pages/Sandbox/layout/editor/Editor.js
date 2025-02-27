import React, { useState, useEffect, useContext } from "react";
import EditorNav from "./EditorNav";
import VideoPlayer from "../../components/editor/VideoPlayer";
import TrimUI from "./TrimUI";
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

import HelpButton from "../../components/player/HelpButton";

const Editor = ({ ffmpeg }) => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context

  const handleSeek = (t, updateTime) => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      updatePlayerTime: updateTime,
      time: t,
    }));
  };

  useEffect(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      history: [{}],
      redoHistory: [],
    }));
    contentState.addToHistory();
  }, []);

  return (
    <div>
      <EditorNav />
      <VideoPlayer onSeek={handleSeek} />
      <TrimUI blob={contentState.blob} onSeek={handleSeek} />
      <HelpButton />
    </div>
  );
};

export default Editor;
