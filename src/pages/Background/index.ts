import { initializeListeners } from "./listeners";
import { setupHandlers } from "./messaging/handlers";
import {
  messageRouter,
  messageDispatcher,
} from "../../messaging/messageRouter";

// Initialize message router
messageRouter();

// Start all listeners
initializeListeners();

// Set up message handlers
setupHandlers();
