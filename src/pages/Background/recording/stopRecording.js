import { focusTab, sendMessageTab } from "../tabManagement/";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { sendMessageRecord } from "./sendMessageRecord";
import { sendChunks } from "./sendChunks";
import { waitForContentScript } from "../utils/waitForContentScript";
import { diagEvent, endDiagSession } from "../../utils/diagnosticLog";
import { perfMark, perfSpan } from "../../utils/perfMarks";

// resolves via onReady, onTimeout (30s), or onClosed
const onTabLoaded = (tabId, onReady, onTimeout = null, onClosed = null) => {
  let cleared = false;
  const cleanup = () => {
    if (cleared) return;
    cleared = true;
    chrome.tabs.onUpdated.removeListener(updateListener);
    chrome.tabs.onRemoved.removeListener(removeListener);
    if (safetyTimer) clearTimeout(safetyTimer);
  };
  const updateListener = (changedTabId, changeInfo) => {
    if (changedTabId === tabId && changeInfo.status === "complete") {
      cleanup();
      onReady();
    }
  };
  const removeListener = (removedTabId) => {
    if (removedTabId === tabId) {
      cleanup();
      if (typeof onClosed === "function") onClosed();
    }
  };
  const safetyTimer = setTimeout(() => {
    cleanup();
    if (typeof onTimeout === "function") onTimeout();
  }, 30000);
  chrome.tabs.onUpdated.addListener(updateListener);
  chrome.tabs.onRemoved.addListener(removeListener);
};

// persistent flag so an editor mounting AFTER the failure still picks it up
const markEditorStartFailed = async (tabId, errorCode, why) => {
  diagEvent("editor-start-failed", { tabId, errorCode, why });
  try {
    await chrome.storage.local.set({
      editorRecordingError: {
        ts: Date.now(),
        sandboxTab: Number.isInteger(tabId) ? tabId : null,
        error: "editor-start-failed",
        why: why || null,
        errorCode,
      },
    });
  } catch {}
};

const acquirePostStopEditorLock = async (recordingId = null) => {
  const { postStopEditorOpening } = await chrome.storage.local.get([
    "postStopEditorOpening",
  ]);
  if (postStopEditorOpening) return false;
  await chrome.storage.local.set({
    postStopEditorOpening: true,
    postStopEditorOpened: true,
    postStopRecordingId: recordingId,
  });
  return true;
};

const releasePostStopEditorLock = async (overrides = {}) => {
  // keep postStopEditorOpened=true so later stopRecording() can detect the duplicate
  await chrome.storage.local.set({
    postStopEditorOpening: false,
    ...overrides,
  });
};

const handleEditorOpenFailed = async (editorUrl, lastError) => {
  diagEvent("editor-open-failed", {
    editorUrl,
    lastError: lastError || "tab-create-failed",
  });
  await chrome.storage.local.set({
    editorRecoveryUrl: editorUrl,
    editorRecoveryAt: Date.now(),
  });
  try {
    const { activeTab } = await chrome.storage.local.get(["activeTab"]);
    if (activeTab) {
      sendMessageTab(activeTab, {
        type: "show-toast",
        message: chrome.i18n.getMessage("editorRecoveryToast"),
        timeout: 12000,
      }).catch(() => {});
    }
  } catch (_) {}
};

