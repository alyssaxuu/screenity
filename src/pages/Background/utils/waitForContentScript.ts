/**
 * Waits for a content script in the specified tab to be ready.
 * @param tabId - The ID of the tab to wait for.
 * @param interval - The interval in ms to ping the tab (default: 500ms).
 * @param timeout - The max timeout in ms to wait (default: 10000ms).
 * @returns Promise that resolves when the content script responds, rejects if it times out.
 */
export const waitForContentScript = async (
  tabId: number,
  interval: number = 500,
  timeout: number = 10000
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const maxAttempts = Math.floor(timeout / interval);
    let attempts = 0;

    const intervalId = setInterval(() => {
      attempts++;

      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        console.error(`❌ Content script did not respond within ${timeout}ms.`);
        reject(new Error(`Content script did not respond within ${timeout}ms`));
        return;
      }

      // Ping the content script
      chrome.tabs.sendMessage(tabId, { type: "ping" }, (response) => {
        if (response?.status === "ready") {
          clearInterval(intervalId);
          resolve();
        }
      });
    }, interval);
  });
};

