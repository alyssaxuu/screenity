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

import { ContentStateContext } from "./context/ContentState";
import { diagForward } from "../utils/diagForward";
import { perfMark } from "../utils/perfMarks";
import { triggerSupportDownload } from "../utils/triggerSupportDownload";

const Sandbox = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);
  const parentRef = useRef(null);
  const progress = useRef("");
  // ref so the stuck-timer closure (deps=[]) can read current state
  const loadStateRef = useRef({
    ready: false,
    hasBlob: false,
    chunkIndex: 0,
    chunkCount: 0,
  });

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

  useEffect(() => {
    loadStateRef.current.ready = Boolean(contentState.ready);
    loadStateRef.current.hasBlob = Boolean(contentState.blob);
    loadStateRef.current.chunkIndex = contentState.chunkIndex || 0;
    loadStateRef.current.chunkCount = contentState.chunkCount || 0;
  }, [
    contentState.ready,
    contentState.blob,
    contentState.chunkIndex,
    contentState.chunkCount,
  ]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "check-banner-support" }, (response) => {
      if (response && response.bannerSupport) {
        setContentState((prev) => ({
          ...prev,
          bannerSupport: true,
        }));
      }
    });
  }, []);

  // Editor opened without a blob/ready state: ask BG to send chunks.
  // Retry because BG may be dormant on first wake, and a single dropped
  // message would leave the editor stuck at "Preparing recording..." forever.
  useEffect(() => {
    const RETRY_DELAYS_MS = [400, 2000, 6000, 14000];
    let cancelled = false;
    const timers = [];

    const tryRequest = async (attempt) => {
      if (cancelled) return;
      try {
        if (contentState.blob || contentState.ready) return;
        // OPFS-backed: sandbox reads the file directly in makeVideoTab.
        const { lastRecordingBackendRef } = await chrome.storage.local.get([
          "lastRecordingBackendRef",
        ]);
        if (lastRecordingBackendRef?.backend === "opfs") {
          console.debug(
            "[Screenity][Sandbox] OPFS-backed recording; skipping SW chunk relay request",
          );
          return;
        }
        console.debug(
          "[Screenity][Sandbox] requesting chunks from background",
          { attempt: attempt + 1 },
        );
        perfMark("Sandbox send-chunks-to-sandbox.requested", {
          attempt: attempt + 1,
        });
        chrome.runtime.sendMessage(
          { type: "send-chunks-to-sandbox" },
          () => {},
        );
      } catch (err) {}
    };

    perfMark("Sandbox boot");
    RETRY_DELAYS_MS.forEach((ms, i) => {
      timers.push(setTimeout(() => tryRequest(i), ms));
    });

    // Long IDB-backed recordings can take minutes to transfer from SW
    // to sandbox (chunks are base64-encoded and batched). A flat 60s
    // timeout would fire on healthy slow loads. Re-arm while chunks
    // keep arriving; only fire when nothing has progressed for 30s.
    const STUCK_FIRST_CHECK_MS = 60_000;
    const STUCK_RECHECK_MS = 15_000;
    const STUCK_NO_PROGRESS_MS = 30_000;
    const STUCK_MAX_TOTAL_MS = 10 * 60_000;
    const startAt = Date.now();
    let lastChunkIndex = 0;
    let lastProgressAt = startAt;
    const checkStuck = () => {
      try {
        if (cancelled) return;
        if (loadStateRef.current.ready || loadStateRef.current.hasBlob) {
          chrome.runtime
            .sendMessage({
              type: "diag-forward",
              event: "sandbox-stuck-timeout-suppressed",
              data: {
                afterMs: Date.now() - startAt,
                ready: loadStateRef.current.ready,
                hasBlob: loadStateRef.current.hasBlob,
              },
            })
            .catch(() => {});
          return;
        }
        const now = Date.now();
        const idx = loadStateRef.current.chunkIndex || 0;
        const count = loadStateRef.current.chunkCount || 0;
        if (idx > lastChunkIndex) {
          lastChunkIndex = idx;
          lastProgressAt = now;
        }
        const sinceProgress = now - lastProgressAt;
        const totalWaited = now - startAt;
        const chunksFlowing =
          count > 0 && idx < count && sinceProgress < STUCK_NO_PROGRESS_MS;
        // After the last chunk lands the sandbox still has to assemble
        // the blob; give it longer before declaring stuck.
        const assemblingBlob =
          count > 0 && idx >= count && sinceProgress < 90_000;
        if (
          (chunksFlowing || assemblingBlob) &&
          totalWaited < STUCK_MAX_TOTAL_MS
        ) {
          timers.push(setTimeout(checkStuck, STUCK_RECHECK_MS));
          return;
        }
        chrome.runtime
          .sendMessage({
            type: "diag-forward",
            event: "sandbox-stuck-timeout",
            data: {
              afterMs: totalWaited,
              chunkIndex: idx,
              chunkCount: count,
              sinceProgressMs: sinceProgress,
            },
          })
          .catch(() => {});
        chrome.storage.local.set({
          editorRecordingError: {
            ts: Date.now(),
            sandboxTab: null,
            error: "editor-stuck",
            why: chrome.i18n.getMessage("editorStuckDescription"),
            errorCode: "EDITOR_STUCK_TIMEOUT",
          },
        });
      } catch {}
    };
    timers.push(setTimeout(checkStuck, STUCK_FIRST_CHECK_MS));

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

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