export const stopRecording = async () => {
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  // await the clear so a quick subsequent restart can't race startRecording's gate
  await chrome.storage.local.set({ restarting: false });
  const { recordingStartTime, isSubscribed, paused, pausedAt, totalPausedMs, recordingDuration: storedDuration } =
    await chrome.storage.local.get([
      "recordingStartTime",
      "isSubscribed",
      "paused",
      "pausedAt",
      "totalPausedMs",
      "recordingDuration",
    ]);

  const startTime = Number(recordingStartTime);
  const now = Date.now();
  const basePaused = Number(totalPausedMs) || 0;
  const pausedAtMs = Number(pausedAt);
  const extraPaused =
    paused && Number.isFinite(pausedAtMs) && pausedAtMs > 0
      ? Math.max(0, now - pausedAtMs)
      : 0;

  let duration =
    Number.isFinite(startTime) && startTime > 0
      ? Math.max(0, now - startTime - basePaused - extraPaused)
      : 0;

  // recorder clears recordingStartTime before stopRecording runs via videoReady;
  // computed duration can be 0 for valid recordings, fall back to stored
  if (duration === 0 && Number(storedDuration) > 0) {
    duration = Number(storedDuration);
  }
  const maxDuration = 7 * 60 * 1000;

  diagEvent("stop", { duration, isSubscribed: Boolean(isSubscribed) });

  // single batched write; splitting risks partial cleanup on storage failure
  await chrome.storage.local.set({
    recording: false,
    recordingDuration: duration,
    tabRecordedID: null,
    offscreen: false,
    region: false,
    customRegion: false,
    recordingUiTabId: null,
    pipForceClose: Date.now(),
    recordingStartTime: 0,
  });

  const {
    fastRecorderInUse,
    fastRecorderActiveRecordingId,
    fastRecorderValidation,
    lastRecordingBackendRef,
  } = await chrome.storage.local.get([
    "fastRecorderInUse",
    "fastRecorderActiveRecordingId",
    "fastRecorderValidation",
    "lastRecordingBackendRef",
  ]);
  const validation =
    fastRecorderValidation && typeof fastRecorderValidation === "object"
      ? fastRecorderValidation
      : null;
  const validationMatches =
    validation?.details?.recordingId &&
    validation.details.recordingId === fastRecorderActiveRecordingId;
  const hardFailForCurrent = Boolean(validationMatches && validation?.hardFail);
  // Route by where the bytes actually live: editor.html is sandboxed and
  // can't read OPFS, so OPFS-backed recordings MUST go to editorwebcodecs.html
  // regardless of which encoder produced them. fastRecorderInUse is the encoder
  // flag, not a storage flag, and the two can diverge on probe/validation
  // fallback. Backend is ground truth.
  const bytesInOpfs = lastRecordingBackendRef?.backend === "opfs";
  const hasWebCodecs = bytesInOpfs;
  diagEvent("editor-route-decision", {
    backend: lastRecordingBackendRef?.backend || null,
    fastRecorderInUse: Boolean(fastRecorderInUse),
    hardFailForCurrent,
    route: hasWebCodecs ? "webcodecs" : "ffmpeg",
  });

  const {
    postStopEditorOpened,
    postStopEditorOpening,
    sandboxTab,
    postStopRecordingId,
    recordingTab,
  } = await chrome.storage.local.get([
    "postStopEditorOpened",
    "postStopEditorOpening",
    "sandboxTab",
    "postStopRecordingId",
    "recordingTab",
  ]);

  // snapshot for handleRecordingComplete; live recordingTab may belong to a new session by then
  if (recordingTab) {
    chrome.storage.local.set({ completingRecordingTab: recordingTab });
  }

  if (isSubscribed) {
    chrome.alarms.clear("recording-alarm");
    discardOffscreenDocuments();
    chrome.storage.local.remove(["recordingMeta"]);
  } else if (postStopEditorOpening || postStopEditorOpened) {
    // editor already opened by stop-recording-tab flow; avoid duplicate
  } else if (hasWebCodecs) {
    diagEvent("editor-open", { type: "editorwebcodecs" });
    const query = postStopRecordingId
      ? `?mode=postStop&recordingId=${encodeURIComponent(postStopRecordingId)}`
      : "?mode=postStop";
    const wcUrl = `editorwebcodecs.html${query}`;
    chrome.tabs.create(
      { url: wcUrl, active: true },
      (tab) => {
        if (chrome.runtime.lastError || !tab?.id) {
          handleEditorOpenFailed(wcUrl, chrome.runtime.lastError?.message);
          return;
        }
        onTabLoaded(
          tab.id,
          async () => {
            chrome.storage.local.set({ sandboxTab: tab.id });
            try {
              await waitForContentScript(tab.id);
            } catch (err) {
              console.error("❌ waitForContentScript timed out:", err);
              await markEditorStartFailed(
                tab.id,
                "EDITOR_CONTENT_SCRIPT_TIMEOUT",
                String(err?.message || err).slice(0, 200),
              );
              return;
            }
            try {
              await sendMessageTab(tab.id, { type: "fallback-recording" });
            } catch (err) {
              console.error("❌ Failed to send fallback-recording:", err);
              await markEditorStartFailed(
                tab.id,
                "EDITOR_MESSAGE_DELIVERY_FAILED",
                String(err?.message || err).slice(0, 200),
              );
            }
          },
          () =>
            markEditorStartFailed(
              tab.id,
              "EDITOR_TAB_LOAD_TIMEOUT",
              "editor tab never reached status=complete within 30s",
            ),
        );
      },
    );

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else if (duration > maxDuration) {
    diagEvent("editor-open", { type: "editorviewer", duration });
    // Fallback for large recordings without WebCodecs - use viewer mode

    const query = postStopRecordingId
      ? `?mode=postStop&recordingId=${encodeURIComponent(postStopRecordingId)}`
      : "?mode=postStop";
    const viewerUrl = `editorviewer.html${query}`;
    chrome.tabs.create(
      { url: viewerUrl, active: true },
      (tab) => {
        if (chrome.runtime.lastError || !tab?.id) {
          handleEditorOpenFailed(viewerUrl, chrome.runtime.lastError?.message);
          return;
        }
        onTabLoaded(
          tab.id,
          async () => {
            chrome.storage.local.set({ sandboxTab: tab.id });
            try {
              await waitForContentScript(tab.id);
            } catch (err) {
              console.error("❌ waitForContentScript timed out:", err);
              await markEditorStartFailed(
                tab.id,
                "EDITOR_CONTENT_SCRIPT_TIMEOUT",
                String(err?.message || err).slice(0, 200),
              );
              return;
            }
            try {
              await sendMessageTab(tab.id, { type: "viewer-recording" });
            } catch (err) {
              console.error("❌ Failed to send viewer-recording:", err);
              await markEditorStartFailed(
                tab.id,
                "EDITOR_MESSAGE_DELIVERY_FAILED",
                String(err?.message || err).slice(0, 200),
              );
            }
          },
          () =>
            markEditorStartFailed(
              tab.id,
              "EDITOR_TAB_LOAD_TIMEOUT",
              "editor tab never reached status=complete within 30s",
            ),
        );
      },
    );

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } else {
    diagEvent("editor-open", { type: "editor-ffmpeg" });
    const query = postStopRecordingId
      ? `?mode=postStop&recordingId=${encodeURIComponent(postStopRecordingId)}`
      : "?mode=postStop";
    const ffmpegUrl = `editor.html${query}`;
    chrome.tabs.create({ url: ffmpegUrl, active: true }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        handleEditorOpenFailed(ffmpegUrl, chrome.runtime.lastError?.message);
        return;
      }
      onTabLoaded(
        tab.id,
        async () => {
          chrome.storage.local.set({ sandboxTab: tab.id });
          try {
            await waitForContentScript(tab.id);
          } catch (err) {
            console.error("❌ waitForContentScript timed out:", err);
            await markEditorStartFailed(
              tab.id,
              "EDITOR_CONTENT_SCRIPT_TIMEOUT",
              String(err?.message || err).slice(0, 200),
            );
            return;
          }
          try {
            await sendMessageTab(tab.id, { type: "fallback-recording" });
          } catch (err) {
            console.error("❌ Failed to send fallback-recording:", err);
            await markEditorStartFailed(
              tab.id,
              "EDITOR_MESSAGE_DELIVERY_FAILED",
              String(err?.message || err).slice(0, 200),
            );
          }
        },
        () =>
          markEditorStartFailed(
            tab.id,
            "EDITOR_TAB_LOAD_TIMEOUT",
            "editor tab never reached status=complete within 30s",
          ),
      );
    });

    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  }

  // Hold the diag session open until editorReadyAt lands or 90s passes
  // so sandbox-side events from the editor load make it into the zip.
  // Closing here used to drop everything past stop+~17ms.
  // never clear recordingTab here; cleanup runs in handleRecordingComplete /
  // onTabRemoved / openRecorderTab safety net
  (async () => {
    const SESSION_DEFER_TIMEOUT_MS = 90_000;
    const POLL_INTERVAL_MS = 500;
    // Snapshot baseline so a stale editorReadyAt from a prior session
    // doesn't immediately satisfy the wait.
    const baseline = await chrome.storage.local
      .get(["editorReadyAt"])
      .catch(() => ({}));
    const baselineAt = baseline?.editorReadyAt || 0;
    const start = Date.now();
    while (Date.now() - start < SESSION_DEFER_TIMEOUT_MS) {
      try {
        const r = await chrome.storage.local.get([
          "editorReadyAt",
          "editorRecordingError",
        ]);
        const readyAt = r?.editorReadyAt || 0;
        if (readyAt > baselineAt) {
          diagEvent("session-deferred-end", {
            reason: "editor-ready",
            waitedMs: Date.now() - start,
          });
          break;
        }
        if (r?.editorRecordingError) {
          diagEvent("session-deferred-end", {
            reason: "editor-error",
            waitedMs: Date.now() - start,
          });
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    if (Date.now() - start >= SESSION_DEFER_TIMEOUT_MS) {
      diagEvent("session-deferred-end", {
        reason: "timeout",
        waitedMs: SESSION_DEFER_TIMEOUT_MS,
      });
    }
    endDiagSession("ok");
  })();

  const { wasRegion } = await chrome.storage.local.get(["wasRegion"]);
  if (wasRegion) {
    chrome.storage.local.set({ wasRegion: false, region: true });
  }

  // releasePostStopEditorLock preserves this for duplicate detection; clear here
  chrome.storage.local.set({ postStopEditorOpened: false });

  chrome.alarms.clear("recording-alarm");
  discardOffscreenDocuments();
};

export const handleStopRecordingTab = async (request) => {
  perfMark("BG.stopRecording handleStopRecordingTab.enter", {
    reason: request?.reason || null,
    memoryError: Boolean(request?.memoryError),
  });
  chrome.action.setIcon({ path: "assets/icon-34.png" });
  if (request.memoryError) {
    diagEvent("error", {
      type: "memory-error",
      reason: request.reason || null,
      savedChunks: request.savedChunks ?? null,
    });
    chrome.storage.local.set({
      recording: false,
      restarting: false,
      tabRecordedID: null,
      memoryError: true,
    });
  }

  // batched: each unbatched get adds ~1s when storage queue backs up during stop
  const endStorageGet1 = perfSpan("BG.stopRecording storage-get-batch");
  const {
    isSubscribed,
    recordingStartTime,
    paused,
    pausedAt,
    totalPausedMs,
    fastRecorderInUse,
    fastRecorderActiveRecordingId,
    lastRecordingBackendRef,
  } = await chrome.storage.local.get([
    "isSubscribed",
    "recordingStartTime",
    "paused",
    "pausedAt",
    "totalPausedMs",
    "fastRecorderInUse",
    "fastRecorderActiveRecordingId",
    "lastRecordingBackendRef",
  ]);
  endStorageGet1();
  // Same rule as handleRecordingComplete: route by backend, not by the
  // encoder flag. fastRecorderInUse can lie when WebCodecs fell back to MR
  // mid-pipeline (probe disagreement, in-session swap). Bytes location wins.
  const bytesInOpfs = lastRecordingBackendRef?.backend === "opfs";
  diagEvent("editor-route-decision", {
    via: "stop-tab",
    backend: lastRecordingBackendRef?.backend || null,
    fastRecorderInUse: Boolean(fastRecorderInUse),
    route: bytesInOpfs ? "webcodecs" : "ffmpeg",
  });
  const stopTabNow = Date.now();
  const stopTabStartTime = Number(recordingStartTime);
  const stopTabBasePaused = Number(totalPausedMs) || 0;
  const stopTabPausedAtMs = Number(pausedAt);
  const stopTabExtraPaused =
    paused && Number.isFinite(stopTabPausedAtMs) && stopTabPausedAtMs > 0
      ? Math.max(0, stopTabNow - stopTabPausedAtMs)
      : 0;
  const stopTabDuration =
    Number.isFinite(stopTabStartTime) && stopTabStartTime > 0
      ? Math.max(0, stopTabNow - stopTabStartTime - stopTabBasePaused - stopTabExtraPaused)
      : 0;
  diagEvent("stop-tab", { duration: stopTabDuration, reason: request.reason || null, memoryError: Boolean(request.memoryError), fastRecorderInUse: Boolean(fastRecorderInUse) });

  if (stopTabDuration > 0) {
    chrome.storage.local.set({ recordingDuration: stopTabDuration });
  }

  perfMark("BG.stopRecording pre-isSubscribed-branch", { isSubscribed: Boolean(isSubscribed) });
  if (!isSubscribed) {
    const recordingId =
      fastRecorderActiveRecordingId ||
      `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const now = Date.now();
    const startTime = Number(recordingStartTime);
    const basePaused = Number(totalPausedMs) || 0;
    const pausedAtMs = Number(pausedAt);
    const extraPaused =
      paused && Number.isFinite(pausedAtMs) && pausedAtMs > 0
        ? Math.max(0, now - pausedAtMs)
        : 0;
    const duration =
      Number.isFinite(startTime) && startTime > 0
        ? Math.max(0, now - startTime - basePaused - extraPaused)
        : 0;
    const maxDuration = 7 * 60 * 1000;
    const endLock = perfSpan("BG.stopRecording acquireLock");
    const lockAcquired = await acquirePostStopEditorLock(recordingId);
    endLock({ lockAcquired });
    if (!lockAcquired) {
      console.warn(
        "[Screenity][BG] Duplicate stop-recording-tab suppressed (editor opening)",
      );
      sendMessageRecord({ type: "stop-recording-tab" });
      return;
    }

    if (bytesInOpfs) {
      diagEvent("editor-open", { type: "editorwebcodecs", via: "stop-tab" });
      const editorUrl = "editorwebcodecs.html";
      // Open editor immediately in postStop mode (WebCodecs only)
      chrome.tabs.create(
        {
          url: `${editorUrl}?mode=postStop&recordingId=${encodeURIComponent(
            recordingId,
          )}`,
          active: true,
        },
        (tab) => {
          if (chrome.runtime.lastError || !tab?.id) {
            const errMsg = chrome.runtime.lastError?.message || "tab-create-failed";
            console.error("❌ Failed to open post-stop editor:", errMsg);
            releasePostStopEditorLock({ postStopRecordingId: null });
            const fullUrl = `${editorUrl}?mode=postStop&recordingId=${encodeURIComponent(recordingId)}`;
            handleEditorOpenFailed(fullUrl, errMsg);
            return;
          }
          let settled = false;
          const safetyTimer = setTimeout(() => {
            if (!settled) {
              settled = true;
              console.warn("[Screenity][BG] Editor tab load timed out — releasing lock");
              diagEvent("editor-open-timeout", { tabId: tab.id, type: "editorwebcodecs" });
              releasePostStopEditorLock();
              markEditorStartFailed(
                tab.id,
                "EDITOR_TAB_LOAD_TIMEOUT",
                "editor tab never reached status=complete within 15s",
              );
            }
          }, 15000);
          chrome.tabs.onUpdated.addListener(function _(
            tabId,
            changeInfo,
            updatedTab,
          ) {
            if (tabId === tab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(_);
              if (settled) return;
              settled = true;
              clearTimeout(safetyTimer);
              chrome.storage.local.set({ sandboxTab: tab.id });
              releasePostStopEditorLock();
              sendMessageTab(tab.id, { type: "fallback-recording" }).catch(
                (err) => {
                  console.error(
                    "❌ Failed to send message:",
                    err?.message || err,
                  );
                  markEditorStartFailed(
                    tab.id,
                    "EDITOR_MESSAGE_DELIVERY_FAILED",
                    String(err?.message || err).slice(0, 200),
                  );
                },
              );
            }
          });
        },
      );
    } else {
      const editorUrl =
        duration > maxDuration ? "editorviewer.html" : "editor.html";
      diagEvent("editor-open", { type: editorUrl.replace(".html", ""), via: "stop-tab", duration });
      perfMark("BG.stopRecording editor-tab-create.start", { editorUrl });
      const endTabLoad = perfSpan("BG.stopRecording editor-tab-load");
      chrome.tabs.create({ url: editorUrl, active: true }, (tab) => {
        if (chrome.runtime.lastError || !tab?.id) {
          const errMsg = chrome.runtime.lastError?.message || "tab-create-failed";
          console.error("❌ Failed to open post-stop editor:", errMsg);
          endTabLoad({ result: "create-failed" });
          releasePostStopEditorLock({ postStopRecordingId: null });
          handleEditorOpenFailed(editorUrl, errMsg);
          return;
        }
        perfMark("BG.stopRecording editor-tab-create.done", { tabId: tab.id });
        let settled = false;
        const safetyTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            console.warn("[Screenity][BG] Editor tab load timed out — releasing lock");
            diagEvent("editor-open-timeout", { tabId: tab.id, type: editorUrl });
            releasePostStopEditorLock({ postStopRecordingId: null });
            markEditorStartFailed(
              tab.id,
              "EDITOR_TAB_LOAD_TIMEOUT",
              "editor tab never reached status=complete within 15s",
            );
          }
        }, 15000);
        chrome.tabs.onUpdated.addListener(function _(
          tabId,
          changeInfo,
          updatedTab,
        ) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(_);
            if (settled) return;
            settled = true;
            clearTimeout(safetyTimer);
            endTabLoad({ result: "loaded" });
            chrome.storage.local.set({
              sandboxTab: tab.id,
              postStopRecordingId: null,
            });
            releasePostStopEditorLock({ postStopRecordingId: null });
            if (editorUrl === "editorviewer.html") {
              sendMessageTab(tab.id, { type: "viewer-recording" }).catch(
                (err) => {
                  console.error(
                    "❌ Failed to send message:",
                    err?.message || err,
                  );
                  markEditorStartFailed(
                    tab.id,
                    "EDITOR_MESSAGE_DELIVERY_FAILED",
                    String(err?.message || err).slice(0, 200),
                  );
                },
              );
            } else {
              (async () => {
                // OPFS: sandbox reads the file directly; skip chunk relay
                const storage = await chrome.storage.local.get([
                  "lastRecordingBackendRef",
                ]);
                if (storage.lastRecordingBackendRef?.backend === "opfs") {
                  perfMark("BG.stopRecording opfs-direct-make-video-tab");
                  sendMessageTab(tab.id, { type: "make-video-tab" }).catch(
                    (err) => {
                      console.warn(
                        "[Screenity][BG] make-video-tab direct send failed",
                        err,
                      );
                    },
                  );
                  return;
                }
                const endChunkLoop = perfSpan("BG.stopRecording sendChunks-loop");
                // hard cap; covers 6 attempts × ~1s but bails on a wedged sendChunks
                const SEND_CHUNKS_LOOP_TIMEOUT_MS = 15000;
                const loopStartedAt = Date.now();
                let sent = false;
                let timedOut = false;
                for (let i = 0; i < 6; i += 1) {
                  if (Date.now() - loopStartedAt > SEND_CHUNKS_LOOP_TIMEOUT_MS) {
                    timedOut = true;
                    break;
                  }
                  perfMark("BG.stopRecording sendChunks.attempt", { attempt: i + 1 });
                  // eslint-disable-next-line no-await-in-loop
                  const result = await Promise.race([
                    sendChunks(),
                    new Promise((resolve) =>
                      setTimeout(
                        () => resolve({ status: "timeout" }),
                        SEND_CHUNKS_LOOP_TIMEOUT_MS -
                          (Date.now() - loopStartedAt),
                      ),
                    ),
                  ]);
                  if (result?.status === "ok") {
                    sent = true;
                    perfMark("BG.stopRecording sendChunks.success", { attempt: i + 1 });
                    break;
                  }
                  if (result?.status === "timeout") {
                    timedOut = true;
                    break;
                  }
                  // eslint-disable-next-line no-await-in-loop
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                endChunkLoop({ sent, timedOut });
                if (!sent) {
                  console.warn(
                    "[Screenity][BG] editor opened but chunks are still unavailable",
                  );
                  // editor watches editorRecordingError via storage.onChanged
                  try {
                    await chrome.storage.local.set({
                      lastChunkSendFailure: {
                        ts: Date.now(),
                        why: "editor-opened-no-chunks",
                        targetTabId: tab.id,
                      },
                      editorRecordingError: {
                        ts: Date.now(),
                        sandboxTab: tab.id,
                        error: "chunks-unavailable",
                        why: chrome.i18n.getMessage("opfsLoadErrorDescription"),
                        errorCode: "REC_STOP_NO_CHUNKS",
                      },
                    });
                  } catch (writeErr) {
                    console.error(
                      "[Screenity][BG] failed to write editorRecordingError",
                      writeErr,
                    );
                  }
                }
              })();
            }
          }
        });
      });
    }
  }

  (async () => {
    const STOP_ACK_TIMEOUT_MS = 3000;
    const endAck = perfSpan("BG.stopRecording stop-ack-wait");
    try {
      const ack = await Promise.race([
        sendMessageRecord({ type: "stop-recording-tab" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("stop-ack-timeout")), STOP_ACK_TIMEOUT_MS)
        ),
      ]);
      if (!ack || ack.ok !== true) throw new Error("stop-no-ack");
      endAck({ result: "acked" });
    } catch (err) {
      endAck({ result: String(err?.message || err).slice(0, 60) });
      diagEvent("stop-ack-failed", { error: String(err).slice(0, 120) });
      try {
        const { activeTab } = await chrome.storage.local.get(["activeTab"]);
        if (activeTab) {
          sendMessageTab(activeTab, {
            type: "show-toast",
            message: chrome.i18n.getMessage("stopAckTimeoutToast"),
            // 12s matches editorRecoveryToast; text asks about data safety
            timeout: 12000,
          }).catch((sendErr) => {
            diagEvent("warning", {
              note: "stop-ack-toast undelivered",
              tabId: activeTab,
              err: String(sendErr).slice(0, 120),
            });
          });
        } else {
          diagEvent("warning", {
            note: "stop-ack-toast skipped: no activeTab in storage",
          });
        }
      } catch (storeErr) {
        diagEvent("warning", {
          note: "stop-ack-toast skipped: storage.get threw",
          err: String(storeErr).slice(0, 120),
        });
      }
    }
  })();
};

export const handleStopRecordingTabBackup = async (request) => {
  // gated: unconditional flag would fire the modal on a clean backup-tab close
  const isMemoryError = Boolean(request?.memoryError);
  chrome.storage.local.set({
    recording: false,
    restarting: false,
    tabRecordedID: null,
    ...(isMemoryError ? { memoryError: true } : {}),
  });
  sendMessageRecord({ type: "stop-recording-tab" });

  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  sendMessageTab(activeTab, { type: "stop-pending" });
  focusTab(activeTab);
};
