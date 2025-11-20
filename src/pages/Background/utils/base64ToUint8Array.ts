/**
 * Converts a base64 string to a Blob (Uint8Array)
 * @param base64 - Base64 encoded string, optionally with data URL prefix
 * @returns Blob object containing the decoded data
 */
export const base64ToUint8Array = (base64: string): Blob => {
  const dataUrlRegex = /^data:(.*?);base64,/;
  const matches = base64.match(dataUrlRegex);

  const decodeBase64 = (base64String: string): Uint8Array => {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  if (matches !== null) {
    // Base64 is a Data URL
    const mimeType = matches[1];
    return new Blob([decodeBase64(base64.slice(matches[0].length))], {
      type: mimeType,
    });
  } else {
    // Base64 is a regular string
    return new Blob([decodeBase64(base64)], { type: "video/webm" });
  }
};

