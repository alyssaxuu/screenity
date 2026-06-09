// makes a MediaRecorder WebM seekable. tries a blob-URL worker, but MV3 extension_pages CSP forbids blob: in worker-src so the Worker ctor throws in the editor host; falls back to the sync path (correct blob, on the main thread, responds before the child's 90s relay timeout)
import webmDurationLibSrc from "!!raw-loader!fix-webm-duration/fix-webm-duration.js";
import fixWebmDurationSync from "fix-webm-duration";

let cachedWorkerUrl = null;

const getWorkerUrl = () => {
  if (cachedWorkerUrl) return cachedWorkerUrl;
  // Shim window so the lib's UMD assigns self.ysFixWebmDuration in the worker.
  const src =
    "var window = self;\n" +
    webmDurationLibSrc +
    "\nself.onmessage = function (e) {\n" +
    "  var d = e.data || {};\n" +
    "  try {\n" +
    "    self.ysFixWebmDuration(d.blob, d.durationMs, function (fixed) {\n" +
    "      self.postMessage({ ok: true, blob: fixed });\n" +
    "    }, { logger: false });\n" +
    "  } catch (err) {\n" +
    "    self.postMessage({ ok: false, error: String((err && err.message) || err) });\n" +
    "  }\n" +
    "};\n";
  cachedWorkerUrl = URL.createObjectURL(
    new Blob([src], { type: "application/javascript" }),
  );
  return cachedWorkerUrl;
};

// Resolves to a duration-fixed Blob. Off the main thread when possible.
export const fixWebmDurationOffThread = (blob, durationMs) =>
  new Promise((resolve) => {
    let done = false;
    let worker = null;
    let timer = null;

    function cleanup() {
      if (timer) clearTimeout(timer);
      if (worker) {
        try {
          worker.terminate();
        } catch (e) {}
      }
    }
    const finishSync = () => {
      if (done) return;
      done = true;
      cleanup();
      try {
        fixWebmDurationSync(blob, durationMs, (f) => resolve(f), {
          logger: false,
        });
      } catch (e) {
        resolve(blob); // unfixed (plays from start; seek metadata may be off)
      }
    };
    const finishOk = (fixed) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(fixed);
    };

    try {
      worker = new Worker(getWorkerUrl());
    } catch (e) {
      finishSync();
      return;
    }
    timer = setTimeout(finishSync, 90000);
    worker.onmessage = (e) => {
      const d = e.data || {};
      if (d.ok && d.blob) finishOk(d.blob);
      else finishSync();
    };
    worker.onerror = () => finishSync();
    try {
      worker.postMessage({ blob, durationMs });
    } catch (e) {
      finishSync();
    }
  });
