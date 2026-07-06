import { sendMessageTab } from "../tabManagement";
import { diagEvent } from "../../utils/diagnosticLog";

// Offscreen docs survive a SW restart. If the SW died mid-start and lost the
// `offscreen` flag, look for a live recorder offscreen doc before giving up.
const ENABLE_RESILIENT_HANDOFF = true;

export const sendMessageRecord = (message, responseCallback = null) => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["recordingTab", "offscreen"], (result) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "sendMessageRecord: storage error",
          chrome.runtime.lastError.message
        );
        return reject(chrome.runtime.lastError.message);
      }

      if (result.offscreen) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            responseCallback ? responseCallback(response) : resolve(response);
          }
        });
      } else if (result.recordingTab) {
        sendMessageTab(result.recordingTab, message, responseCallback)
          .then(resolve)
          .catch((err) => {
            const errStr = String(err);
            const isDeadTab =
              errStr.includes("Receiving end does not exist") ||
              errStr.includes("No tab with id");
            console.warn(
              `sendMessageRecord: failed to message recordingTab ${result.recordingTab}${isDeadTab ? " (stale/dead tab)" : ""}`,
              err
            );
            reject(err);
          });
      } else {
        const sendViaOffscreen = () => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError.message);
            } else {
              responseCallback ? responseCallback(response) : resolve(response);
            }
          });
        };
        // SW restart can lose recordingTab, fall back to recorderSession
        // but only if it's still live. completed/crashed/stopped sessions
        // point at a dead tab and would surface a misleading "No tab with
        // id" error instead of the real "no recorder tab" one.
        const tryRecorderSession = () => {
          chrome.storage.local.get(["recorderSession"], (sessionResult) => {
            const session = sessionResult.recorderSession;
            const recorderTabId =
              session?.recorderTabId || session?.tabId || null;
            const sessionLive =
              session?.status === "recording" ||
              session?.status === "starting";
            if (sessionLive && recorderTabId) {
              sendMessageTab(recorderTabId, message, responseCallback)
                .then(resolve)
                .catch(reject);
            } else {
              console.warn(
                "sendMessageRecord: no recording tab available",
                session
                  ? { sessionStatus: session.status, recorderTabId }
                  : { session: null }
              );
              reject(new Error("No recording tab available"));
            }
          });
        };
        // If a recorder offscreen is alive (the SW restart wiped the flag but
        // not the doc), resume the handoff to it instead of giving up.
        if (ENABLE_RESILIENT_HANDOFF && chrome.runtime.getContexts) {
          chrome.runtime
            .getContexts({})
            .then((contexts) => {
              const hasRecorderOffscreen = (contexts || []).some(
                (c) =>
                  c.contextType === "OFFSCREEN_DOCUMENT" &&
                  typeof c.documentUrl === "string" &&
                  c.documentUrl.includes("offscreenrecorder.html")
              );
              if (hasRecorderOffscreen) {
                diagEvent("send-record-recovered-offscreen", {
                  messageType: message?.type || null,
                });
                sendViaOffscreen();
              } else {
                tryRecorderSession();
              }
            })
            .catch(() => tryRecorderSession());
        } else {
          tryRecorderSession();
        }
      }
    });
  });
};
