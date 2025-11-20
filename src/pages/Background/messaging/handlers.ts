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
import type {
  SaveToDriveMessage,
  RequestDownloadMessage,
  SetMicActiveMessage,
  SetSurfaceMessage,
  ResizeWindowMessage,
  CheckCapturePermissionsMessage,
  EditorReadyMessage,
  FinishMultiRecordingMessage,
  CreateVideoProjectMessage,
  BackupCreatedMessage,
  ExtensionMessage,
  PrepareOpenEditorMessage,
  PrepareEditorExistingMessage,
  ClickEventMessage,
  FetchVideosMessage,
  WriteFileMessage,
  RecordingErrorMessage,
  OnGetPermissionsMessage,
} from "../../../types/messaging";
import type { SaveToDriveRequest } from "../../../types/drive";
import type { StorageData } from "../../../types/storage";
import type { ClickEvent } from "../../../types/storage";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const copyToClipboard = (text: string): void => {
  if (!text) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || !tabs[0].id) return;
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
  registerMessage("backup-created", (message) => {
    const backupMessage = message as BackupCreatedMessage;
    offscreenDocument(backupMessage.request, backupMessage.tabId);
  });
  registerMessage("write-file", (message) =>
    writeFile(message as WriteFileMessage)
  );
  registerMessage("handle-restart", () => handleRestart());
  registerMessage("handle-dismiss", () => handleDismiss());
  registerMessage("reset-active-tab", () => resetActiveTab(false));
  registerMessage("reset-active-tab-restart", () => resetActiveTabRestart());
  registerMessage("video-ready", () => videoReady());
  registerMessage("start-recording", () => startRecording());
  registerMessage("restarted", () => restartActiveTab());

  registerMessage("new-chunk", (message, sender, sendResponse) => {
    newChunk(message, sender, sendResponse);
    return true;
  });

  registerMessage(
    "get-streaming-data",
    async () => await handleGetStreamingData()
  );
  registerMessage("cancel-recording", () => cancelRecording());
  registerMessage("stop-recording-tab", (message, sender, sendResponse) => {
    handleStopRecordingTab(message);
    if (sendResponse) {
      sendResponse({ ok: true });
    }
    return true;
  });
  registerMessage("restart-recording-tab", (message) =>
    handleRestartRecordingTab(message)
  );
  registerMessage("dismiss-recording-tab", () => handleDismissRecordingTab());
  registerMessage("pause-recording-tab", () =>
    sendMessageRecord({ type: "pause-recording-tab" })
  );
  registerMessage("resume-recording-tab", () =>
    sendMessageRecord({ type: "resume-recording-tab" })
  );
  registerMessage("set-mic-active-tab", (message) => {
    const micMessage = message as SetMicActiveMessage;
    setMicActiveTab(micMessage);
  });
  registerMessage("recording-error", (message) =>
    handleRecordingError(message as RecordingErrorMessage)
  );
  registerMessage("on-get-permissions", (message) =>
    handleOnGetPermissions(message as OnGetPermissionsMessage)
  );
  registerMessage(
    "recording-complete",
    async () => await handleRecordingComplete()
  );
  registerMessage("check-recording", () => checkRecording());

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
  registerMessage("set-surface", (message) => {
    const surfaceMessage = message as SetSurfaceMessage;
    setSurface(surfaceMessage);
  });
  registerMessage("pip-ended", () => handlePip(false));
  registerMessage("pip-started", () => handlePip(true));
  registerMessage("sign-out-drive", () => handleSignOutDrive());
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
  registerMessage("force-processing", () => forceProcessing());
  registerMessage("focus-this-tab", (message, sender) => {
    if (sender.tab?.id) {
      focusTab(sender.tab.id);
    }
  });
  registerMessage("stop-recording-tab-backup", (message) =>
    handleStopRecordingTabBackup(message)
  );
  registerMessage("indexed-db-download", () => downloadIndexedDB());
  registerMessage("get-platform-info", async () => await getPlatformInfo());
  registerMessage("restore-recording", () => restoreRecording());
  registerMessage("check-restore", async (message, sender, sendResponse) => {
    const response = await checkRestore();
    sendResponse(response);
    return true;
  });
  registerMessage(
    "check-capture-permissions",
    async (message, sender, sendResponse) => {
      const permMessage = message as CheckCapturePermissionsMessage;
      const response = await checkCapturePermissions({
        isLoggedIn: permMessage.isLoggedIn,
        isSubscribed: permMessage.isSubscribed,
      });

      if (sendResponse) {
        sendResponse(response);
      }
      return true;
    }
  );
  registerMessage("is-pinned", async () => await isPinned());
  registerMessage("save-to-drive", async (message) => {
    const driveMessage = message as SaveToDriveMessage;
    const request: SaveToDriveRequest = {
      base64: driveMessage.base64,
      title: driveMessage.title,
    };
    await handleSaveToDrive(request, false);
  });
  registerMessage("save-to-drive-fallback", async (message) => {
    const driveMessage = message as SaveToDriveMessage;
    const request: SaveToDriveRequest = {
      base64: driveMessage.base64,
      title: driveMessage.title,
    };
    await handleSaveToDrive(request, true);
  });
  registerMessage("request-download", (message) => {
    const downloadMessage = message as RequestDownloadMessage;
    requestDownload(downloadMessage.base64, downloadMessage.title);
  });
  registerMessage("resize-window", (message) => {
    const resizeMessage = message as ResizeWindowMessage;
    resizeWindow(resizeMessage.width, resizeMessage.height);
  });
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
  registerMessage("add-alarm-listener", () => addAlarmListener());
  registerMessage(
    "check-auth-status",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        if (sendResponse) {
          sendResponse({
            authenticated: false,
            message: "Cloud features disabled",
          });
        }
        return true;
      }
      const result = await loginWithWebsite();
      if (sendResponse) {
        sendResponse(result);
      }
      return true;
    }
  );
  registerMessage(
    "create-video-project",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        if (sendResponse) {
          sendResponse({ success: false, message: "Cloud features disabled" });
        }
        return true;
      }
      const { authenticated, subscribed, user } = await loginWithWebsite();

      if (!authenticated) {
        if (sendResponse) {
          sendResponse({ success: false, message: "User not authenticated" });
        }
        return true;
      }

      if (!subscribed) {
        if (sendResponse) {
          sendResponse({ success: false, message: "Subscription inactive" });
        }
        return true;
      }

      try {
        const projectMessage = message as CreateVideoProjectMessage;
        const tokenResult = await chrome.storage.local.get("screenityToken");
        const screenityToken = tokenResult.screenityToken as string | undefined;

        if (!screenityToken) {
          if (sendResponse) {
            sendResponse({ success: false, error: "No authentication token" });
          }
          return true;
        }

        const res = await fetch(`${API_BASE}/videos/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${screenityToken}`,
          },
          body: JSON.stringify({
            title: projectMessage.title || "Untitled Recording",
            data:
              (projectMessage as ExtensionMessage & { data?: unknown }).data ||
              {},
            instantMode: projectMessage.instantMode || false,
            recording: true,
            isPublic: projectMessage.instantMode ? true : false,
          }),
        });

        const result = await res.json();

        if (!res.ok || !result?.videoId) {
          if (sendResponse) {
            sendResponse({
              success: false,
              error: result?.error || "Server error",
            });
          }
        } else {
          if (sendResponse) {
            sendResponse({ success: true, videoId: result.videoId });
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("❌ Failed to create video project:", error.message);
        if (sendResponse) {
          sendResponse({ success: false, error: error.message });
        }
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

  registerMessage("click-event", async (message, sender) => {
    if (!CLOUD_FEATURES_ENABLED) return;
    const clickMessage = message as ClickEventMessage;
    const { x, y, surface, region, isTab } = clickMessage.payload;
    const senderWindowId = sender.tab?.windowId;

    // Ask Recorder for current video time
    sendMessageRecord(
      { type: "get-video-time" },
      (response: { videoTime?: number } | undefined) => {
        const videoTime = response?.videoTime ?? null;

        const baseClick: ClickEvent = {
          x,
          y,
          surface,
          region: region || false,
          timestamp: videoTime || 0,
        };

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
                  win.left !== undefined &&
                  win.top !== undefined &&
                  win.left >= d.bounds.left &&
                  win.left < d.bounds.left + d.bounds.width &&
                  win.top >= d.bounds.top &&
                  win.top < d.bounds.top + d.bounds.height
              );

              if (!monitor) {
                console.warn("[click-event] No matching monitor found");
                return;
              }

              const screenX = (win.left ?? 0) + x;
              const screenY = (win.top ?? 0) + y;
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

            const screenX = (win.left ?? 0) + x;
            const screenY = (win.top ?? 0) + y;

            storeClick({ ...baseClick, x: screenX, y: screenY } as ClickEvent);
          });
          return;
        }

        storeClick(baseClick);
      }
    );
  });

  function storeClick(click: ClickEvent): void {
    chrome.storage.local.get({ clickEvents: [] }, (data: StorageData) => {
      const clickEvents = (data.clickEvents || []) as ClickEvent[];
      chrome.storage.local.set({ clickEvents: [...clickEvents, click] });
    });
  }

  function getMonitorForWindow(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: {
      monitorId?: string;
      monitorBounds?: chrome.system.display.Bounds;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      displays?: any[];
      error?: string;
    }) => void
  ): void {
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
            win.left !== undefined &&
            win.top !== undefined &&
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
  }

  registerMessage("get-monitor-for-window", getMonitorForWindow);

  registerMessage("fetch-videos", async (message, sender, sendResponse) => {
    if (!CLOUD_FEATURES_ENABLED) {
      if (sendResponse) {
        sendResponse({ success: false, message: "Cloud features disabled" });
      }
      return true;
    }
    const { authenticated, subscribed, user } = await loginWithWebsite();

    if (!authenticated) {
      if (sendResponse) {
        sendResponse({ success: false, message: "User not authenticated" });
      }
      return true;
    }

    if (!subscribed) {
      if (sendResponse) {
        sendResponse({ success: false, message: "Subscription inactive" });
      }
      return true;
    }

    try {
      const fetchMessage = message as FetchVideosMessage;
      const page = fetchMessage.page || 0;
      const pageSize = fetchMessage.pageSize || 12;
      const sort = fetchMessage.sort || "newest";
      const filter = fetchMessage.filter || "all";

      const tokenResult = await chrome.storage.local.get("screenityToken");
      const token = tokenResult.screenityToken as string | undefined;

      if (!token) {
        if (sendResponse) {
          sendResponse({ success: false, message: "No authentication token" });
        }
        return true;
      }

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
        if (sendResponse) {
          sendResponse({
            success: false,
            error: result?.error || "Failed to fetch videos",
          });
        }
      } else {
        if (sendResponse) {
          sendResponse({ success: true, videos: result.videos });
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("❌ Failed to fetch videos:", error.message);
      if (sendResponse) {
        sendResponse({ success: false, error: error.message });
      }
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
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("❌ Error checking storage quota:", error);
        sendResponse({ success: false, error: error.message });
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
    const editorMessage = message as PrepareOpenEditorMessage;
    const createdTab = await createTab(editorMessage.url, true, true);
    chrome.storage.local.set({ editorTab: createdTab?.id || null });
  });
  registerMessage("prepare-editor-existing", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const existingMessage = message as PrepareEditorExistingMessage;
    let messageTab: number | null = null;

    if (existingMessage.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
    } else {
      const result = await chrome.storage.local.get(["editorTab"]);
      const editorTab = result.editorTab as number | undefined;
      messageTab = editorTab || null;
      if (editorTab) {
        focusTab(editorTab);
      }
    }

    if (messageTab) {
      sendMessageTab(messageTab, {
        type: "update-project-loading",
        multiMode: existingMessage.multiMode,
      });
    }
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
    const editorMessage = message as EditorReadyMessage;
    let messageTab: number | null = null;
    const sceneId = editorMessage.sceneId || null;

    const extendedMessage = editorMessage as EditorReadyMessage & {
      newProject?: boolean;
      projectId?: string;
      publicUrl?: string;
    };

    if (extendedMessage.newProject) {
      const result = await chrome.storage.local.get(["editorTab"]);
      const editorTab = result.editorTab as number | undefined;
      messageTab = editorTab || null;

      chrome.runtime.sendMessage({ type: "turn-off-pip" });

      // FLAG: this should go here right?
      if (extendedMessage.projectId) {
        const tokenResult = await chrome.storage.local.get("screenityToken");
        const screenityToken = tokenResult.screenityToken as string | undefined;

        if (screenityToken) {
          const res = await fetch(
            `${API_BASE}/videos/${extendedMessage.projectId}/auto-publish`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${screenityToken}`,
              },
            }
          );
        }
      }

      if (editorTab && typeof editorTab === "number") {
        focusTab(editorTab);
      }
    } else if (editorMessage.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
    } else {
      const result = await chrome.storage.local.get(["editorTab"]);
      const editorTab = result.editorTab as number | undefined;
      messageTab = editorTab || null;

      chrome.runtime.sendMessage({ type: "turn-off-pip" });

      if (editorTab) {
        focusTab(editorTab);
      }
    }

    // Only copy once if there's a publicUrl
    if (extendedMessage.publicUrl) {
      copyToClipboard(extendedMessage.publicUrl);
    }

    if (messageTab && typeof messageTab === "number") {
      sendMessageTab(messageTab, {
        type: "update-project-ready",
        share: Boolean(extendedMessage.publicUrl),
        newProject: Boolean(extendedMessage.newProject),
        sceneId: sceneId,
      });
    } else {
      console.warn("❗ No valid messageTab found in editor-ready");
    }
  });
  registerMessage("finish-multi-recording", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const finishMessage = message as FinishMultiRecordingMessage;
    try {
      const result = await chrome.storage.local.get(["recordingToScene"]);
      const recordingToScene = result.recordingToScene as boolean | undefined;

      if (!recordingToScene) {
        const projectResult = await chrome.storage.local.get([
          "multiProjectId",
        ]);
        const multiProjectId = projectResult.multiProjectId as
          | string
          | undefined;

        if (!multiProjectId) {
          console.warn("No project ID found for finishing multi recording.");
          return;
        }

        const tokenResult = await chrome.storage.local.get("screenityToken");
        const screenityToken = tokenResult.screenityToken as string | undefined;

        if (screenityToken) {
          const res = await fetch(
            `${API_BASE}/videos/${multiProjectId}/auto-publish`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${screenityToken}`,
              },
            }
          );
        }

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
        const result = await chrome.storage.local.get(["editorTab"]);
        const editorTab = result.editorTab as number | undefined;
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
  registerMessage(
    "check-banner-support",
    async (message, sender, sendResponse) => {
      const result = await chrome.storage.local.get(["bannerSupport"]);
      const bannerSupport = result.bannerSupport as boolean | undefined;
      if (sendResponse) {
        sendResponse({ bannerSupport: Boolean(bannerSupport) });
      }
      return true;
    }
  );
  registerMessage("hide-banner", async () => {
    await chrome.storage.local.set({ bannerSupport: false });
    chrome.runtime.sendMessage({ type: "hide-banner" });
  });
  registerMessage("clear-recording-alarm", async () => {
    await chrome.alarms.clear("recording-alarm");
  });
  registerMessage("refresh-auth", async (message, sender, sendResponse) => {
    if (!CLOUD_FEATURES_ENABLED) {
      if (sendResponse) {
        sendResponse({ success: false, message: "Cloud features disabled" });
      }
      return;
    }
    const result = await loginWithWebsite();
    if (sendResponse) {
      sendResponse(result);
    }
  });
  registerMessage(
    "sync-recording-state",
    async (message, sender, sendResponse) => {
      const result = await chrome.storage.local.get([
        "recording",
        "paused",
        "recordingStartTime",
        "pendingRecording",
      ]);
      const recording = result.recording as boolean | undefined;
      const paused = result.paused as boolean | undefined;
      const recordingStartTime = result.recordingStartTime as
        | number
        | undefined;
      const pendingRecording = result.pendingRecording as boolean | undefined;

      if (sendResponse && typeof sendResponse === "function") {
        sendResponse({
          recording: Boolean(recording),
          paused: Boolean(paused),
          recordingStartTime: recordingStartTime || null,
          pendingRecording: Boolean(pendingRecording),
        });
      }
      return true;
    }
  );
};
