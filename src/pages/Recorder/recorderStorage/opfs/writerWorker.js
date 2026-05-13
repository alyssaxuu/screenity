// owns an OPFS file via FileSystemSyncAccessHandle. near-zero RAM, no
// IDB overhead per write. writes serial; main awaits each 'written'
// for backpressure. file persists across restarts, cleaned up by
// abort() or post-read delete in the sandbox.
// protocol: main {type, requestId, ...} -> worker {type, requestId, ok, ...}

const FILE_PREFIX = "recording-";

const devLog =
  process.env.SCREENITY_DEV_MODE === "true"
    ? (label, data) =>
        console.log("[recorder-opfs][worker]", label, data || "")
    : () => {};

let fileName = null;
let syncHandle = null;
let offset = 0;
let chunkCount = 0;
let closed = false;

// Keep exactly one recoverable recording (matches chunksStore.clear()
// on the IDB path); old recording stays until a new one actually starts.
const clearPreviousRecordings = async (exceptName = null) => {
  try {
    const dir = await navigator.storage.getDirectory();
    for await (const [name] of dir.entries()) {
      if (!name.startsWith(FILE_PREFIX)) continue;
      if (exceptName && name === exceptName) continue;
      await dir.removeEntry(name).catch(() => {});
    }
  } catch {}
};

const post = (payload) => {
  self.postMessage(payload);
};

const openFile = async (recordingId, extension) => {
  // Create NEW before deleting old: if creation fails, the previous
  // recording remains intact for recovery, and a recovery editor
  // already loading the old file doesn't lose it mid-load.
  const dir = await navigator.storage.getDirectory();
  const ext = extension === "webm" ? "webm" : "mp4";
  const name = `${FILE_PREFIX}${recordingId}.${ext}`;
  const handle = await dir.getFileHandle(name, { create: true });
  const sync = await handle.createSyncAccessHandle();
  sync.truncate(0);
  fileName = name;
  syncHandle = sync;
  offset = 0;
  chunkCount = 0;
  closed = false;
  await clearPreviousRecordings(name);
  devLog("open", { fileName: name });
  return { fileName: name };
};

const writeChunk = async (blob) => {
  if (closed) throw new Error("opfs-writer-closed");
  if (!syncHandle) throw new Error("opfs-writer-not-open");
  // arrayBuffer() is async; sync handle write is synchronous once bytes are in hand.
  const buf = await blob.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const written = syncHandle.write(u8, { at: offset });
  offset += typeof written === "number" ? written : u8.byteLength;
  chunkCount += 1;
  return { totalSize: offset };
};

const closeFile = () => {
  if (!syncHandle) {
    return { byteSize: offset, chunkCount, fileName };
  }
  try {
    syncHandle.flush();
  } catch {}
  const byteSize = typeof syncHandle.getSize === "function" ? syncHandle.getSize() : offset;
  syncHandle.close();
  syncHandle = null;
  closed = true;
  devLog("close", { byteSize, chunkCount, fileName });
  return { byteSize, chunkCount, fileName };
};

const abortFile = async () => {
  if (syncHandle) {
    try {
      syncHandle.close();
    } catch {}
    syncHandle = null;
  }
  if (fileName) {
    try {
      const dir = await navigator.storage.getDirectory();
      await dir.removeEntry(fileName).catch(() => {});
    } catch {}
  }
  fileName = null;
  offset = 0;
  chunkCount = 0;
  closed = true;
};

// Single promise chain: writes apply in post order, open/close/abort
// can't interleave with in-flight writes.
let queue = Promise.resolve();

const enqueue = (fn) => {
  const next = queue.then(fn).catch((err) => {
    // Error already surfaces via post(); keep chain alive for next msg.
    return { __error: err };
  });
  queue = next;
  return next;
};

self.onmessage = (e) => {
  const msg = e.data;
  if (!msg || !msg.type || !msg.requestId) return;

  // Preserve DOMException name (e.g. "QuotaExceededError") across the
  // structured-clone boundary so main can branch without substring matching.
  const errorPayload = (err) => ({
    error: String(err?.message || err),
    errorName: err?.name || "Error",
  });

  if (msg.type === "open") {
    enqueue(async () => {
      try {
        const { fileName: fn } = await openFile(msg.recordingId, msg.extension);
        post({ type: "ready", requestId: msg.requestId, ok: true, fileName: fn });
      } catch (err) {
        post({
          type: "ready",
          requestId: msg.requestId,
          ok: false,
          ...errorPayload(err),
        });
      }
    });
    return;
  }

  if (msg.type === "write") {
    enqueue(async () => {
      try {
        const { totalSize } = await writeChunk(msg.chunk);
        post({
          type: "written",
          requestId: msg.requestId,
          ok: true,
          totalSize,
        });
      } catch (err) {
        post({
          type: "written",
          requestId: msg.requestId,
          ok: false,
          ...errorPayload(err),
        });
      }
    });
    return;
  }

  if (msg.type === "close") {
    enqueue(async () => {
      try {
        const result = closeFile();
        post({
          type: "closed",
          requestId: msg.requestId,
          ok: true,
          byteSize: result.byteSize,
          chunkCount: result.chunkCount,
          fileName: result.fileName,
        });
      } catch (err) {
        post({
          type: "closed",
          requestId: msg.requestId,
          ok: false,
          ...errorPayload(err),
        });
      }
    });
    return;
  }

  if (msg.type === "abort") {
    enqueue(async () => {
      try {
        await abortFile();
        post({ type: "aborted", requestId: msg.requestId, ok: true });
      } catch (err) {
        post({
          type: "aborted",
          requestId: msg.requestId,
          ok: false,
          ...errorPayload(err),
        });
      }
    });
    return;
  }
};
