const logger = (msg) => {
  console.log(`[CSC] ${msg}`);
};

logger("content script client up.");

chrome.runtime.onMessage.addListener((request, _sender, sendResp) => {
  const shouldReload =
    request.from === "backgroundClient" && request.action === "reload-yourself";
  if (shouldReload) {
    sendResp({ from: "contentScriptClient", action: "yes-sir" });
    // wait 100ms for extension reload.
    logger("page will reload to reload content script...");
    setTimeout(() => window.location.reload(), 100);
  }
});
