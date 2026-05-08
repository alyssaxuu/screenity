export const handleSignOutDrive = async () => {
  const { token } = await chrome.storage.local.get(["token"]);
  // POST keeps the token out of URL history, referrer headers, and access logs.
  fetch("https://accounts.google.com/o/oauth2/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `token=${encodeURIComponent(token)}`,
  });

  chrome.identity.removeCachedAuthToken({ token: token });
  chrome.storage.local.set({ token: false });
};
