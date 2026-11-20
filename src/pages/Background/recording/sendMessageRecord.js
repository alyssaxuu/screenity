import { sendMessageTab } from "../tabManagement";
import { diagEvent } from "../../utils/diagnosticLog";
import { isActiveRecorderAlive } from "../offscreen/recorderHost";

// Offscreen docs survive a SW restart. If the SW died mid-start and lost the
// `offscreen` flag, look for a live recorder offscreen doc before giving up.
const ENABLE_RESILIENT_HANDOFF = true;

// Always false: "message port closed" can come from any context that got the
// broadcast and didn't reply (camera page). Only sendResponse confirms delivery.
const isDeliveredWithoutReply = () => false;

// onRoute names the receiver it picked, for a caller that has to explain a
// missing answer.
export const sendMessageRecord = (
  message,
  responseCallback = null,
  { onRoute = null } = {}
) => {
  const route = (r) => {
    try {
      onRoute?.(r);
    } catch {}
  };
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
        route("offscreen");
        chrome.runtime.sendMessage(message, (response) => {
          const err = chrome.runtime.lastError?.message;
          if (err && !isDeliveredWithoutReply(err)) {
            reject(err);
          } else if (err) {
            resolve(undefined);
          } else {
            responseCallback ? responseCallback(response) : resolve(response);
          }
        });
      } else if (result.recordingTab) {
        route(`recordingTab:${result.recordingTab}`);
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
          route("recovered-offscreen");
          chrome.runtime.sendMessage(message, (response) => {
            const err = chrome.runtime.lastError?.message;
            if (err && !isDeliveredWithoutReply(err)) {
              reject(err);
            } else if (err) {
              resolve(undefined);
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
              route(`session-tab:${recorderTabId}`);
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
          // Frames of earlier takes still finishing in the host do not count:
          // they ignore the live take's controls.
          isActiveRecorderAlive()
            .then((hasRecorderOffscreen) => {
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
