import "./styles/edit/_VideoPlayer.scss";
import "./styles/global/_app.scss";

import React, { useEffect, useRef, useContext, Suspense, lazy } from "react";
// Editor (trim/cut/timeline UI) only mounts when user enters edit mode.
// Initial open is "player" mode; defer Editor + its TrimUI dependencies.
const Editor = lazy(() => import("./layout/editor/Editor"));
import Player from "./layout/player/Player";
import Modal from "./components/global/Modal";
import Toast from "./components/global/Toast";

import HelpButton from "./components/player/HelpButton";
import ReviewBanner from "./components/global/ReviewBanner";

import { ContentStateContext } from "./context/ContentState";
import { diagForward } from "../utils/diagForward";
import { triggerSupportDownload } from "../utils/triggerSupportDownload";
import GradientBackground from "../Components/GradientBackground";

const EditorApp = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);
  const parentRef = useRef(null);
  const progress = useRef("");

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

  useEffect(() => {
    if (!parentRef) return;
    if (!parentRef.current) return;

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
      progress.current = `(${Math.min(
        100,
        Math.round((contentState.chunkIndex / contentState.chunkCount) * 100),
      )}%)`;
    }
  }, [contentState.chunkIndex, contentState.chunkCount]);

  // Review prompt and Pro banner share the slot and are mutually exclusive, so
  // only check Pro-banner support when the review prompt won't show (avoids a
  // flash). `?reviewPreview=1` (or =review / =feedback) forces it open for design.
  useEffect(() => {
    const reviewPreview = new URLSearchParams(window.location.search).get(
      "reviewPreview",
    );
    if (reviewPreview !== null) {
      setContentState((prev) => ({ ...prev, reviewPrompt: true }));
      return;
    }
    const checkBannerSupport = () => {
      chrome.runtime.sendMessage({ type: "check-banner-support" }, (response) => {
        if (response && response.bannerSupport) {
          setContentState((prev) => ({ ...prev, bannerSupport: true }));
        }
      });
    };
    chrome.runtime.sendMessage({ type: "check-review-prompt" }, (response) => {
      if (response && response.showReview) {
        // Eligible, but wait for the interaction gate below before showing.
        setContentState((prev) => ({ ...prev, reviewEligible: true }));
      } else {
        checkBannerSupport();
      }
    });
  }, []);

  // Show the review banner once the editor is ready: a ~3s settle so it never
  // appears over a loading or broken result, or instantly on any interaction.
  // The failed/degraded/salvaged suppression keeps it safe.
  useEffect(() => {
    if (!contentState.reviewEligible) return;
    if (!contentState.ready) return;
    if (contentState.reviewPrompt) return;
    // `ready` only means a playable video is showing. Don't appear over a
    // failed recording or while a transcode/processing is still running.
    if (contentState.recordingFailed) return;
    if (contentState.isFfmpegRunning) return;
    if (contentState.processingProgress > 0) return;

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      cleanup();
      setContentState((prev) => ({ ...prev, reviewPrompt: true }));
    };
    const onInteract = () => reveal();

    // Arm interaction listeners almost immediately so a download/save click
    // shows it right away; the tiny delay just skips a stray load-time click.
    const armTimer = setTimeout(() => {
      document.addEventListener("pointerdown", onInteract);
      document.addEventListener("keydown", onInteract);
    }, 800);
    // Passive backstop: settle a few seconds after the result is ready.
    const revealTimer = setTimeout(reveal, 3000);

    function cleanup() {
      clearTimeout(armTimer);
      clearTimeout(revealTimer);
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
    }
    return cleanup;
  }, [
    contentState.reviewEligible,
    contentState.ready,
    contentState.reviewPrompt,
    contentState.recordingFailed,
    contentState.isFfmpegRunning,
    contentState.processingProgress,
  ]);

  useEffect(() => {
    if (
      contentState.mode === "crop" &&
      contentState.getFrame &&
      contentState.blob &&
      contentState.ffmpeg
    ) {
      // Let state updates propagate first.
      setTimeout(() => {
        contentState.getFrame();
      }, 50);
    }
  }, [contentState.mode]);

  return (
    <div ref={parentRef}>
      <Modal />
      <Toast />
      <video></video>
      {contentState.ffmpeg &&
        contentState.ready &&
        contentState.mode === "edit" && (
          <Suspense fallback={null}>
            <Editor />
          </Suspense>
        )}
      {contentState.mode != "edit" && contentState.ready && <Player />}
      {!contentState.ready &&
        new URLSearchParams(window.location.search).get("reviewPreview") !==
          null && <ReviewBanner />}
      {!contentState.ready && (
        <div className="wrap">
          <img className="logo" src="/assets/logo-text.svg" />
          <div className="middle-area">
            <img src="/assets/record-tab-active.svg" />
            <div className="title">
              {chrome.i18n.getMessage("sandboxProgressTitle") +
                " " +
                (contentState.processingProgress > 0
                  ? `(${Math.round(contentState.processingProgress)}%)`
                  : progress.current)}
            </div>
            <div className="subtitle">
              {chrome.i18n.getMessage("sandboxProgressDescription")}
            </div>
            {typeof contentState.openModal === "function" && (
              <div
                className="button-stop"
                onClick={() => {
                  diagForward("sandbox-user-clicked-help", {
                    chunkCount: contentState?.chunkCount ?? 0,
                    chunkIndex: contentState?.chunkIndex ?? 0,
                    hasRawBlob: Boolean(contentState?.rawBlob),
                    hasBlob: Boolean(contentState?.blob),
                    ready: Boolean(contentState?.ready),
                  });
                  contentState.openModal(
                    chrome.i18n.getMessage("havingIssuesModalTitle"),
                    chrome.i18n.getMessage("havingIssuesModalDescription"),
                    chrome.i18n.getMessage("restoreRecording"),
                    chrome.i18n.getMessage("havingIssuesModalButton2"),
                    () => {
                      chrome.runtime.sendMessage({ type: "restore-recording" });
                    },
                    () => {
                      triggerSupportDownload({ source: "sandbox-report-bug" });
                      chrome.runtime.sendMessage({ type: "report-bug", zipBundled: true });
                    },
                    null,
                    null,
                    null,
                    false,
                    chrome.i18n.getMessage("getHelpButton"),
                    () => {
                      triggerSupportDownload({ source: "processing-stuck" });
                      chrome.runtime.sendMessage({
                        type: "report-error",
                        source: "processing-stuck",
                        zipBundled: true,
                      });
                    },
                  );
                }}
              >
                {chrome.i18n.getMessage("havingIssuesButton")}
              </div>
            )}
          </div>
          <HelpButton />
          <GradientBackground />
        </div>
      )}
      <style>
        {`
				
				.wrap {
					overflow: hidden;
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
					isolation: isolate;
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

export default EditorApp;
