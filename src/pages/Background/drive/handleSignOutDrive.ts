import { sendMessageTab } from "../tabManagement";

export const handleSignOutDrive = async (): Promise<void> => {
  const { token, sandboxTab } = await chrome.storage.local.get(["token", "sandboxTab"]);
  
  if (token && token !== false) {
    const url = "https://accounts.google.com/o/oauth2/revoke?token=" + token;
    fetch(url);
    chrome.identity.removeCachedAuthToken({ token: token as string });
  }
  
  chrome.storage.local.set({ token: false });
  
  // Update UI to reflect sign-out
  if (sandboxTab) {
    sendMessageTab(sandboxTab, { type: "drive-signed-out" });
  }
};
