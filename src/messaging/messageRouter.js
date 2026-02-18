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
    let responseSent = false;
    const safeSendResponse = (payload) => {
      if (responseSent) return;
      responseSent = true;
      sendResponse(payload);
    };

    try {
      const result = handler(message, sender, safeSendResponse);

      if (result instanceof Promise) {
        result
          .then((response) => {
            if (!responseSent && response !== undefined) {
              safeSendResponse(response);
            }
          })
          .catch((err) => {
            if (!responseSent) {
              safeSendResponse({ error: err.message });
            }
          });

        return true;
      } else if (result === true) {
        return true;
      } else {
        if (result !== undefined && !responseSent) {
          safeSendResponse(result);
        }
      }
    } catch (err) {
      if (!responseSent) {
        safeSendResponse({ error: err.message });
      }
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
