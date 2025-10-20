const querystring = require("querystring");

const logger = (msg) => {
  console.log(`[Background] ${msg}`);
};

logger("Initializing auto-reload client");

// Parse port from query string
const port = querystring.parse(__resourceQuery.slice(1)).port;

// Connect to SSE endpoint
const es = new EventSource(`http://localhost:${port}/__server_sent_events__`);

// Handle connection events
es.addEventListener(
  "open",
  () => {
    logger("Connected to dev server");
  },
  false
);

es.addEventListener(
  "error",
  (event) => {
    if (event.target.readyState === 0) {
      console.error(
        "[Background] Dev server connection failed - is it running?"
      );
    } else {
      console.error("[Background] SSE error:", event);
    }
  },
  false
);

// Handle background script update events
es.addEventListener(
  "background-updated",
  () => {
    logger("Background script updated, reloading extension...");
    chrome.runtime.reload();
  },
  false
);

// Handle content script update events
es.addEventListener(
  "content-scripts-updated",
  () => {
    logger("Content scripts updated, notifying tabs...");

    // Query all tabs to send reload messages
    chrome.tabs.query({}, (tabs) => {
      const reloadPromises = tabs.map((tab) => {
        return new Promise((resolve) => {
          try {
            chrome.tabs.sendMessage(
              tab.id,
              { from: "backgroundClient", action: "reload-yourself" },
              (response) => {
                // Handle any runtime errors from sendMessage
                if (chrome.runtime.lastError) {
                  // Tab might not have content script running, ignore error
                  resolve(false);
                  return;
                }

                if (response && response.from === "contentScriptClient") {
                  logger(`Tab ${tab.id} acknowledged reload request`);
                  resolve(true);
                } else {
                  resolve(false);
                }
              }
            );
          } catch (err) {
            logger(`Error sending message to tab ${tab.id}: ${err.message}`);
            resolve(false);
          }
        });
      });

      // Wait for all tabs to respond or timeout
      Promise.all(reloadPromises).then((results) => {
        const successCount = results.filter(Boolean).length;
        logger(`${successCount}/${tabs.length} tabs acknowledged reload`);

        // Only reload extension if we got at least one successful tab response
        if (successCount > 0) {
          logger("Reloading extension to apply content script changes");
          es.close();
          chrome.runtime.reload();
        }
      });
    });
  },
  false
);
