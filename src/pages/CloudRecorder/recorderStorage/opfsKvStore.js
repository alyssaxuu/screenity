// OPFS-backed kv store shaped like localforage, one file per chunk at
// cloud-chunks/<sessionId>/<track>/<index>.bin. Async writes via
// createWritable() so it works from tab and SW contexts. Probe values
// are JSON; chunk values write the Blob directly. Keys keep their
// track prefix on iterate() to match what callers got from localforage.

const ROOT_DIR_NAME = "cloud-chunks";
const PROBE_FILE = "__probe.bin";
const CHUNK_FILE_RE = /^(\d+)\.bin$/;

const opfsDiag = (event, data = {}) => {
  try {
    chrome.runtime.sendMessage({
      type: "diag-forward",
      event: `opfs-cloud-${event}`,
      data,
    });
  } catch {}
};

const safeRemove = async (parent, name) => {
  try {
    await parent.removeEntry(name);
  } catch (err) {
    if (err?.name !== "NotFoundError") throw err;
  }
};

export class OpfsKvStore {
  constructor({ sessionId, track, prefix }) {
    if (!sessionId) throw new Error("OpfsKvStore: sessionId required");
    if (!track) throw new Error("OpfsKvStore: track required");
    if (!prefix) throw new Error("OpfsKvStore: prefix required");
    this.sessionId = sessionId;
    this.track = track;
    this.prefix = prefix;
    this._dirPromise = null;
  }

  async _dir({ create = true } = {}) {
    if (this._dirPromise && create) return this._dirPromise;
    if (!create) {
      // read-only path. returns null if the tree doesn't exist so callers
      // can treat missing dirs as "no chunks".
      const root = await navigator.storage.getDirectory();
      const cloud = await root
        .getDirectoryHandle(ROOT_DIR_NAME)
        .catch(() => null);
      if (!cloud) return null;
      const session = await cloud
        .getDirectoryHandle(this.sessionId)
        .catch(() => null);
      if (!session) return null;
      return session.getDirectoryHandle(this.track).catch(() => null);
    }
    if (!this._dirPromise) {
      this._dirPromise = (async () => {
        const root = await navigator.storage.getDirectory();
        const cloud = await root.getDirectoryHandle(ROOT_DIR_NAME, {
          create: true,
        });
        const session = await cloud.getDirectoryHandle(this.sessionId, {
          create: true,
        });
        return session.getDirectoryHandle(this.track, { create: true });
      })().catch((err) => {
        // Reset so retries can re-attempt; otherwise a transient init failure
        // poisons the instance permanently.
        this._dirPromise = null;
        throw err;
      });
    }
    return this._dirPromise;
  }

  _keyToFile(key) {
    if (key === "__probe") return PROBE_FILE;
    if (this.prefix && typeof key === "string" && key.startsWith(this.prefix)) {
      const tail = key.slice(this.prefix.length);
      if (/^\d+$/.test(tail)) return `${tail}.bin`;
    }
    // Fall back to a sanitized key for any non-numeric writes (e.g. probes
    // with custom keys); never used in steady state but keeps the adapter
    // permissive.
    const safe = String(key).replace(/[^A-Za-z0-9_-]/g, "_");
    return `${safe}.bin`;
  }

  _fileToKey(name) {
    if (name === PROBE_FILE) return "__probe";
    const m = name.match(CHUNK_FILE_RE);
    if (!m) return null;
    return `${this.prefix}${m[1]}`;
  }

  async setItem(key, value) {
    const fileName = this._keyToFile(key);
    const dir = await this._dir();
    const handle = await dir.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    try {
      if (value && value.chunk instanceof Blob) {
        await writable.write(value.chunk);
      } else if (value instanceof Blob) {
        await writable.write(value);
      } else if (value !== undefined && value !== null) {
        // Probe path: just serialize whatever scalar/object the caller gave.
        await writable.write(JSON.stringify(value));
      }
    } finally {
      await writable.close();
    }
    return value;
  }

  async getItem(key) {
    const fileName = this._keyToFile(key);
    const dir = await this._dir({ create: false });
    if (!dir) return null;
    let handle;
    try {
      handle = await dir.getFileHandle(fileName);
    } catch (err) {
      if (err?.name === "NotFoundError") return null;
      throw err;
    }
    const file = await handle.getFile();
    if (key === "__probe") {
      // Probe reads aren't load-bearing; return a placeholder.
      return { ts: 0 };
    }
    const m = fileName.match(CHUNK_FILE_RE);
    const index = m ? Number(m[1]) : 0;
    // File is itself a Blob; wrap so callers always get a stable Blob shape.
    const blob = file instanceof Blob ? file : new Blob([file]);
    return { index, chunk: blob, timestamp: null };
  }

