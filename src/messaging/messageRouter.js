const handlers = {};

export const registerMessage = (type, handler) => {
  if (handlers[type]) {
    console.warn(
      `⚠️ Handler for ${type} already exists in this context. Skipping.`
    );
    return;
  }
  handlers[type] = handler;
};

export const messageDispatcher = (message, sender, sendResponse) => {
  const handler = handlers[message.type];

  if (handler) {
    try {
      const result = handler(message, sender, sendResponse);

      if (result instanceof Promise) {
        result
          .then((response) => {
            sendResponse(response);
          })
          .catch((err) => {
            sendResponse({ error: err.message });
          });

        return true;
      } else {
        sendResponse(result);
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  }
};

export const messageRouter = () => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const result = messageDispatcher(message, sender, sendResponse);

    if (result === true || result instanceof Promise) {
      return true;
    }
  });
};
