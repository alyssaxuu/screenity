const logger = (msg) => {
  console.log(`[Content Script] ${msg}`);
};

logger("Initialized reload listener");

// Listen for reload messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const shouldReload =
    request.from === "backgroundClient" && request.action === "reload-yourself";

  if (shouldReload) {
    logger("Received reload request from background");
    sendResponse({ from: "contentScriptClient", action: "acknowledged" });

    // Short delay before reload to ensure response is sent
    setTimeout(() => {
      logger("Reloading page...");
      window.location.reload();
    }, 100);
  }
});
