import { base64ToUint8Array } from "../utils/base64ToUint8Array";
import { sendMessageTab } from "../tabManagement";
import signIn from "../modules/signIn";

const findOrCreateScreenityFolder = async (token) => {
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  });

  // Try to find existing folder
  const query = encodeURIComponent(
    `name='Screenity' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    { headers }
  );

  const result = await searchRes.json();
  if (result.files?.length) {
    return result.files[0].id; // Folder already exists
  }

  // Otherwise, create the folder
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

const saveToDrive = async (videoBlob, fileName, sendResponse) => {
  async function getAuthTokenFromStorage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["token"], async (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError));
        } else {
          const token = result.token;
          if (!token || token === null) {
            // Token is not set, trigger sign-in
            const newToken = await signIn();
            if (!newToken || newToken === null) {
              // Sign-in failed, throw an error
              reject(new Error("Sign-in failed"));
            }
            resolve(newToken);
          } else {
            // Token is set, check if it has expired
            let payload;
            try {
              payload = JSON.parse(atob(token.split(".")[1]));
            } catch (err) {
              // Token is invalid, refresh it
              chrome.identity.getAuthToken(
                { interactive: true },
                (newToken) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                  } else {
                    resolve(newToken);
                  }
                }
              );
              return;
            }

            const expirationTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            if (currentTime >= expirationTime) {
              // Token has expired, refresh it
              chrome.identity.getAuthToken(
                { interactive: true },
                (newToken) => {
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                  } else {
                    resolve(newToken);
                  }
                }
              );
            } else {
              // Token is still valid
              resolve(token);
            }
          }
        }
      });
    });
  }

  return new Promise(async (resolve, reject) => {
    try {
      // Get the access token from Chrome storage
      let token = await getAuthTokenFromStorage();

      if (!token || token === null) {
        throw new Error("Sign-in failed");
      }

      // Upload the video to Google Drive
      const headers = new Headers({
        Authorization: `Bearer ${token}`,
        "Content-Type": videoBlob.type,
      });

      const uploadResponse = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=media",
        {
          method: "POST",
          headers,
          body: videoBlob,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(
          `Error uploading to Google Drive: ${uploadResponse.status}`
        );
      }

      const responseData = await uploadResponse.json();
      const fileId = responseData.id;

      if (!fileId) {
        throw new Error("File ID is undefined");
      }

      // Create the metadata for the file
      const folderId = await findOrCreateScreenityFolder(token);
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      // Update the file metadata with the name
      const metadataResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}`,
        {
          method: "PATCH",
          headers: new Headers({
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
          }),
          body: JSON.stringify(fileMetadata),
        }
      );

      if (!metadataResponse.ok) {
        const errorResponse = await metadataResponse.json();
        console.error(
          "Error updating file metadata:",
          metadataResponse.status,
          errorResponse.error.message
        );
        throw new Error(
          `Error updating file metadata: ${metadataResponse.status}`
        );
      }
      sendResponse({ status: "ok", url: fileId });

      // Open the Google Drive file in a new tab
      chrome.tabs.create({
        url: `https://drive.google.com/file/d/${fileId}/view`,
      });

      resolve(`https://drive.google.com/file/d/${fileId}/view`); // Return the file ID if needed
    } catch (error) {
      console.error("Error uploading to Google Drive:", error.message);
      sendResponse({ status: "ew", url: null });
      reject(error);
    }
  });
};

const savedToDrive = async () => {
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  sendMessageTab(sandboxTab, { type: "saved-to-drive" });
};

export const handleSaveToDrive = async (
  sendResponse,
  request,
  fallback = false
) => {
  if (!fallback) {
    const blob = base64ToUint8Array(request.base64);

    const fileName = request.title + ".mp4";

    saveToDrive(blob, fileName, sendResponse).then(() => {
      savedToDrive();
    });
  } else {
    const chunks = [];
    await chunksStore.iterate((value, key) => {
      chunks.push(value);
    });

    // Build the video from chunks
    let array = [];
    let lastTimestamp = 0;
    for (const chunk of chunks) {
      // Check if chunk timestamp is smaller than last timestamp, if so, skip
      if (chunk.timestamp < lastTimestamp) {
        continue;
      }
      lastTimestamp = chunk.timestamp;
      array.push(chunk.chunk);
    }
    const blob = new Blob(array, { type: "video/webm" });

    const filename = request.title + ".webm";

    saveToDrive(blob, filename, sendResponse).then(() => {
      savedToDrive();
    });
  }
};
