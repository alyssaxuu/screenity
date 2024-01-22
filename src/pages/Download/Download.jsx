import React, { useState, useCallback, useEffect } from "react";

import Localbase from "localbase";

const db = new Localbase("db");
db.config.debug = false;

const Download = () => {
  const base64ToUint8Array = (base64) => {
    const dataUrlRegex = /^data:(.*?);base64,/;
    const matches = base64.match(dataUrlRegex);
    if (matches !== null) {
      // Base64 is a data URL
      const mimeType = matches[1];
      const binaryString = atob(base64.slice(matches[0].length));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeType });
    } else {
      // Base64 is a regular string
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: "video/webm" });
    }
  };

  const handleMessage = useCallback((message, sender, sendResponse) => {
    if (message.type === "download-video") {
      const base64 = message.base64;
      const blob = base64ToUint8Array(base64);
      const title = message.title;
      const url = URL.createObjectURL(blob);
      chrome.downloads
        .download({
          url: url,
          filename: title,
          saveAs: true,
        })
        .then(() => {
          URL.revokeObjectURL(url);
          // Close this tab
          window.close();
        });
    } else if (message.type === "recover-indexed-db") {
      // Download the whole chunks collection
      db.collection("chunks")
        .get()
        .then((chunks) => {
          const chunkArray = [];
          for (const chunk of chunks) {
            chunkArray.push(chunk.chunk);
          }
          const blob = new Blob(chunkArray, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          chrome.downloads
            .download({
              url: url,
              filename: "recovered-video.webm",
              saveAs: true,
            })
            .then(() => {
              URL.revokeObjectURL(url);
              // Close this tab
              window.close();
            });
        });
    }
  });

  useEffect(() => {
    // chrome on message
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message);
    });

    return () => {
      chrome.runtime.onMessage.removeListener(
        (message, sender, sendResponse) => {
          handleMessage(message);
        }
      );
    };
  }, []);

  return <div></div>;
};

export default Download;
