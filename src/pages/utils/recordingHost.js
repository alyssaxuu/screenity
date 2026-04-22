// Synchronous URL-based host detection for the recorder document ('tab' | 'iframe' | 'offscreen').

const hasWindow = typeof window !== "undefined";

const urlParams = new URLSearchParams(hasWindow ? window.location.search : "");
const isInjectedIframe = urlParams.has("injected");

const isOffscreenUrl =
  hasWindow && window.location.pathname.endsWith("/offscreenrecorder.html");

const isIframeUrl =
  hasWindow &&
  (isInjectedIframe ||
    (window.top !== window.self &&
      !document.referrer.startsWith("chrome-extension://")));

export const RECORDING_HOST = isOffscreenUrl
  ? "offscreen"
  : isIframeUrl
  ? "iframe"
  : "tab";

export const IS_OFFSCREEN_HOST = RECORDING_HOST === "offscreen";
export const IS_IFRAME_HOST = RECORDING_HOST === "iframe";
export const IS_TAB_HOST = RECORDING_HOST === "tab";
