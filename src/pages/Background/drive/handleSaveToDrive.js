import { base64ToUint8Array } from "../utils/base64ToUint8Array";
import { sendMessageTab } from "../tabManagement";
import { chunksStore } from "../recording/chunkHandler";
import {
  markRetainedSaved,
  retainedEntryForTab,
} from "../recording/recordingRetention";
import { instanceForSlot } from "../../utils/chunkStores";
import signIn from "../modules/signIn";
import { diagEvent } from "../../utils/diagnosticLog";

const findOrCreateScreenityFolder = async (token) => {
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  const query = encodeURIComponent(
    `name='Screenity' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers }
  );

  if (!searchRes.ok) {
    const text = await searchRes.text().catch(() => "");
    throw new Error(
      `Drive folder search failed: ${searchRes.status} ${text}`
    );
  }

  const result = await searchRes.json();
  if (result.files?.length) return result.files[0].id;

  const createRes = await fetch(`https://www.googleapis.com/drive/v3/files`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Screenity",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw new Error(
      `Drive folder creation failed: ${createRes.status} ${text}`
    );
  }

  const newFolder = await createRes.json();
  return newFolder.id;
};

const getAuthTokenFromStorage = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["token"], async (result) => {
      if (chrome.runtime.lastError) {
        console.error("[Drive] storage error:", chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError));
        return;
      }

      const token = result.token;
      if (!token) {
        try {
          const newToken = await signIn();
          if (!newToken) {
            console.error("[Drive] drive_auth_failed: signIn returned null");
            diagEvent("drive-auth-fail", { reason: "signIn returned null" });
            reject(new Error("Sign-in failed"));
          } else {
            resolve(newToken);
          }
        } catch (err) {
          console.error("[Drive] drive_auth_failed:", err.message);
          diagEvent("drive-auth-fail", { reason: String(err.message).slice(0, 80) });
          reject(err);
        }
        return;
      }

      // refresh JWTs within 5min of expiry; mid-upload 401 has no retry path (only 408/429/5xx retry)
      const REFRESH_HEADROOM_MS = 5 * 60 * 1000;
      let needsRefresh = false;
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp * 1000;
          needsRefresh = Date.now() + REFRESH_HEADROOM_MS >= exp;
        }
      } catch {}

      if (needsRefresh) {
        try {
          const newToken = await signIn();
          if (!newToken) {
            console.error("[Drive] drive_auth_failed: re-sign-in returned null");
            reject(new Error("Sign-in failed"));
          } else {
            resolve(newToken);
          }
        } catch (err) {
          console.error("[Drive] drive_auth_failed:", err.message);
          reject(err);
        }
      } else {
        resolve(token);
      }
    });
  });
};

// 8 MB resumable chunks so multi-GB recordings don't OOM the SW.
// https://developers.google.com/drive/api/guides/manage-uploads#resumable
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_CHUNK_ATTEMPTS = 5;
// Bounds a 308-with-no-progress loop; see the stall handling in uploadResumable.
const MAX_STALL_ROUNDS = 4;

// long names break Drive's UI and can fail resumable init validation
const sanitizeDriveName = (raw) => {
  let out = String(raw ?? "");
  out = out.replace(/[\x00-\x1f\x7f]/g, " ");
  out = out.replace(/\s+/g, " ").trim();
  if (!out) out = "Screenity Recording";
  if (out.length > 200) out = out.slice(0, 200).trim();
  return out;
};

