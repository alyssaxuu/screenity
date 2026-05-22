// Perf instrumentation; enabled in prod too (300-event-per-context
// cap, 250ms debounced flush) so user diag zips have the full
// stop→editor timing. Labels are hardcoded; payloads are caller ints/
// strings. Console "[perf]" lines stay dev-only.
const DEV = process.env.SCREENITY_DEV_MODE === "true";
const ENABLED = true;

const noop = () => {};
const noopSpan = () => () => {};
const noopAsyncArr = async () => [];

const buildDevImpl = () => {
  // Per-context storage keys avoid the read-modify-write race that loses
  // marks when contexts share a single key. dumpPerf merges at read time.
  const STORAGE_KEY_BASE = "perfTimeline";
  const MAX_EVENTS = 300;
  const FLUSH_DEBOUNCE_MS = 250;

  const detectContext = () => {
    try {
      if (typeof window === "undefined") return "BG";
      const path = (window.location && window.location.pathname) || "";
      if (path.endsWith("/region.html")) return "Region";
      if (path.endsWith("/recorder.html")) return "Recorder";
      if (path.endsWith("/cloudrecorder.html")) return "CloudRecorder";
      if (path.endsWith("/sandbox.html")) return "Sandbox";
      if (path.endsWith("/editor.html")) return "Editor";
      if (path.endsWith("/editorwebcodecs.html")) return "EditorWebCodecs";
      if (path.endsWith("/editorviewer.html")) return "EditorViewer";
      if (path.endsWith("/offscreenrecorder.html")) return "OffscreenRecorder";
      if (path.endsWith("/audiooffscreen.html")) return "AudioOffscreen";
      if (path.endsWith("/remuxoffscreen.html")) return "RemuxOffscreen";
      if (path.endsWith("/backup.html")) return "Backup";
      if (path.endsWith("/popup.html")) return "Popup";
      return "Content";
    } catch {
      return "unknown";
    }
  };

  const CTX = detectContext();
  const STORAGE_KEY = `${STORAGE_KEY_BASE}.${CTX}`;
  const localBuf = [];
  let lastMarkPerfNow = null;
  let pendingFlush = null;
  let writeChain = Promise.resolve();
  let cachedSessionId = null;

  const refreshSessionId = () => {
    try {
      chrome.storage.local
        .get(["recordingAttemptId"])
        .then((res) => {
          cachedSessionId = res?.recordingAttemptId || cachedSessionId;
        })
        .catch(() => {});
    } catch {}
  };

  const flushNow = () => {
    if (!localBuf.length) return;
    const batch = localBuf.splice(0, localBuf.length);
    writeChain = writeChain
      .then(async () => {
        try {
          const res = await chrome.storage.local.get([STORAGE_KEY]);
          const cur = Array.isArray(res?.[STORAGE_KEY]) ? res[STORAGE_KEY] : [];
          for (const e of batch) cur.push(e);
          while (cur.length > MAX_EVENTS) cur.shift();
          await chrome.storage.local.set({ [STORAGE_KEY]: cur });
        } catch {}
      })
      .catch(() => {});
  };

  const scheduleFlush = () => {
    if (pendingFlush) return;
    pendingFlush = setTimeout(() => {
      pendingFlush = null;
      flushNow();
    }, FLUSH_DEBOUNCE_MS);
  };

  const emit = (label, meta) => {
    if (!cachedSessionId) refreshSessionId();
    const now = Date.now();
    const perfNow =
      typeof performance !== "undefined" ? performance.now() : null;
    const delta =
      perfNow !== null && lastMarkPerfNow !== null
        ? Math.round(perfNow - lastMarkPerfNow)
        : null;
    lastMarkPerfNow = perfNow;
    const entry = {
      t: now,
      perfNow,
      ctx: CTX,
      label,
      sessionId: cachedSessionId || null,
    };
    if (meta && typeof meta === "object") {
      try {
        const json = JSON.stringify(meta);
        entry.meta = json.length > 400 ? { _truncated: true } : meta;
      } catch {
        entry.meta = { _serializeError: true };
      }
    }
    localBuf.push(entry);
    if (DEV) {
      try {
        const tag = delta !== null ? `+${delta}ms` : "";
        if (meta) {
          console.debug("[perf]", CTX, label, tag, meta);
        } else {
          console.debug("[perf]", CTX, label, tag);
        }
      } catch {}
    }
    scheduleFlush();
  };

  const perfMarkImpl = (label, meta = null) => {
    try {
      emit(label, meta);
    } catch {}
  };

  const perfSpanImpl = (label, startMeta = null) => {
    const startPerf =
      typeof performance !== "undefined" ? performance.now() : null;
    try {
      emit(`${label}.start`, startMeta);
    } catch {}
    return (endMeta = null) => {
      try {
        const dur =
          startPerf !== null && typeof performance !== "undefined"
            ? Math.round(performance.now() - startPerf)
            : null;
        emit(
          `${label}.end`,
          endMeta
            ? { ...endMeta, durMs: dur }
            : dur !== null
            ? { durMs: dur }
            : null,
        );
      } catch {}
    };
  };

  const perfResetImpl = (sessionId = null) => {
    try {
      cachedSessionId = sessionId;
      lastMarkPerfNow = null;
      chrome.storage.local.get(null).then((all) => {
        const cleared = {};
        for (const k of Object.keys(all || {})) {
          if (k === STORAGE_KEY_BASE || k.startsWith(`${STORAGE_KEY_BASE}.`)) {
            cleared[k] = [];
          }
        }
        if (Object.keys(cleared).length > 0) {
          chrome.storage.local.set(cleared).catch(() => {});
        }
      }).catch(() => {});
    } catch {}
  };

  const getPerfTimelineImpl = async () => {
    try {
      const all = await chrome.storage.local.get(null);
      const merged = [];
      for (const k of Object.keys(all || {})) {
        if (k === STORAGE_KEY_BASE || k.startsWith(`${STORAGE_KEY_BASE}.`)) {
          const arr = all[k];
          if (Array.isArray(arr)) merged.push(...arr);
        }
      }
      merged.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
      return merged;
    } catch {
      return [];
    }
  };

  const formatTimeline = (entries, sessionId = null) => {
    const filtered = sessionId
      ? entries.filter((e) => e.sessionId === sessionId)
      : entries;
    if (!filtered.length) return "[perf] no entries";
    const t0 = filtered[0].t;
    const lines = ["[perf] timeline (relative to first mark):"];
    let prevT = t0;
    for (const e of filtered) {
      const rel = e.t - t0;
      const delta = e.t - prevT;
      prevT = e.t;
      const meta = e.meta ? " " + JSON.stringify(e.meta) : "";
      lines.push(
        `+${String(rel).padStart(6)}ms (Δ${String(delta).padStart(5)}ms) ${e.ctx.padEnd(8)} ${e.label}${meta}`,
      );
    }
    return lines.join("\n");
  };

  try {
    const target =
      typeof globalThis !== "undefined"
        ? globalThis
        : typeof self !== "undefined"
        ? self
        : null;
    if (target) {
      target.dumpPerf = async (sessionId = null) => {
        const entries = await getPerfTimelineImpl();
        const out = formatTimeline(entries, sessionId);
        console.log(out);
        return entries;
      };
      target.resetPerf = perfResetImpl;
    }
  } catch {}

  refreshSessionId();

  // Flush localBuf on pagehide so the last ~250ms of marks survive
  // tab teardown. Also forward to BG since pagehide storage.set is
  // racey; BG outlives the tab and appends to perfTimeline.<ctx>.
  const forwardBatchToBg = (batch) => {
    if (!batch || !batch.length) return;
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        typeof chrome.runtime.sendMessage === "function"
      ) {
        // Fire-and-forget; the SW receives and persists. Wrapped because
        // sendMessage rejects on no-receiver, which we don't care about
        // (BG SW may be momentarily asleep on a perf-only message).
        chrome.runtime
          .sendMessage({ type: "perf-forward", ctx: CTX, entries: batch })
          .catch(() => {});
      }
    } catch {}
  };
  try {
    if (
      typeof self !== "undefined" &&
      typeof self.addEventListener === "function" &&
      CTX !== "BG"
    ) {
      const finalFlush = () => {
        if (pendingFlush) {
          clearTimeout(pendingFlush);
          pendingFlush = null;
        }
        // Take a copy of the buffer for BG forwarding *before* flushNow
        // drains it; otherwise the local in-flight write and the BG
        // forward compete and one loses.
        if (localBuf.length) {
          forwardBatchToBg(localBuf.slice());
        }
        flushNow();
      };
      self.addEventListener("pagehide", finalFlush);
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") finalFlush();
        });
      }
    }
  } catch {}

  return {
    perfMark: perfMarkImpl,
    perfSpan: perfSpanImpl,
    perfReset: perfResetImpl,
    getPerfTimeline: getPerfTimelineImpl,
  };
};

const impl = ENABLED ? buildDevImpl() : null;

export const perfMark = ENABLED ? impl.perfMark : noop;
export const perfSpan = ENABLED ? impl.perfSpan : noopSpan;
export const perfReset = ENABLED ? impl.perfReset : noop;
export const getPerfTimeline = ENABLED ? impl.getPerfTimeline : noopAsyncArr;
