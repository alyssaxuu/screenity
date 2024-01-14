import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";

import { ReactSVG } from "react-svg";

import * as ToastEl from "@radix-ui/react-toast";

const Warning = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Record computer audio");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(10000);

  const openWarning = useCallback((title, description, duration) => {
    setTitle(title);
    setDescription(description);
    setDuration(duration);
    setOpen(true);
  }, []);

  useEffect(() => {
    // Check if macOS
    const isMac = navigator.userAgent.indexOf("Mac") !== -1;
    if (isMac) {
      openWarning(
        chrome.i18n.getMessage("recordAudioWarningMacTitle"),
        chrome.i18n.getMessage("recordAudioWarningMacDescription"),
        10000
      );
    } else {
      openWarning(
        chrome.i18n.getMessage("recordAudioWarningOtherTitle"),
        chrome.i18n.getMessage("recordAudioWarningOtherDescription"),
        10000
      );
    }
  }, []);

  return (
    <ToastEl.Provider swipeDirection="down" duration={duration}>
      <ToastEl.Root
        className="warning-root"
        open={open}
        onOpenChange={setOpen}
        onSwipeEnd={() => {
          setOpen(false);
        }}
      >
        <div className="warning-icon">
          <ReactSVG
            src={chrome.runtime.getURL("assets/tool-icons/audio-icon.svg")}
            width={20}
            height={20}
          />
        </div>
        <div className="warning-content">
          <ToastEl.Title className="warning-title">{title}</ToastEl.Title>
          <ToastEl.Description className="warning-description">
            {description}
          </ToastEl.Description>
        </div>
        <ToastEl.Close
          className="warning-close"
          onClick={() => {
            setOpen(false);
          }}
        >
          <ReactSVG
            src={chrome.runtime.getURL("assets/camera-icons/close.svg")}
            width={20}
            height={20}
          />
        </ToastEl.Close>
      </ToastEl.Root>
      <ToastEl.Viewport className="WarningViewport" />
      <style>
        {`

				button {
					all: unset;
				}
				.WarningViewport {
					--viewport-padding: 25px;
					position: fixed;
					bottom: 0;
					right: 0;
					left: 0;
					margin: auto !important;
					display: flex;
					flex-direction: column;
					padding: var(--viewport-padding);
					gap: 14px;
					max-width: 100vw;
					width: fit-content;
					list-style: none;
					z-index: 2147483647;
					outline: none;
					pointer-events: all !important;
				}
				
				.warning-root {
					background-color: #29292F;
					color: #FFF;
					border-radius: 30px;
					box-shadow: hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
						hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
					padding: 14px 20px;
					display: flex;
					flex-direction: row;
					justify-content: center;
					gap: 8px;
					font-size: 15px;
					line-height: 1.5;
					max-width: 500px;
					overflow: hidden;
					align-items: center;
					text-align: left;
					align-items: flex-start;
				}
				.warning-content {
					display: flex;
					flex-direction: column;
					justify-content: left;
					align-items: flex-start;
					gap: 8px;
					width: 100%;
				}
				.warning-root[data-state="open"] {
					animation: slideIn2 150ms cubic-bezier(0.16, 1, 0.3, 1);
				}
				.warning-root[data-state="closed"] {
					animation: hide 100ms ease-in;
				}
				.warning-root[data-swipe="move"] {
					transform: translateY(var(--radix-toast-swipe-move-y));
				}
				.warning-root[data-swipe="cancel"] {
					transform: translateY(0);
					transition: transform 200ms ease-out;
				}
				.warning-root[data-swipe="end"] {
					animation: swipeOut2 100ms ease-out;
				}
				
				@keyframes hide {
					from {
						opacity: 1;
					}
					to {
						opacity: 0 !important;
					}
				}
				
				@keyframes slideIn2 {
					from {
						transform: translateY(calc(100% + var(--viewport-padding)));
					}
					to {
						transform: translateY(0);
					}
				}
				
				@keyframes swipeOut2 {
					from {
						transform: translateY(var(--radix-toast-swipe-end-y));
					}
					to {
						transform: translateY(calc(100% + var(--viewport-padding)));
					}
				}
				
				.warning-title {
					color: #FFF;
					font-family: "Satoshi-Medium", sans-serif;
				}
				
				.warning-description {
					color: #FFF;
					opacity: 0.8;
					font-family: "Satoshi-Medium", sans-serif;
				}
				
				.ToastAction {
					color: #FFF;
					font-family: "Satoshi-Medium", sans-serif;
					text-align: right;
					background-color: #51515f;
					padding: 0px 12px !important;
					height: 24px !important;
					cursor: pointer;
				}
				.warning-close {
					z-index: 999999;
				}
				.warning-close:hover {
					cursor: pointer;
				}
				`}
      </style>
    </ToastEl.Provider>
  );
};

export default Warning;
