/*
 * Offscreen document entry. Acts as a message router between the service
 * worker and a dedicated worker that runs the OPFS-backed remux. The
 * offscreen doc itself does no CPU work: it only spawns the worker and
 * proxies messages in both directions.
 *
 * Lifecycle:
 *   - Created by the SW on first remux-request.
 *   - Worker is lazily spawned on first remux-start message.
 *   - Stays alive as long as the SW keeps it open (SW tears down after
 *     idle timeout, which terminates this page and the worker with it).
 */

const devLog =
  process.env.SCREENITY_DEV_MODE === "true"
    ? (label, data) => console.log("[remux][offscreen]", label, data || "")
    : () => {};

let worker = null;
// Pending remuxes keyed by requestId. Each entry holds the sendResponse
// callback from chrome.runtime.onMessage, so we can reply once the worker
// finishes or fails. Progress events don't use these; they broadcast to
// the sandbox directly via chrome.runtime.sendMessage.
const pending = new Map();

const ensureWorker = () => {
  if (worker) return worker;
  devLog("spawn-worker");
  worker = new Worker(chrome.runtime.getURL("remuxworker.bundle.js"));
  worker.onmessage = (e) => {
    const msg = e.data;
    if (!msg || !msg.requestId) return;
    const entry = pending.get(msg.requestId);
    if (msg.type === "progress") {
      // Forward progress to the sandbox. Swallow errors; progress is
      // best-effort telemetry.
      chrome.runtime
        .sendMessage({
          type: "remux-progress",
          requestId: msg.requestId,
          progress: msg.progress,
        })
        .catch(() => {});
      return;
    }
    if (msg.type === "done") {
      devLog("worker-done", {
        requestId: msg.requestId,
        outputFileName: msg.outputFileName,
      });
      pending.delete(msg.requestId);
      entry?.sendResponse?.({ ok: true, outputFileName: msg.outputFileName });
      return;
    }
    if (msg.type === "error") {
      devLog("worker-error", { requestId: msg.requestId, err: msg.error });
      pending.delete(msg.requestId);
      entry?.sendResponse?.({ ok: false, error: msg.error });
      return;
    }
  };
  worker.onerror = (e) => {
    // Worker-level error (module load failure, uncaught throw). Fail all
    // pending remuxes so callers can fall back.
    const errText = String(e?.message || e || "worker-error");
    for (const [id, entry] of pending) {
      entry?.sendResponse?.({ ok: false, error: errText });
    }
    pending.clear();
    try {
      worker.terminate();
    } catch {
      // already terminated
    }
    worker = null;
  };
  return worker;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "remux-start") return undefined;
  const { requestId, inputFileName, outputFileName } = message;
  if (!requestId || !inputFileName || !outputFileName) {
    sendResponse({ ok: false, error: "invalid-remux-start-payload" });
    return false;
  }
  try {
    const w = ensureWorker();
    devLog("remux-start-received", {
      requestId,
      inputFileName,
      outputFileName,
    });
    pending.set(requestId, { sendResponse });
    w.postMessage({
      type: "remux",
      requestId,
      inputFileName,
      outputFileName,
    });
  } catch (err) {
    pending.delete(requestId);
    sendResponse({
      ok: false,
      error: String(err?.message || err || "remux-start-failed"),
    });
    return false;
  }
  return true;
});