const uploadResumable = async (token, blob, fileName, folderId) => {
  const metadata = { name: sanitizeDriveName(fileName), parents: [folderId] };

  const initRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": blob.type || "application/octet-stream",
        "X-Upload-Content-Length": String(blob.size),
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const errBody = await initRes.text().catch(() => "");
    throw new Error(
      `Drive resumable init failed: ${initRes.status} ${errBody}`
    );
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new Error("Drive resumable init missing Location header");
  }

  const totalSize = blob.size;
  let offset = 0;
  let stalledRounds = 0;

  // 308 = more to send (Range header has last byte received), 200/201 = done
  while (offset < totalSize) {
    const end = Math.min(offset + CHUNK_SIZE, totalSize);
    const chunkBlob = blob.slice(offset, end);
    const buffer = await chunkBlob.arrayBuffer();
    const contentRange = `bytes ${offset}-${end - 1}/${totalSize}`;

    let chunkRes = null;
    let advanced = false;
    let stalled = false;
    for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt++) {
      try {
        chunkRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Length": String(buffer.byteLength),
            "Content-Range": contentRange,
          },
          body: buffer,
        });
      } catch (err) {
        const isNetworkErr =
          err?.name === "TypeError" || err?.name === "AbortError";
        if (!isNetworkErr || attempt === MAX_CHUNK_ATTEMPTS - 1) {
          throw err;
        }
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const jitter = Math.random() * 250;
        diagEvent("drive-chunk-retry", {
          offset,
          reason: "network",
          attempt: attempt + 1,
          delayMs: Math.round(delay + jitter),
        });
        await new Promise((r) => setTimeout(r, delay + jitter));
        continue;
      }

      if (chunkRes.status === 200 || chunkRes.status === 201) {
        const data = await chunkRes.json();
        return data?.id || null;
      }

      // Range is "bytes=0-N" inclusive, resume at N+1. A 308 with no Range
      // means Drive persisted none of this chunk, and a Range that doesn't move
      // past the current offset means the same. Counting either as progress
      // would skip bytes or respin the outer loop forever, because the attempt
      // counter is re-created on every outer iteration.
      if (chunkRes.status === 308) {
        const range = chunkRes.headers.get("range");
        const match = range && range.match(/bytes=0-(\d+)/);
        const nextOffset = match ? parseInt(match[1], 10) + 1 : offset;
        if (nextOffset > offset) {
          offset = nextOffset;
          advanced = true;
        } else {
          stalled = true;
        }
        break;
      }

      const isTransient =
        chunkRes.status === 408 ||
        chunkRes.status === 429 ||
        chunkRes.status >= 500;
      if (!isTransient || attempt === MAX_CHUNK_ATTEMPTS - 1) {
        const errBody = await chunkRes.text().catch(() => "");
        throw new Error(
          `Drive chunk PUT failed: ${chunkRes.status} ${errBody}`
        );
      }
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 250;
      diagEvent("drive-chunk-retry", {
        offset,
        status: chunkRes.status,
        attempt: attempt + 1,
        delayMs: Math.round(delay + jitter),
      });
      await new Promise((r) => setTimeout(r, delay + jitter));
    }

    if (advanced) {
      stalledRounds = 0;
      continue;
    }
    if (!stalled) {
      throw new Error(
        `Drive chunk PUT exhausted retries at offset ${offset}`
      );
    }
    // Drive accepted none of the chunk. Resending the same range is correct,
    // but bound it so a persistently stalled upload fails instead of looping.
    stalledRounds += 1;
    if (stalledRounds >= MAX_STALL_ROUNDS) {
      throw new Error(
        `Drive resumable upload made no progress at offset ${offset}`
      );
    }
    const stallDelay = Math.min(1000 * Math.pow(2, stalledRounds - 1), 15000);
    diagEvent("drive-chunk-stall", {
      offset,
      round: stalledRounds,
      delayMs: stallDelay,
    });
    await new Promise((r) => setTimeout(r, stallDelay));
  }

  throw new Error("Drive resumable upload finished without final response");
};

const isAuthError = (err) => {
  const msg = String(err?.message || err || "");
  return / 401\b/.test(msg) || /401 /.test(msg);
};

// Map a Drive failure to a stable code the editor turns into a specific
// message. The reason strings come from Drive's 403/400 JSON body, which we
// already carry in the thrown message but used to discard client-side.
const classifyDriveError = (err) => {
  const msg = String(err?.message || err || "");
  // storageQuotaExceeded is the account-full reason. Drive also returns
  // "Quota exceeded for quota metric ..." for API rate limits, which is
  // transient, so don't match that loosely or a rate limit tells the user
  // their Drive is full.
  if (/storageQuotaExceeded/i.test(msg)) {
    return "drive-quota";
  }
  if (/fileSizeLimitExceeded/i.test(msg) || /\b413\b/.test(msg)) {
    return "drive-too-large";
  }
  // 403 carries auth reasons too, and isAuthError only matches 401.
  if (
    isAuthError(err) ||
    /Sign-in failed/i.test(msg) ||
    /authError/i.test(msg) ||
    /insufficientPermissions/i.test(msg) ||
    /ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(msg) ||
    /invalid_grant/i.test(msg)
  ) {
    return "drive-auth";
  }
  return "drive-generic";
};

