import { sendMessageTab } from "../tabManagement";
import { loginWithWebsite } from "../auth/loginWithWebsite";

export const setSurface = async (request: any): Promise<any> => {
  await chrome.storage.local.set({ surface: request.surface });

  const result = await loginWithWebsite();
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  sendMessageTab(activeTab, {
    type: "set-surface",
    surface: request.surface,
    subscribed: result?.subscribed || false,
  });
};