  async removeItem(key) {
    const fileName = this._keyToFile(key);
    const dir = await this._dir({ create: false });
    if (!dir) return;
    await safeRemove(dir, fileName);
  }

  async iterate(callback) {
    const dir = await this._dir({ create: false });
    if (!dir) return undefined;
    const entries = [];
    for await (const [name, handle] of dir.entries()) {
      if (name === PROBE_FILE) continue;
      const m = name.match(CHUNK_FILE_RE);
      if (!m) continue;
      entries.push({
        name,
        index: Number(m[1]),
        key: `${this.prefix}${m[1]}`,
        handle,
      });
    }
    entries.sort((a, b) => a.index - b.index);
    let i = 0;
    for (const entry of entries) {
      const file = await entry.handle.getFile();
      const blob = file instanceof Blob ? file : new Blob([file]);
      const value = { index: entry.index, chunk: blob, timestamp: null };
      const result = callback(value, entry.key, ++i);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  async length() {
    const dir = await this._dir({ create: false });
    if (!dir) return 0;
    let count = 0;
    for await (const [name] of dir.entries()) {
      if (name === PROBE_FILE) continue;
      if (!CHUNK_FILE_RE.test(name)) continue;
      count++;
    }
    return count;
  }

  async clear() {
    const dir = await this._dir({ create: false });
    if (!dir) return;
    const names = [];
    for await (const [name] of dir.entries()) names.push(name);
    await Promise.all(names.map((n) => safeRemove(dir, n)));
  }

  // Cloud-only helper: removes the track subdirectory. Call after a session
  // is fully torn down so the parent session dir can also be reaped by
  // destroySessionDir() once all tracks are gone.
  async destroyTrackDir() {
    try {
      const root = await navigator.storage.getDirectory();
      const cloud = await root.getDirectoryHandle(ROOT_DIR_NAME).catch(() => null);
      if (!cloud) return;
      const session = await cloud
        .getDirectoryHandle(this.sessionId)
        .catch(() => null);
      if (!session) return;
      await removeDirRecursive(session, this.track);
      this._dirPromise = null;
    } catch (err) {
      opfsDiag("destroy-track-failed", {
        sessionId: this.sessionId,
        track: this.track,
        error: String(err?.message || err),
      });
    }
  }
}

// Manual recursive remove. Chrome's removeEntry({recursive: true}) is
// supposed to delete non-empty directories but in practice silently
// fails on some Chromium builds when subdirectories aren't fully empty
// (e.g. lingering __probe.bin or pending write handles). Walking the
// tree explicitly is slower but reliable.
const removeDirRecursive = async (parent, name) => {
  let handle;
  try {
    handle = await parent.getDirectoryHandle(name);
  } catch (err) {
    if (err?.name === "NotFoundError") return;
    throw err;
  }
  const childNames = [];
  for await (const [childName] of handle.entries()) childNames.push(childName);
  for (const childName of childNames) {
    let isDir = false;
    try {
      await handle.getDirectoryHandle(childName);
      isDir = true;
    } catch {}
    if (isDir) {
      await removeDirRecursive(handle, childName);
    } else {
      await handle.removeEntry(childName).catch(() => {});
    }
  }
  await parent.removeEntry(name).catch((err) => {
    opfsDiag("remove-entry-failed", {
      name,
      error: String(err?.message || err),
    });
  });
};

// Best-effort whole-session cleanup. Call once after all per-track
// destroyTrackDir() complete (or independently for orphan reaping).
export const destroySessionDir = async (sessionId) => {
  if (!sessionId) return;
  try {
    const root = await navigator.storage.getDirectory();
    const cloud = await root.getDirectoryHandle(ROOT_DIR_NAME).catch(() => null);
    if (!cloud) return;
    await removeDirRecursive(cloud, sessionId);
  } catch (err) {
    opfsDiag("destroy-session-failed", {
      sessionId,
      error: String(err?.message || err),
    });
  }
};

// Lists session subdirectories under cloud-chunks/. Used by the background
// startup pass to find orphan sessions whose recorderSession is gone.
export const listSessionDirs = async () => {
  try {
    const root = await navigator.storage.getDirectory();
    const cloud = await root
      .getDirectoryHandle(ROOT_DIR_NAME)
      .catch(() => null);
    if (!cloud) return [];
    const names = [];
    for await (const [name, handle] of cloud.entries()) {
      if (handle.kind === "directory") names.push(name);
    }
    return names;
  } catch {
    return [];
  }
};

export const isOpfsSupported = () => {
  try {
    if (typeof navigator === "undefined") return false;
    if (!navigator.storage || typeof navigator.storage.getDirectory !== "function") {
      return false;
    }
    if (typeof FileSystemFileHandle === "undefined") return false;
    if (
      typeof FileSystemFileHandle.prototype?.createWritable !== "function"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};
