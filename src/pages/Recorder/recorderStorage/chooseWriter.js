/*
 * OPFS writer when available, else IDB. OPFS needs navigator.storage.getDirectory
 * and FileSystemFileHandle.createSyncAccessHandle (Chrome >=102). The
 * backendRef from close() tells the sandbox which reader to use.
 */
import { IdbChunkWriter } from "./idbChunkWriter";
import { OpfsChunkWriter } from "./opfs/opfsChunkWriter";

const isOpfsSyncSupported = () => {
  try {
    if (typeof navigator === "undefined") return false;
    if (!navigator.storage || typeof navigator.storage.getDirectory !== "function") {
      return false;
    }
    if (typeof FileSystemFileHandle === "undefined") return false;
    // createSyncAccessHandle exists only in Worker context; any Chrome
    // with OPFS on main thread has it in workers (>=102). If worker
    // open() fails, OpfsChunkWriter throws and the caller falls back.
    return true;
  } catch {
    return false;
  }
};

export const chooseWriter = async ({ preferOpfs = true } = {}) => {
  if (preferOpfs && isOpfsSyncSupported()) {
    return { writer: new OpfsChunkWriter(), backend: "opfs" };
  }
  return { writer: new IdbChunkWriter(), backend: "idb" };
};
