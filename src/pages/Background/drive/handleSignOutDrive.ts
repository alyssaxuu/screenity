import { sendMessageTab } from "../tabManagement";

export const handleSignOutDrive = async (): Promise<void> => {
  const result = await chrome.storage.local.get(["token", "sandboxTab"]);
  const token = result.token as string | false | undefined;
  const sandboxTab = result.sandboxTab as number | undefined;
  
  if (token && typeof token === "string") {
    const url = "https://accounts.google.com/o/oauth2/revoke?token=" + token;
    fetch(url);
    chrome.identity.removeCachedAuthToken({ token: token });
  }
  
  chrome.storage.local.set({ token: false });
  
  // Update UI to reflect sign-out
  if (sandboxTab) {
    sendMessageTab(sandboxTab, { type: "drive-signed-out" });
  }
};
