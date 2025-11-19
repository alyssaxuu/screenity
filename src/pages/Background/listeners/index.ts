import { onCommandListener } from "./onCommandListener";
import { onInstalledListener } from "./onInstalledListener";
import { onTabRemovedListener } from "./onTabRemovedListener";
import { onTabActivatedListener } from "./onTabActivatedListener";
import { onTabUpdatedListener } from "./onTabUpdatedListener";
import { onWindowFocusChangedListener } from "./onWindowFocusChangedListener";
import { onActionButtonClickedListener } from "./onActionButtonClickedListener";
import { onStartupListener } from "./onStartupListener";
import { onMessageExternalListener } from "./onMessageExternalListener";

// Initialize all listeners
export const initializeListeners = () => {
  onCommandListener();
  onInstalledListener();
  onTabRemovedListener();
  onTabActivatedListener();
  onTabUpdatedListener();
  onWindowFocusChangedListener();
  onActionButtonClickedListener();
  onStartupListener();
  onMessageExternalListener();
};
