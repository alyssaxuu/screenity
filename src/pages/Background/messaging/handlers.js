import { registerMessage } from "../../../messaging/messageRouter";
import {
  focusTab,
  createTab,
  resetActiveTab,
  resetActiveTabRestart,
  setSurface,
} from "../tabManagement";

import { startRecording } from "../recording/startRecording";
import {
  handleStopRecordingTab,
  handleStopRecordingTabBackup,
} from "../recording/stopRecording";
import { handleSaveToDrive } from "../drive/handleSaveToDrive";
import { addAlarmListener } from "../alarms/addAlarmListener";
import { cancelRecording, handleDismiss } from "../recording/cancelRecording";
import { handleDismissRecordingTab } from "../recording/discardRecording";
import { sendMessageRecord } from "../recording/sendMessageRecord";
import { offscreenDocument } from "../offscreen/offscreenDocument";
import { forceProcessing } from "../recording/forceProcessing";
import {
  restartActiveTab,
  getCurrentTab,
  sendMessageTab,
} from "../tabManagement";
import {
  handleRestart,
  handleRestartRecordingTab,
} from "../recording/restartRecording";
import { checkRecording } from "../recording/checkRecording";
import {
  isPinned,
  getPlatformInfo,
  resizeWindow,
  checkAvailableMemory,
} from "../utils/browserHelpers";
import { requestDownload, downloadIndexedDB } from "../utils/downloadHelpers";
import { restoreRecording, checkRestore } from "../recording/restoreRecording";
import { desktopCapture } from "../recording/desktopCapture";
import {
  writeFile,
  videoReady,
  handleGetStreamingData,
  handleRecordingError,
  handleRecordingComplete,
  handleOnGetPermissions,
  handlePip,
  checkCapturePermissions,
} from "../recording/recordingHelpers";
import { newChunk, clearAllRecordings } from "../recording/chunkHandler";
import { setMicActiveTab } from "../tabManagement/tabHelpers";
import { handleSignOutDrive } from "../drive/handleSignOutDrive";
import { loginWithWebsite } from "../auth/loginWithWebsite";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const copyToClipboard = (text) => {
  if (!text) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId },
      func: (content) => {
        navigator.clipboard.writeText(content).catch((err) => {
          console.warn(
            "❌ Failed to copy to clipboard in content script:",
            err
          );
        });
      },
      args: [text],
    });
  });
};

