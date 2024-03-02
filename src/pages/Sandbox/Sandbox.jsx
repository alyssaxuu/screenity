import "./styles/edit/_VideoPlayer.scss";
import "./styles/global/_app.scss";

import React, { useState, useEffect, useRef, useContext } from "react";
// Layout
import Editor from "./layout/editor/Editor";
import Player from "./layout/player/Player";
import Modal from "./components/global/Modal";

import HelpButton from "./components/player/HelpButton";

// Context
import { ContentStateContext } from "./context/ContentState"; // Import the ContentState context

const Sandbox = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context
  const parentRef = useRef(null);
  const progress = useRef("");

  // Check when going offline (listener)
  // useEffect(() => {
  //   window.addEventListener("offline", () => {
  //     setContentState((prevState) => ({
  //       ...prevState,
  //       offline: true,
  //     }));
  //   });
  // }, []);

  const getChromeVersion = () => {
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);

    return raw ? parseInt(raw[2], 10) : false;
  };

  useEffect(() => {
    const MIN_CHROME_VERSION = 110;
    const chromeVersion = getChromeVersion();

    if (chromeVersion && chromeVersion > MIN_CHROME_VERSION) {
      contentState.loadFFmpeg();
    } else {
      setContentState((prevState) => ({
        ...prevState,
        updateChrome: true,
        ffmpeg: true,
      }));
    }
  }, []);

  useEffect(() => {
    if (!contentState.blob || !contentState.ffmpeg) return;
    if (contentState.frame) return;
    contentState.getFrame();
  }, [contentState.blob, contentState.ffmpeg]);

  // Programmatically add custom scrollbars
  useEffect(() => {
    if (!parentRef) return;
    if (!parentRef.current) return;

    // Check if on mac
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    if (isMac) return;

    const parentDiv = parentRef.current;

    const elements = parentDiv.querySelectorAll("*");
    elements.forEach((element) => {
      element.classList.add("screenity-scrollbar");
    });

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);

          addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.add("screenity-scrollbar");
            }
          });

          removedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              node.classList.remove("screenity-scrollbar");
            }
          });
        }
      }
    });

    observer.observe(parentDiv, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [parentRef.current]);

  useEffect(() => {
    if (contentState.chunkCount > 0) {
      progress.current = `(${Math.round(
        (contentState.chunkIndex / contentState.chunkCount) * 100
      )}%)`;
    }
  }, [contentState.chunkIndex, contentState.chunkCount]);

  return (
    <div ref={parentRef}>
      <Modal />
      <video></video>
      {/* Render the WaveformGenerator component and pass the ffmpeg instance as a prop */}
      {contentState.ffmpeg &&
        contentState.ready &&
        contentState.mode === "edit" && <Editor />}
      {contentState.mode != "edit" && contentState.ready && <Player />}
      {!contentState.ready && (
        <div className="wrap">
          <img className="logo" src="/assets/logo-text.svg" />
          <div className="middle-area">
            <img src="/assets/record-tab-active.svg" />
            <div className="title">
              {chrome.i18n.getMessage("sandboxProgressTitle") +
                " " +
                progress.current}
            </div>
            <div className="subtitle">
              {chrome.i18n.getMessage("sandboxProgressDescription")}
            </div>
            {typeof contentState.openModal === "function" && (
              <div
                className="button-stop"
                onClick={() => {
                  contentState.openModal(
                    chrome.i18n.getMessage("havingIssuesModalTitle"),
                    chrome.i18n.getMessage("havingIssuesModalDescription"),
                    chrome.i18n.getMessage("restoreRecording"),
                    chrome.i18n.getMessage("havingIssuesModalButton2"),
                    () => {
                      chrome.runtime.sendMessage({ type: "restore-recording" });
                      // chrome.runtime.sendMessage(
                      //   {
                      //     type: "check-restore",
                      //   },
                      //   (response) => {
                      //     if (response.restore) {
                      //       chrome.runtime.sendMessage({
                      //         type: "indexed-db-download",
                      //       });
                      //     } else {
                      //       alert(chrome.i18n.getMessage("noRecordingFound"));
                      //     }
                      //   }
                      // );
                    },
                    () => {
                      chrome.runtime.sendMessage({ type: "report-bug" });
                    }
                  );
                }}
              >
                {chrome.i18n.getMessage("havingIssuesButton")}
              </div>
            )}
          </div>
          <HelpButton />
          <div className="setupBackgroundSVG"></div>
        </div>
      )}
      <style>
        {`
				
				.wrap {
					overflow: hidden;
				}
				.setupBackgroundSVG {
					position: absolute;
					top: 0px;
					left: 0px;
					width: 100%;
					height: 100%;
					background: url(/assets/helper/pattern-svg.svg) repeat;
					background-size: 62px 23.5px;
					animation: moveBackground 138s linear infinite;
				}
				.button-stop {
					padding: 10px 20px;
					background: #FFF;
					border-radius: 30px;
					color: #29292F;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					margin-top: 0px;
					border: 1px solid #E8E8E8;
					margin-left: auto;
					margin-right: auto;
					z-index: 999999;
				}
				
				@keyframes moveBackground {
					0% {
						background-position: 0 0;
					}
					100% {
						background-position: 100% 0;
					}
				}

				.logo {
					position: absolute;
					bottom: 30px;
					left: 0px;
					right: 0px;
					margin: auto;
					width: 120px;
				}
				.wrap {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: #F6F7FB;
				}
					.middle-area {
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100%;
						font-family: Satoshi Medium, sans-serif;
					}
					.middle-area img {
						width: 40px;
						margin-bottom: 20px;
					}
					.title {
						font-size: 24px;
						font-weight: 700;
						color: #1A1A1A;
						margin-bottom: 14px;
						font-family: Satoshi-Medium, sans-serif;
						text-align: center;
					}
					.subtitle {
						font-size: 14px;
						font-weight: 400;
						color: #6E7684;
						margin-bottom: 24px;
						font-family: Satoshi-Medium, sans-serif;
						text-align: center;
					}


.screenity-scrollbar *::-webkit-scrollbar, .screenity-scrollbar::-webkit-scrollbar {
  background-color: rgba(0,0,0,0);
  width: 16px;
  height: 16px;
  z-index: 999999;
}
.screenity-scrollbar *::-webkit-scrollbar-track, .screenity-scrollbar::-webkit-scrollbar-track {
  background-color: rgba(0,0,0,0);
}
.screenity-scrollbar *::-webkit-scrollbar-thumb, .screenity-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0);
  border-radius:16px;
  border:0px solid #fff;
}
.screenity-scrollbar *::-webkit-scrollbar-button, .screenity-scrollbar::-webkit-scrollbar-button {
  display:none;
}
.screenity-scrollbar *:hover::-webkit-scrollbar-thumb, .screenity-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #a0a0a5;
  border:4px solid #fff;
}
::-webkit-scrollbar-thumb *:hover, ::-webkit-scrollbar-thumb:hover {
    background-color:#a0a0a5;
    border:4px solid #f4f4f4
}
.videoBanner {
	height: 40px!important;
	width: 100%!important;
	position: absolute!important;
	top: 0px!important;
	left: 0px!important;
	background-color: #3080F8!important;
	color: #FFF!important;
	font-family: "Satoshi-Medium"!important;
	z-index: 99999999999!important;
	text-align: center!important;
	display: flex!important;
	align-items: center!important;
	justify-content: center!important;
	flex-direction: row!important;
	gap: 6px!important;
}
					
					`}
      </style>
    </div>
  );
};

export default Sandbox;
