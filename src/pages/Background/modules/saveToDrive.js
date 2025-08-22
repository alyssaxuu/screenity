import signIn from "./signIn";

// Find or create "Screenity" folder
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

const getAuthTokenFromStorage = () =>
  new Promise((resolve, reject) => {
    chrome.storage.local.get(["token"], async ({ token }) => {
      if (chrome.runtime.lastError)
        return reject(new Error(chrome.runtime.lastError));

      const store = (t) => {
        chrome.storage.local.set({ token: t }, () => resolve(t));
      };

      // If no token, sign in
      if (!token) {
        const newToken = await signIn();
        return newToken ? store(newToken) : reject(new Error("Sign-in failed"));
      }

      // Validate / refresh token
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (Date.now() >= payload.exp * 1000) {
          return chrome.identity.getAuthToken(
            { interactive: true },
            (newToken) => {
              if (chrome.runtime.lastError)
                return reject(new Error(chrome.runtime.lastError));
              return store(newToken);
            }
          );
        }
      } catch {
        return chrome.identity.getAuthToken(
          { interactive: true },
          (newToken) => {
            if (chrome.runtime.lastError)
              return reject(new Error(chrome.runtime.lastError));
            return store(newToken);
          }
        );
      }
      resolve(token);
    });
  });

// Upload to Google Drive in Screenity folder
const saveToDrive = async (videoBlob, fileName, sendResponse) => {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await getAuthTokenFromStorage();
      if (!token) throw new Error("Sign-in failed");

      // 1) Upload raw media
      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=media",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": videoBlob.type || "application/octet-stream",
          },
          body: videoBlob,
        }
      );
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const { id: fileId } = await uploadRes.json();
      if (!fileId) throw new Error("No fileId returned");

      // 2) Find/create folder
      const folderId = await findOrCreateScreenityFolder(token);

      // 3) Get current parent (so we can remove it when moving)
      const parentsRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const parentsData = await parentsRes.json();
      const oldParents = Array.isArray(parentsData.parents)
        ? parentsData.parents.join(",")
        : "";

      // 4) Move file into folder + set name
      const moveUrl =
        `https://www.googleapis.com/drive/v3/files/${fileId}` +
        `?addParents=${encodeURIComponent(folderId)}` +
        (oldParents ? `&removeParents=${encodeURIComponent(oldParents)}` : "");

      const metadataRes = await fetch(moveUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ name: fileName }),
      });
      if (!metadataRes.ok)
        throw new Error(`Metadata update failed: ${metadataRes.status}`);

      sendResponse({ status: "ok", url: fileId });
      chrome.tabs.create({
        url: `https://drive.google.com/file/d/${fileId}/view`,
      });
      resolve(`https://drive.google.com/file/d/${fileId}/view`);
    } catch (error) {
      console.error("Error uploading to Google Drive:", error.message);
      sendResponse({ status: "ew", url: null });
      reject(error);
    }
  });
};

export default saveToDrive;
