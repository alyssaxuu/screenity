import { base64ToUint8Array } from "../utils/base64ToUint8Array";
import { sendMessageTab } from "../tabManagement";
import { chunksStore } from "../recording/chunkHandler";
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

      // Check JWT expiry if possible; opaque tokens skip this check.
      let isExpired = false;
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp * 1000;
          isExpired = Date.now() >= exp;
        }
        // Not a JWT — skip expiry check
      } catch {
        // Not parseable — use as-is
      }

      if (isExpired) {
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

const saveToDrive = async (videoBlob, fileName) => {
  try {
    const token = await getAuthTokenFromStorage();
    if (!token) throw new Error("Sign-in failed");

    diagEvent("drive-upload-start", {
      blobSize: videoBlob.size,
      blobType: videoBlob.type,
    });

    const folderId = await findOrCreateScreenityFolder(token);

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const reader = new FileReader();

    const base64Data = await new Promise((resolve, reject) => {
      reader.onload = (e) => resolve(e.target.result.split(",")[1]);
      reader.onerror = () =>
        reject(new Error("FileReader failed to read blob"));
      reader.readAsDataURL(videoBlob);
    });

    const multipartBody =
      delimiter +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${videoBlob.type}\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      base64Data +
      close_delim;

    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadResponse.ok) {
      const errBody = await uploadResponse.text().catch(() => "");
      console.error("[Drive] drive_upload_failed", {
        status: uploadResponse.status,
        body: errBody,
      });
      throw new Error(`Upload failed: ${uploadResponse.status} ${errBody}`);
    }

    const { id: fileId } = await uploadResponse.json();
    if (!fileId) throw new Error("File ID missing after upload");

    diagEvent("drive-upload-ok", { fileId });

    chrome.tabs.create({
      url: `https://drive.google.com/file/d/${fileId}/view`,
    });

    return { status: "ok", url: fileId };
  } catch (error) {
    console.error("[Drive] drive_upload_failed:", error.message);
    diagEvent("drive-upload-fail", { error: String(error.message).slice(0, 120) });
    return { status: "ew", url: null, error: error.message };
  }
};

const savedToDrive = async () => {
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

export const handleSaveToDrive = async (request, fallback = false) => {
  try {
    let response;

    if (!fallback) {
      const blob = base64ToUint8Array(request.base64);
      const ext = request.isWebm ? ".webm" : ".mp4";
      const fileName = (request.title || "Screenity Recording") + ext;
      response = await saveToDrive(blob, fileName);
    } else {
      // Build blob from IndexedDB chunks (viewer/recovery mode)
      const chunks = [];
      await chunksStore.iterate((value) => chunks.push(value));

      if (chunks.length === 0) {
        console.error("[Drive] drive_upload_failed: no chunks in IndexedDB");
        return { status: "ew", url: null, error: "No recording data found" };
      }

      // Sort to ensure correct order
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
      await savedToDrive();
    }
    return response;
  } catch (err) {
    console.error("[Drive] handleSaveToDrive failed:", err);
    diagEvent("drive-save-fail", { error: String(err.message).slice(0, 120) });
    return { status: "ew", url: null, error: err.message };
  }
};
