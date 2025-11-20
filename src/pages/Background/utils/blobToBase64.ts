/**
 * Converts a Blob to a base64 data URL string
 * @param blob - Blob object to convert
 * @returns Promise that resolves to base64 data URL string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
};

