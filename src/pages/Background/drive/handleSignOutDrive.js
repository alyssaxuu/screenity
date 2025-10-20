export const handleSignOutDrive = async () => {
  const { token } = await chrome.storage.local.get(["token"]);
  var url = "https://accounts.google.com/o/oauth2/revoke?token=" + token;
  fetch(url);

  chrome.identity.removeCachedAuthToken({ token: token });
  chrome.storage.local.set({ token: false });
};
