async function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert Blob to ArrayBuffer"));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export default blobToArrayBuffer;
