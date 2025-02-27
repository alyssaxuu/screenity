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

export default base64ToUint8Array;
