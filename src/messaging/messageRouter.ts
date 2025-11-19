import type { ExtensionMessage } from "../types/messaging";

type MessageHandler = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => any;

const handlers: Record<string, MessageHandler> = {};

/**
 * Registers a message handler for a specific message type
 * @param type - Message type to handle
 * @param handler - Handler function
 */
export const registerMessage = (type: string, handler: MessageHandler): void => {
  if (handlers[type]) {
    console.warn(
      `⚠️ Handler for ${type} already exists in this context. Skipping.`
    );
    return;
  }
  handlers[type] = handler;
};

/**
 * Dispatches a message to the appropriate handler
 * @param message - Message to dispatch
 * @param sender - Message sender information
 * @param sendResponse - Response callback
 * @returns true if handler returned a promise
 */
export const messageDispatcher = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean | void => {
  const handler = handlers[message.type];

  if (handler) {
    try {
      const result = handler(message, sender, sendResponse);

      if (result instanceof Promise) {
        result
          .then((response) => {
            sendResponse(response);
          })
          .catch((err: Error) => {
            sendResponse({ error: err.message });
          });

        return true;
      } else {
        sendResponse(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      sendResponse({ error: error.message });
    }
  }
};

/**
 * Sets up the message router to listen for Chrome extension messages
 */
export const messageRouter = (): void => {
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ): boolean | void => {
      const result = messageDispatcher(message, sender, sendResponse);

      if (result === true) {
        return true;
      }
      // If result is a Promise, return true to keep channel open
      if (result && typeof result === 'object' && 'then' in result) {
        return true;
      }
    }
  );
};