// Initialize message router and register all handlers
export const setupHandlers = () => {
  registerMessage("desktop-capture", (message) => desktopCapture(message));
  registerMessage("backup-created", (message) =>
    offscreenDocument(message.request, message.tabId)
  );
  registerMessage("write-file", (message) => writeFile(message));
  registerMessage("handle-restart", (message) => handleRestart(message));
  registerMessage("handle-dismiss", (message) => handleDismiss(message));
  registerMessage("reset-active-tab", () => resetActiveTab(false));
  registerMessage("reset-active-tab-restart", (message) =>
    resetActiveTabRestart(message)
  );
  registerMessage("video-ready", (message) => videoReady(message));
  registerMessage("start-recording", (message) => startRecording(message));
  registerMessage("restarted", (message) => restartActiveTab(message));

  registerMessage("new-chunk", (message, sender, sendResponse) => {
    newChunk(message, sendResponse);
    return true;
  });

  registerMessage(
    "get-streaming-data",
    async (message, sender) => await handleGetStreamingData(message, sender)
  );
  registerMessage("cancel-recording", (message) => cancelRecording(message));
  registerMessage("stop-recording-tab", (message, sendResponse) => {
    handleStopRecordingTab(message);
    sendResponse({ ok: true });
    return true;
  });
  registerMessage("restart-recording-tab", (message) =>
    handleRestartRecordingTab(message)
  );
  registerMessage("dismiss-recording-tab", (message) =>
    handleDismissRecordingTab(message)
  );
  registerMessage("pause-recording-tab", () =>
    sendMessageRecord({ type: "pause-recording-tab" })
  );
  registerMessage("resume-recording-tab", () =>
    sendMessageRecord({ type: "resume-recording-tab" })
  );
  registerMessage("set-mic-active-tab", (message) => setMicActiveTab(message));
  registerMessage("recording-error", (message) =>
    handleRecordingError(message)
  );
  registerMessage("on-get-permissions", (message) =>
    handleOnGetPermissions(message)
  );
  registerMessage(
    "recording-complete",
    async (message, sender) => await handleRecordingComplete(message, sender)
  );
  registerMessage("check-recording", (message) => checkRecording(message));

  registerMessage("review-screenity", () =>
    createTab(
      "https://chrome.google.com/webstore/detail/screenity-screen-recorder/kbbdabhdfibnancpjfhlkhafgdilcnji/reviews",
      false,
      true
    )
  );
  registerMessage("follow-twitter", () =>
    createTab("https://alyssax.substack.com/", false, true)
  );
  registerMessage("pricing", () =>
    createTab("https://screenity.io/pro", false, true)
  );
  registerMessage("open-processing-info", () =>
    createTab(
      "https://help.screenity.io/editing-and-exporting/dJRFpGq56JFKC7k8zEvsqb/why-is-there-a-5-minute-limit-for-editing/ddy4e4TpbnrFJ8VoRT37tQ",
      true,
      true
    )
  );
  registerMessage("upgrade-info", () =>
    createTab(
      "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9",
      true,
      true
    )
  );
  registerMessage("trim-info", () =>
    createTab(
      "https://help.screenity.io/editing-and-exporting/dJRFpGq56JFKC7k8zEvsqb/how-to-cut-trim-or-mute-parts-of-your-video/svNbM7YHYY717MuSWXrKXH",
      true,
      true
    )
  );
  registerMessage("join-waitlist", () =>
    createTab("https://tally.so/r/npojNV", true, true)
  );
  registerMessage("chrome-update-info", () =>
    createTab(
      "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9",
      true,
      true
    )
  );
  registerMessage("set-surface", (message) => setSurface(message));
  registerMessage("pip-ended", () => handlePip(false));
  registerMessage("pip-started", () => handlePip(true));
  registerMessage("sign-out-drive", (message) => handleSignOutDrive(message));
  registerMessage("open-help", () =>
    createTab("https://help.screenity.io/", true, true)
  );
  registerMessage("memory-limit-help", () =>
    createTab(
      "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb",
      true,
      true
    )
  );
  registerMessage("open-home", () =>
    createTab("https://screenity.io/", false, true)
  );
  registerMessage("report-bug", () =>
    createTab(
      "https://tally.so/r/3ElpXq?version=" +
        chrome.runtime.getManifest().version,
      false,
      true
    )
  );
  registerMessage("clear-recordings", () => clearAllRecordings());
  registerMessage("force-processing", (message) => forceProcessing(message));
  registerMessage("focus-this-tab", (message, sender) =>
    focusTab(sender.tab.id)
  );
  registerMessage("stop-recording-tab-backup", (message) =>
    handleStopRecordingTabBackup(message)
  );
  registerMessage("indexed-db-download", (message) =>
    downloadIndexedDB(message)
  );
  registerMessage("get-platform-info", async () => await getPlatformInfo());
  registerMessage("restore-recording", (message) => restoreRecording(message));
  registerMessage("check-restore", async (message, sender, sendResponse) => {
    const response = await checkRestore();
    sendResponse(response);
    return true;
  });
  registerMessage(
    "check-capture-permissions",
    async (message, sender, sendResponse) => {
      const { isLoggedIn, isSubscribed } = message;

      const response = await checkCapturePermissions({
        isLoggedIn,
        isSubscribed,
      });

      sendResponse(response);
      return true;
    }
  );
  registerMessage("is-pinned", async () => await isPinned());
  registerMessage(
    "save-to-drive",
    async (message) => await handleSaveToDrive(message, false)
  );
  registerMessage(
    "save-to-drive-fallback",
    async (message) => await handleSaveToDrive(message, true)
  );
  registerMessage("request-download", (message) =>
    requestDownload(message.base64, message.title)
  );
  registerMessage("resize-window", (message) =>
    resizeWindow(message.width, message.height)
  );
  registerMessage("available-memory", async () => {
    return await checkAvailableMemory();
  });
  registerMessage("extension-media-permissions", () =>
    createTab(
      `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}`,
      false,
      true
    )
  );
  registerMessage("add-alarm-listener", (payload) => addAlarmListener(payload));
  registerMessage(
    "check-auth-status",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        sendResponse({
          authenticated: false,
          message: "Cloud features disabled",
        });
        return true;
      }
      const result = await loginWithWebsite();
      sendResponse(result);
      return true;
    }
  );
  registerMessage(
    "create-video-project",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        sendResponse({ success: false, message: "Cloud features disabled" });
        return true;
      }
      const { authenticated, subscribed, user } = await loginWithWebsite();

      if (!authenticated) {
        sendResponse({ success: false, message: "User not authenticated" });
        return true;
      }

      if (!subscribed) {
        sendResponse({ success: false, message: "Subscription inactive" });
        return true;
      }

      try {
        const res = await fetch(`${API_BASE}/videos/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await chrome.storage.local
              .get("screenityToken")
              .then((r) => r.screenityToken)}`,
          },
          body: JSON.stringify({
            title: message.title || "Untitled Recording",
            data: message.data || {},
            instantMode: message.instantMode || false,
            recording: true,
            isPublic: message.instantMode ? true : false,
          }),
        });

        const result = await res.json();

        if (!res.ok || !result?.videoId) {
          sendResponse({
            success: false,
            error: result?.error || "Server error",
          });
        } else {
          sendResponse({ success: true, videoId: result.videoId });
        }
      } catch (err) {
        console.error("❌ Failed to create video project:", err.message);
        sendResponse({ success: false, error: err.message });
      }

      return true;
    }
  );
  registerMessage("handle-login", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled, cannot handle login");
      return;
    }
    const currentTab = await getCurrentTab();

    if (currentTab?.id) {
      await chrome.storage.local.set({ originalTabId: currentTab.id });
    }
    chrome.tabs.create({
      url: `${process.env.SCREENITY_APP_BASE}/login?extension=true`,
      active: true,
    });
  });
  registerMessage("handle-logout", async (message, sender, sendResponse) => {
    if (!CLOUD_FEATURES_ENABLED) {
      sendResponse({ success: false, message: "Cloud features disabled" });
      return true;
    }
    await chrome.storage.local.remove([
      "screenityToken",
      "screenityUser",
      "lastAuthCheck",
      "isSubscribed",
      "isLoggedIn",
      "wasLoggedIn",
      "proSubscription",
    ]);

    sendResponse({ success: true });
    return true;
  });

  registerMessage("click-event", async ({ payload }, sender) => {
    if (!CLOUD_FEATURES_ENABLED) return;
    const { x, y, surface, region, isTab } = payload;
    const senderWindowId = sender.tab?.windowId;

    // Ask Recorder for current video time
    sendMessageRecord({ type: "get-video-time" }, (response) => {
      const videoTime = response?.videoTime ?? null;

      const baseClick = { x, y, surface, region, timestamp: videoTime };

      if (region || isTab) {
        storeClick(baseClick);
        return;
      }

      if (surface === "monitor" && typeof senderWindowId === "number") {
        chrome.windows.get(senderWindowId, (win) => {
          if (!win || chrome.runtime.lastError) {
            console.warn("Failed to get window for click");
            return;
          }

          chrome.system.display.getInfo((displays) => {
            const monitor = displays.find(
              (d) =>
                win.left >= d.bounds.left &&
                win.left < d.bounds.left + d.bounds.width &&
                win.top >= d.bounds.top &&
                win.top < d.bounds.top + d.bounds.height
            );

            if (!monitor) {
              console.warn("[click-event] No matching monitor found");
              return;
            }

            const screenX = win.left + x;
            const screenY = win.top + y;
            const adjX = screenX - monitor.bounds.left;
            const adjY = screenY - monitor.bounds.top;

            storeClick({ ...baseClick, x: adjX, y: adjY });
          });
        });
        return;
      }

      if (surface === "window" && typeof senderWindowId === "number") {
        chrome.windows.get(senderWindowId, (win) => {
          if (!win || chrome.runtime.lastError) {
            console.warn("Failed to get window for window click");
            return;
          }

          const screenX = win.left + x;
          const screenY = win.top + y;

          storeClick({ ...baseClick, x: screenX, y: screenY });
        });
        return;
      }

      storeClick(baseClick);
    });
  });

  function storeClick(click) {
    chrome.storage.local.get({ clickEvents: [] }, (data) => {
      chrome.storage.local.set({ clickEvents: [...data.clickEvents, click] });
    });
  }

  function getMonitorForWindow(message, sender, sendResponse) {
    chrome.system.display.getInfo((displays) => {
      chrome.windows.getCurrent((win) => {
        if (!win || chrome.runtime.lastError) {
          console.warn(
            "[get-monitor-for-window] No window found",
            chrome.runtime.lastError
          );
          sendResponse({ error: "No window found" });
          return;
        }

        const monitor = displays.find(
          (d) =>
            win.left >= d.bounds.left &&
            win.left < d.bounds.left + d.bounds.width &&
            win.top >= d.bounds.top &&
            win.top < d.bounds.top + d.bounds.height
        );

        if (!monitor) {
          console.warn("[get-monitor-for-window] No matching monitor");
          sendResponse({ error: "No matching monitor" });
        } else {
          // Save monitor info directly into chrome.storage.local
          chrome.storage.local.set(
            {
              displays,
              recordedMonitorId: monitor.id,
              monitorBounds: monitor.bounds,
            },
            () => {
              sendResponse({
                monitorId: monitor.id,
                monitorBounds: monitor.bounds,
                displays,
              });
            }
          );
        }
      });
    });

    return true;
  }

  registerMessage("get-monitor-for-window", getMonitorForWindow);

  registerMessage("fetch-videos", async (message, sender, sendResponse) => {
    if (!CLOUD_FEATURES_ENABLED) {
      sendResponse({ success: false, message: "Cloud features disabled" });
      return true;
    }
    const { authenticated, subscribed, user } = await loginWithWebsite();

    if (!authenticated) {
      sendResponse({ success: false, message: "User not authenticated" });
      return true;
    }

    if (!subscribed) {
      sendResponse({ success: false, message: "Subscription inactive" });
      return true;
    }

    try {
      const page = message.page || 0;
      const pageSize = message.pageSize || 12;
      const sort = message.sort || "newest";
      const filter = message.filter || "all";

      const token = await chrome.storage.local
        .get("screenityToken")
        .then((r) => r.screenityToken);

      const res = await fetch(
        `${API_BASE}/videos?page=${page}&pageSize=${pageSize}&sort=${sort}&filter=${filter}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );

      const result = await res.json();

      if (!res.ok || !result?.videos) {
        sendResponse({
          success: false,
          error: result?.error || "Failed to fetch videos",
        });
      } else {
        sendResponse({ success: true, videos: result.videos });
      }
    } catch (err) {
      console.error("❌ Failed to fetch videos:", err.message);
      sendResponse({ success: false, error: err.message });
    }

    return true;
  });
  registerMessage("reopen-popup-multi", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    try {
      const tab = await getCurrentTab();
      if (!tab?.id) {
        console.warn("No active tab found for popup reopen");
        return;
      }

      await sendMessageTab(tab.id, {
        type: "reopen-popup-multi",
      });
    } catch (err) {
      console.warn("Failed to send popup reopen message:", err);
    }
  });
  registerMessage(
    "check-storage-quota",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        sendResponse({ success: false, error: "Cloud features disabled" });
        return true;
      }
      const { authenticated, subscribed } = await loginWithWebsite();

      if (!authenticated) {
        sendResponse({ success: false, error: "Not authenticated" });
        return true;
      }

      if (!subscribed) {
        sendResponse({ success: false, error: "Subscription inactive" });
        return true;
      }

      try {
        const { screenityToken } = await chrome.storage.local.get(
          "screenityToken"
        );

        const res = await fetch(`${API_BASE}/storage/quota`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${screenityToken}`,
          },
          credentials: "include",
        });

        const result = await res.json();

        if (!res.ok) {
          sendResponse({
            success: false,
            error: result?.error || "Fetch failed",
          });
        } else {
          sendResponse({ success: true, ...result });
        }
      } catch (err) {
        console.error("❌ Error checking storage quota:", err);
        sendResponse({ success: false, error: err.message });
      }

      return true;
    }
  );
  registerMessage("time-warning", async (message) => {
    const tab = await getCurrentTab();
    if (tab?.id) {
      await sendMessageTab(tab.id, {
        type: "time-warning",
      }).catch((e) => console.warn("Failed to send time-warning to tab:", e));
    }
  });
  registerMessage("time-stopped", async (message) => {
    const tab = await getCurrentTab();
    if (tab?.id) {
      await sendMessageTab(tab.id, {
        type: "time-stopped",
      }).catch((e) => console.warn("Failed to send time-stopped to tab:", e));
    }
  });
  registerMessage("prepare-open-editor", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const createdTab = await createTab(message.url, true, true);
    chrome.storage.local.set({ editorTab: createdTab?.id || null });
  });
  registerMessage("prepare-editor-existing", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    let messageTab = null;

    if (message.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
    } else {
      const { editorTab } = await chrome.storage.local.get(["editorTab"]);
      messageTab = editorTab;
      focusTab(editorTab);
    }

    sendMessageTab(messageTab, {
      type: "update-project-loading",
      multiMode: message.multiMode,
    });
  });
  registerMessage("preparing-recording", async () => {
    const tab = await getCurrentTab();
    if (tab?.id) {
      await sendMessageTab(tab.id, {
        type: "preparing-recording",
      }).catch((e) =>
        console.warn("Failed to send preparing-recording to tab:", e)
      );
    }
  });
  registerMessage("editor-ready", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    let messageTab = null;
    const sceneId = message.sceneId || null;

    if (message.newProject) {
      const { editorTab } = await chrome.storage.local.get(["editorTab"]);
      messageTab = editorTab;

      chrome.runtime.sendMessage({ type: "turn-off-pip" });

      // FLAG: this should go here right?
      const res = await fetch(
        `${API_BASE}/videos/${message.projectId}/auto-publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await chrome.storage.local
              .get("screenityToken")
              .then((r) => r.screenityToken)}`,
          },
        }
      );

      if (editorTab) {
        focusTab(editorTab);
      }
    } else if (message.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
    } else {
      const { editorTab } = await chrome.storage.local.get(["editorTab"]);
      messageTab = editorTab;

      chrome.runtime.sendMessage({ type: "turn-off-pip" });

      if (editorTab) {
        focusTab(editorTab);
      }
    }

    // Only copy once if there's a publicUrl
    if (message.publicUrl) {
      copyToClipboard(message.publicUrl);
    }

    if (messageTab) {
      sendMessageTab(messageTab, {
        type: "update-project-ready",
        share: Boolean(message.publicUrl),
        newProject: Boolean(message.newProject),
        sceneId: sceneId,
      });
    } else {
      console.warn("❗ No valid messageTab found in editor-ready");
    }
  });
  registerMessage("finish-multi-recording", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    try {
      const { recordingToScene } = await chrome.storage.local.get([
        "recordingToScene",
      ]);

      if (!recordingToScene) {
        const { multiProjectId } = await chrome.storage.local.get([
          "multiProjectId",
        ]);

        if (!multiProjectId) {
          console.warn("No project ID found for finishing multi recording.");
          return;
        }

        const res = await fetch(
          `${API_BASE}/videos/${multiProjectId}/auto-publish`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await chrome.storage.local
                .get("screenityToken")
                .then((r) => r.screenityToken)}`,
            },
          }
        );

        const url = `${process.env.SCREENITY_APP_BASE}/editor/${multiProjectId}/edit?share=true`;
        const publicUrl = `${process.env.SCREENITY_APP_BASE}/view/${multiProjectId}/`;

        // Open the editor directly
        createTab(url, true, true).then(() => {
          if (publicUrl) {
            copyToClipboard(publicUrl);
            chrome.runtime.sendMessage({
              type: "show-toast",
              message: "Public video link copied to clipboard!",
            });
          }
        });
      } else {
        // Multi recording on existing project
        const { editorTab } = await chrome.storage.local.get(["editorTab"]);
        // check if editor tab is valid, if so focus to it, otherwise use active tab
        if (editorTab) {
          focusTab(editorTab);
          sendMessageTab(editorTab, {
            type: "update-project-ready",
            share: false,
            newProject: false,
          });
        } else {
          const activeTab = (await getCurrentTab())?.id || null;
          if (activeTab) {
            focusTab(activeTab);
            sendMessageTab(activeTab, {
              type: "update-project-ready",
              share: false,
              newProject: false,
            });
          }
        }

        chrome.storage.local.set({
          recordingProjectTitle: "",
          projectId: null,
          activeSceneId: null,
          recordingToScene: false,
          multiMode: false,
          multiProjectId: null,
          editorTab: null,
        });

        const tab = await getCurrentTab();
        if (tab?.id) {
          sendMessageTab(tab.id, {
            type: "clear-recordings",
          });
        }
      }

      // Reset multi-mode state
      await chrome.storage.local.set({
        multiMode: false,
        multiSceneCount: 0,
        multiProjectId: null,
      });
    } catch (err) {
      console.error("Failed to finalize multi recording:", err);
    }
  });
  registerMessage("handle-reactivate", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }

    chrome.tabs.create({
      url: `${process.env.SCREENITY_APP_BASE}/reactivate`,
      active: true,
    });
  });
  registerMessage("handle-upgrade", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }

    chrome.tabs.create({
      url: `${process.env.SCREENITY_APP_BASE}/upgrade`,
      active: true,
    });
  });
  registerMessage("open-account-settings", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const { authenticated } = await loginWithWebsite();
    if (!authenticated) {
      console.warn("User not authenticated, cannot open account settings");
      return;
    }

    const url = `${process.env.SCREENITY_APP_BASE}/?settings=open`;
    createTab(url, true, true);
  });
  registerMessage("open-support", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const { authenticated, user } = await loginWithWebsite();
    if (!authenticated || !user) {
      console.warn("User not authenticated, cannot open support");
      return;
    }

    const { name, email } = user;
    const query = new URLSearchParams({
      extension: "true",
      name,
      email,
    });

    const url = `https://tally.so/r/310MNg?${query.toString()}`;
    createTab(url, true, true);
  });
  registerMessage("check-banner-support", async (message, sendResponse) => {
    const { bannerSupport } = await chrome.storage.local.get(["bannerSupport"]);
    sendResponse({ bannerSupport: Boolean(bannerSupport) });
    return true;
  });
  registerMessage("hide-banner", async () => {
    await chrome.storage.local.set({ bannerSupport: false });
    chrome.runtime.sendMessage({ type: "hide-banner" });
  });
  registerMessage("clear-recording-alarm", async () => {
    await chrome.alarms.clear("recording-alarm");
  });
  registerMessage("refresh-auth", async () => {
    if (!CLOUD_FEATURES_ENABLED)
      return { success: false, message: "Cloud features disabled" };
    return await loginWithWebsite();
  });
  registerMessage("sync-recording-state", async (message, sendResponse) => {
    const { recording, paused, recordingStartTime, pendingRecording } =
      await chrome.storage.local.get([
        "recording",
        "paused",
        "recordingStartTime",
        "pendingRecording",
      ]);
    sendResponse({
      recording: Boolean(recording),
      paused: Boolean(paused),
      recordingStartTime: recordingStartTime || null,
      pendingRecording: Boolean(pendingRecording),
    });
    return true;
  });
};
