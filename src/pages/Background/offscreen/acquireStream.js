// SW-side stream acquisition for the offscreen recorder. Offscreen docs
// can't call getDisplayMedia / tabCapture; SW acquires a streamId and hands
// it over. Picker anchors to initiatingTabId so it appears on the user's tab.

const DEFAULT_SCREEN_SOURCES = ["screen", "window", "tab", "audio"];

const getInitiatingTab = async (tabId) => {
  if (!tabId) return null;
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
};

const acquireScreenStream = ({ sources, anchorTab }) =>
  new Promise((resolve, reject) => {
    const requested =
      Array.isArray(sources) && sources.length ? sources : DEFAULT_SCREEN_SOURCES;
    try {
      console.log("[Screenity][acquireStream] chooseDesktopMedia invoked", {
        requested,
        anchorTabId: anchorTab?.id,
      });
      chrome.desktopCapture.chooseDesktopMedia(
        requested,
        anchorTab || undefined,
        (streamId, opts) => {
          console.log("[Screenity][acquireStream] chooseDesktopMedia callback", {
            streamIdPresent: !!streamId,
            streamIdPrefix: streamId ? streamId.slice(0, 16) + "..." : null,
            opts,
            lastError: chrome.runtime.lastError?.message || null,
          });
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!streamId) {
            resolve({ streamId: "", source: "cancelled" });
            return;
          }
          resolve({
            streamId,
            source: "desktop",
            canRequestAudioTrack: !!opts?.canRequestAudioTrack,
          });
        }
      );
    } catch (err) {
      reject(err);
    }
  });

const acquireTabStream = ({ targetTabId }) =>
  new Promise((resolve, reject) => {
    if (!targetTabId) {
      reject(new Error("tab capture requires targetTabId"));
      return;
    }
    try {
      chrome.tabCapture.getMediaStreamId(
        { targetTabId },
        (streamId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!streamId) {
            resolve({ streamId: "", source: "cancelled" });
            return;
          }
          resolve({ streamId, source: "tab" });
        }
      );
    } catch (err) {
      reject(err);
    }
  });

export const acquireStreamForOffscreen = async ({
  mode,
  initiatingTabId,
  targetTabId,
  sources,
}) => {
  if (mode === "camera") {
    return { streamId: null, source: "camera" };
  }

  if (mode === "tab") {
    return acquireTabStream({ targetTabId: targetTabId || initiatingTabId });
  }

  const anchorTab = await getInitiatingTab(initiatingTabId);
  return acquireScreenStream({ sources, anchorTab });
};
