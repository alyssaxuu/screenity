import React, { useContext, useEffect, useState, useRef, useMemo } from "react";
import Plyr from "plyr-react";
import "plyr-react/plyr.css";
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const VideoPlayer = (props) => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context
  const playerRef = useRef(null);
  const [url, setUrl] = useState(null);
  const [source, setSource] = useState(null);
  const [isSet, setIsSet] = useState(false);

  useEffect(() => {
    if (
      playerRef.current &&
      playerRef.current.plyr &&
      contentState.updatePlayerTime
    ) {
      playerRef.current.plyr.currentTime = contentState.time;
    }
  }, [contentState.time]);

  const options = useMemo(
    () => ({
      controls: ["play", "mute", "captions", "settings", "pip", "fullscreen"],
      ratio: "16:9",
      blankVideo:
        "chrome-extension://" +
        chrome.i18n.getMessage("@@extension_id") +
        "/assets/blank.mp4",
      keyboard: {
        global: true,
      },
    }),
    []
  );

  useEffect(() => {
    if (contentState.blob) {
      const objectURL = URL.createObjectURL(contentState.blob);
      setSource({
        type: "video",
        sources: [
          {
            src: objectURL,
            type: "video/mp4",
          },
        ],
      });
      setUrl(objectURL);

      // if (playerRef.current && playerRef.current.plyr) {
      //   // Check when the video is playing, update the time in real time
      //   playerRef.current.plyr.on("timeupdate", () => {
      //     setContentState((prevContentState) => ({
      //       ...prevContentState,
      //       time: playerRef.current.plyr.currentTime,
      //       updatePlayerTime: false,
      //     }));
      //   });
      // }

      return () => {
        URL.revokeObjectURL(objectURL);

        // if (playerRef.current && playerRef.current.plyr) {
        //   playerRef.current.plyr.off("timeupdate");
        // }
      };
    }
  }, [contentState.blob, playerRef]);

  useEffect(() => {
    if (playerRef.current && playerRef.current.plyr) {
      // Check when the video is playing, update the time in real time
      playerRef.current.plyr.on("timeupdate", () => {
        setContentState((prevContentState) => ({
          ...prevContentState,
          time: playerRef.current.plyr.currentTime,
          updatePlayerTime: false,
        }));
      });
    }

    return () => {
      if (playerRef.current && playerRef.current.plyr) {
        playerRef.current.plyr.off("timeupdate");
      }
    };
  }, [playerRef]);

  const handleClick = () => {
    if (isSet) return;
    if (playerRef.current && playerRef.current.plyr) {
      setIsSet(true);
      playerRef.current.plyr.on("timeupdate", () => {
        setContentState((prevContentState) => ({
          ...prevContentState,
          time: playerRef.current.plyr.currentTime,
          updatePlayerTime: false,
        }));
      });
    }
  };

  useEffect(() => {
    if (isSet) return;
    const handleKeyPress = (event) => {
      if (playerRef.current && playerRef.current.plyr) {
        setIsSet(true);
        playerRef.current.plyr.on("timeupdate", () => {
          setContentState((prevContentState) => ({
            ...prevContentState,
            time: playerRef.current.plyr.currentTime,
            updatePlayerTime: false,
          }));
        });
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isSet]);

  return (
    <div className="videoPlayer">
      <div className="playerWrap" onClick={handleClick}>
        {url && (
          <Plyr
            ref={playerRef}
            id="plyr-player"
            source={source}
            options={options}
          />
        )}
      </div>
      <style>
        {`
					.plyr {
						height: 90%!important;
					}
					@media (max-width: 900px) {
						.videoPlayer {
							height: 100%!important;
							top: 40px!important;
						}
						.playerWrap {
							height: calc(100% - 300px)!important;
						}
					`}
      </style>
    </div>
  );
};

export default VideoPlayer;
