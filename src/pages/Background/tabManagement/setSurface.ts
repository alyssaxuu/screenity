import { sendMessageTab } from "../tabManagement";
import { loginWithWebsite } from "../auth/loginWithWebsite";
import type { ExtensionMessage } from "../../../types/messaging";

interface SetSurfaceRequest extends ExtensionMessage {
  surface: string;
}

export const setSurface = async (request: SetSurfaceRequest): Promise<void> => {
  await chrome.storage.local.set({ surface: request.surface });

  const result = await loginWithWebsite();
  const activeResult = await chrome.storage.local.get(["activeTab"]);
  const activeTab = activeResult.activeTab as number | undefined;

  if (!activeTab) return;

  sendMessageTab(activeTab, {
    type: "set-surface",
    surface: request.surface,
    subscribed: result?.subscribed || false,
  });
};