const saveToDrive = async (videoBlob, fileName) => {
  // 401 retry covers clock skew, opaque tokens, server-side revocation
  const runUploadOnce = async (forceRefresh = false) => {
    let token;
    if (forceRefresh) {
      // chrome.identity hands back the same cached token even after the server
      // revoked it, so without this the retry replays the dead token and the
      // user is asked to sign in again on a loop.
      // No-op on Edge, where signIn uses launchWebAuthFlow and the token was
      // never in getAuthToken's cache. Raced against a timeout so a callback
      // that never fires can't wedge the retry.
      try {
        const stale = await getAuthTokenFromStorage();
        if (stale && chrome.identity?.removeCachedAuthToken) {
          await Promise.race([
            new Promise((resolve) =>
              chrome.identity.removeCachedAuthToken({ token: stale }, resolve)
            ),
            new Promise((resolve) => setTimeout(resolve, 2000)),
          ]);
        }
      } catch {}
      const refreshed = await signIn();
      if (!refreshed) throw new Error("Sign-in failed");
      await chrome.storage.local.set({ token: refreshed });
      token = refreshed;
    } else {
      token = await getAuthTokenFromStorage();
      if (!token) throw new Error("Sign-in failed");
    }

    const folderId = await findOrCreateScreenityFolder(token);
    const fileId = await uploadResumable(token, videoBlob, fileName, folderId);
    if (!fileId) throw new Error("File ID missing after upload");
    return fileId;
  };

  try {
    diagEvent("drive-upload-start", {
      blobSize: videoBlob.size,
      blobType: videoBlob.type,
    });

    let fileId;
    try {
      fileId = await runUploadOnce(false);
    } catch (err) {
      if (isAuthError(err)) {
        diagEvent("drive-auth-retry", {
          error: String(err?.message || err).slice(0, 120),
        });
        fileId = await runUploadOnce(true);
      } else {
        throw err;
      }
    }

    diagEvent("drive-upload-ok", { fileId });

    chrome.tabs.create({
      url: `https://drive.google.com/file/d/${fileId}/view`,
    });

    return { status: "ok", url: fileId };
  } catch (error) {
    const errorCode = classifyDriveError(error);
    console.error("[Drive] drive_upload_failed:", error.message);
    diagEvent("drive-upload-fail", {
      error: String(error.message).slice(0, 120),
      errorCode,
    });
    return { status: "ew", url: null, error: error.message, errorCode };
  }
};

const savedToDrive = async (tabId) => {
  // A Drive save is a copy the user keeps, exactly like a download, so it
  // releases retention and stops the unsaved-recording prompt.
  try {
    const { retainedRecordings } = await chrome.storage.local.get([
      "retainedRecordings",
    ]);
    const list = Array.isArray(retainedRecordings) ? retainedRecordings : [];
    // Only the saving tab's own entry. Guessing the newest unsaved one marked
    // an unrelated recording saved and dropped its protection.
    const mine = list.find((e) => e.tabId === tabId && !e.saved);
    if (mine?.recordingId) await markRetainedSaved(mine.recordingId);
  } catch {}
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  if (!sandboxTab) {
    console.warn("[Drive] savedToDrive: sandboxTab not set, cannot notify UI");
    return;
  }
  try {
    await sendMessageTab(sandboxTab, { type: "saved-to-drive" });
  } catch (err) {
    console.warn("[Drive] savedToDrive: failed to notify sandbox tab:", err);
  }
};

// The editor stages exports as drive-upload-<uuid>.<ext> in the OPFS root.
// Nothing else in the tree sweeps that prefix (remux-, trim- and recording-
// each have their own owner), so an SW teardown or browser close mid-upload
// strands a full-size file permanently. Delete ours on every exit, and clear
// stale strays before staging the next one.
const STAGED_PREFIX = "drive-upload-";
const STAGED_MAX_AGE_MS = 60 * 60 * 1000;

const removeStagedOpfsFile = async (name) => {
  if (!name) return;
  try {
    const dir = await navigator.storage.getDirectory();
    await dir.removeEntry(name).catch(() => {});
  } catch {}
};

