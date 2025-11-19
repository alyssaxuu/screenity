import { base64ToUint8Array } from "../utils/base64ToUint8Array";
import { sendMessageTab } from "../tabManagement";
import signIn from "../modules/signIn";

const findOrCreateScreenityFolder = async (token: any): Promise<any> => {
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

const getAuthTokenFromStorage = async (): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    chrome.storage.local.get(["token"], async (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const token = result.token as string | undefined;
      if (!token) {
        const newToken = await signIn();
        if (!newToken) reject(new Error("Sign-in failed"));
        else resolve(newToken);
        return;
      }

      let payload: { exp: number; [key: string]: any };
      try {
        payload = JSON.parse(atob(token.split(".")[1])) as { exp: number; [key: string]: any };
      } catch {
        // Token is invalid, sign in again
        const newToken = await signIn();
        if (!newToken) reject(new Error("Sign-in failed"));
        else resolve(newToken);
        return;
      }

      const exp = payload.exp * 1000;
      if (Date.now() >= exp) {
        // Token is expired, sign in again
        const newToken = await signIn();
        if (!newToken) reject(new Error("Sign-in failed"));
        else resolve(newToken);
      } else {
        resolve(token);
      }
    });
  });
};

const saveToDrive = async (videoBlob: Blob, fileName: string): Promise<DriveUploadResponse> => {
  try {
    const token = await getAuthTokenFromStorage();
    if (!token) throw new Error("Sign-in failed");

    const folderId = await findOrCreateScreenityFolder(token);

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = "-------314159265358979323846";
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const reader = new FileReader();

    const base64Data = await new Promise<string>((resolve) => {
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result.split(",")[1]);
      };
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
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const { id: fileId } = await uploadResponse.json();
    if (!fileId) throw new Error("File ID missing after upload");

    chrome.tabs.create({
      url: `https://drive.google.com/file/d/${fileId}/view`,
    });

    return { status: "ok", url: fileId };
  } catch (error) {
    console.error("Error uploading to Google Drive:", error.message);
    return { status: "ew", url: null };
  }
};

const savedToDrive = async (): Promise<any> => {
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  sendMessageTab(sandboxTab, { type: "saved-to-drive" });
};

export const handleSaveToDrive = async (
  request: SaveToDriveRequest,
  fallback: boolean = false
): Promise<DriveUploadResponse> => {
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
