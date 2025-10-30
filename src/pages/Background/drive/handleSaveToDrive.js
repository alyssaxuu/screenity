import { base64ToUint8Array } from "../utils/base64ToUint8Array";
import { sendMessageTab } from "../tabManagement";
import signIn from "../modules/signIn";

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

  const newFolder = await createRes.json();
  return newFolder.id;
};

const getAuthTokenFromStorage = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["token"], async (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError));
        return;
      }

      const token = result.token;
      if (!token) {
        const newToken = await signIn();
        if (!newToken) reject(new Error("Sign-in failed"));
        else resolve(newToken);
        return;
      }

      let payload;
      try {
        payload = JSON.parse(atob(token.split(".")[1]));
      } catch {
        chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError));
          else resolve(newToken);
        });
        return;
      }

      const exp = payload.exp * 1000;
      if (Date.now() >= exp) {
        chrome.identity.getAuthToken({ interactive: true }, (newToken) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError));
          else resolve(newToken);
        });
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

    // Upload the raw media
    const uploadResponse = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=media",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": videoBlob.type,
        },
        body: videoBlob,
      }
    );

    if (!uploadResponse.ok)
      throw new Error(`Upload failed: ${uploadResponse.status}`);

    const { id: fileId } = await uploadResponse.json();
    if (!fileId) throw new Error("File ID is undefined");

    // Add metadata and move to folder
    const folderId = await findOrCreateScreenityFolder(token);
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          name: fileName,
          parents: [folderId],
        }),
      }
    );

    if (!metadataResponse.ok)
      throw new Error(`Metadata update failed: ${metadataResponse.status}`);

    // Open the file in Drive
    chrome.tabs.create({
      url: `https://drive.google.com/file/d/${fileId}/view`,
    });

    return { status: "ok", url: fileId };
  } catch (error) {
    console.error("Error uploading to Google Drive:", error.message);
    return { status: "ew", url: null };
  }
};

const savedToDrive = async () => {
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  sendMessageTab(sandboxTab, { type: "saved-to-drive" });
};

export const handleSaveToDrive = async (request, fallback = false) => {
  try {
    let response;

    if (!fallback) {
      const blob = base64ToUint8Array(request.base64);
      const fileName = request.title + ".mp4";
      response = await saveToDrive(blob, fileName);
    } else {
      const chunks = [];
      await chunksStore.iterate((value) => chunks.push(value));

      let array = [];
      let lastTimestamp = 0;
      for (const chunk of chunks) {
        if (chunk.timestamp < lastTimestamp) continue;
        lastTimestamp = chunk.timestamp;
        array.push(chunk.chunk);
      }

      const blob = new Blob(array, { type: "video/webm" });
      const fileName = request.title + ".webm";
      response = await saveToDrive(blob, fileName);
    }

    await savedToDrive();
    return response;
  } catch (err) {
    console.error("handleSaveToDrive failed:", err);
    return { status: "ew", url: null };
  }
};