const sweepStagedOpfsFiles = async (keepName = null) => {
  try {
    const dir = await navigator.storage.getDirectory();
    const now = Date.now();
    const stale = [];
    for await (const [name, handle] of dir.entries()) {
      if (name === keepName || !name.startsWith(STAGED_PREFIX)) continue;
      if (handle.kind !== "file") continue;
      let ageMs = null;
      try {
        const f = await handle.getFile();
        if (Number.isFinite(f?.lastModified)) ageMs = now - f.lastModified;
      } catch {}
      // Fail safe, not open: a handle we can't stat is more likely locked by a
      // live writer than leaked, so leave anything we can't confidently age out.
      if (ageMs === null || ageMs < STAGED_MAX_AGE_MS) continue;
      stale.push(name);
    }
    for (const name of stale) {
      await dir.removeEntry(name).catch(() => {});
    }
    if (stale.length) diagEvent("drive-opfs-sweep", { removed: stale.length });
  } catch {}
};

export const handleSaveToDrive = async (request, fallback = false, tabId = null) => {
  try {
    let response;

    if (!fallback && request.opfsFileName) {
      // Preferred path: the editor staged the export into OPFS and sent only
      // the filename. Read it as a disk-backed File (never materialized whole)
      // and let uploadResumable stream it in 8 MB chunks.
      const ext = request.isWebm ? ".webm" : ".mp4";
      const fileName = (request.title || "Screenity Recording") + ext;
      let opfsFile;
      try {
        const dir = await navigator.storage.getDirectory();
        const handle = await dir.getFileHandle(request.opfsFileName);
        opfsFile = await handle.getFile();
      } catch (err) {
        // This return used to skip the finally below, stranding the staged
        // export in OPFS with nothing to ever collect it.
        await removeStagedOpfsFile(request.opfsFileName);
        diagEvent("drive-save-fail", {
          error: `opfs-read: ${String(err?.message || err).slice(0, 90)}`,
          errorCode: "drive-generic",
        });
        return {
          status: "ew",
          url: null,
          error: "Could not read the staged recording",
          errorCode: "drive-generic",
        };
      }
      try {
        response = await saveToDrive(opfsFile, fileName);
      } finally {
        await removeStagedOpfsFile(request.opfsFileName);
        // Clear strays left by earlier runs the SW never got to finish.
        await sweepStagedOpfsFiles(request.opfsFileName);
      }
    } else if (!fallback) {
      const blob = base64ToUint8Array(request.base64);
      const ext = request.isWebm ? ".webm" : ".mp4";
      const fileName = (request.title || "Screenity Recording") + ext;
      response = await saveToDrive(blob, fileName);
    } else {
      // viewer/recovery mode: rebuild blob from IndexedDB chunks
      // Read the asking tab's own slot: the live one holds the newer recording.
      const entry = await retainedEntryForTab(tabId);
      // An entry holding no slot keeps its bytes elsewhere (OPFS, or a slot
      // already reclaimed). chunksStore follows the live take, so it would
      // upload that one under this recording's name.
      if (entry && !entry.slot) {
        return {
          status: "ew",
          url: null,
          error: "No recording data found",
          errorCode: "drive-generic",
        };
      }
      const store = entry?.slot ? instanceForSlot(entry.slot) : chunksStore;
      const chunks = [];
      await store.iterate((value) => chunks.push(value));

      if (chunks.length === 0) {
        console.error("[Drive] drive_upload_failed: no chunks in IndexedDB");
        return { status: "ew", url: null, error: "No recording data found" };
      }

      chunks.sort((a, b) => {
        const ta = a.timestamp ?? a.index ?? 0;
        const tb = b.timestamp ?? b.index ?? 0;
        return ta - tb;
      });

      const parts = chunks.map((c) =>
        c.chunk instanceof Blob ? c.chunk : new Blob([c.chunk])
      );
      const blob = new Blob(parts, { type: "video/webm" });
      const fileName = (request.title || "Screenity Recording") + ".webm";
      response = await saveToDrive(blob, fileName);
    }

    if (response.status === "ok") {
      await savedToDrive(tabId);
    }
    return response;
  } catch (err) {
    const errorCode = classifyDriveError(err);
    console.error("[Drive] handleSaveToDrive failed:", err);
    diagEvent("drive-save-fail", {
      error: String(err.message).slice(0, 120),
      errorCode,
    });
    return { status: "ew", url: null, error: err.message, errorCode };
  }
};
