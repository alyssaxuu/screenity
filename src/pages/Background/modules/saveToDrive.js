import signIn from "./signIn";

// Function to upload a video to Google Drive
const saveToDrive = async (videoBlob, fileName, sendResponse) => {
  // Function to get an access token from Chrome storage
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
      const fileMetadata = {
        name: fileName,
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

export default saveToDrive;
