// Synchronous URL-based host detection for the recorder document ('tab' | 'iframe' | 'offscreen').

const hasWindow = typeof window !== "undefined";

const urlParams = new URLSearchParams(hasWindow ? window.location.search : "");
const isInjectedIframe = urlParams.has("injected");

const isOffscreenUrl =
  hasWindow && window.location.pathname.endsWith("/offscreenrecorder.html");

// A take frame inside the recorder host is an iframe of an extension page, but
// not a content-script iframe; an empty referrer there must not say otherwise.
export const isContentIframe = ({ injected, isTakeFrame, framed, referrer }) =>
  Boolean(
    injected ||
      (!isTakeFrame && framed && !String(referrer || "").startsWith("chrome-extension://"))
  );

const isIframeUrl =
  hasWindow &&
  isContentIframe({
    injected: isInjectedIframe,
    isTakeFrame: urlParams.has("take"),
    framed: window.top !== window.self,
    referrer: document.referrer,
  });

export const RECORDING_HOST = isOffscreenUrl
  ? "offscreen"
  : isIframeUrl
  ? "iframe"
  : "tab";

export const IS_OFFSCREEN_HOST = RECORDING_HOST === "offscreen";
export const IS_IFRAME_HOST = RECORDING_HOST === "iframe";
export const IS_TAB_HOST = RECORDING_HOST === "tab";
