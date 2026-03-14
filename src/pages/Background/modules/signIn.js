const isEdge = navigator.userAgent.includes("Edg");

const EDGE_CLIENT_ID =
  "560517327251-856rbcshgori6mft9slnsaq34p21td3n.apps.googleusercontent.com";
const REDIRECT_URI = isEdge ? chrome.identity.getRedirectURL() : "";

const signInEdge = async () => {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", EDGE_CLIENT_ID);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/drive.file"
  );

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.href,
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError) {
          console.error("[Drive] drive_auth_failed: Edge auth error:", chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!redirectUrl) {
          console.error("[Drive] drive_auth_failed: no redirect URL (user cancelled?)");
          reject(new Error("User cancelled sign-in or failed to get token"));
          return;
        }

        // Extract token from redirect URL
        const url = new URL(redirectUrl);
        const params = new URLSearchParams(url.hash.substring(1));
        const token = params.get("access_token");

        if (!token) {
          console.error("[Drive] drive_auth_failed: no access_token in redirect");
          reject(new Error("Failed to extract token from redirect"));
          return;
        }

        // Save token to storage
        await new Promise((res) =>
          chrome.storage.local.set({ token }, () => res())
        );

        resolve(token);
      }
    );
  });
};

const signInChrome = async () => {
  const token = await chrome.identity.getAuthToken({ interactive: true });

  if (!token) {
    console.error("[Drive] drive_auth_failed: getAuthToken returned null");
    throw new Error("User cancelled sign-in or failed to get token");
  }

  // Save token to storage
  await new Promise((resolve) =>
    chrome.storage.local.set({ token: token.token }, () => resolve())
  );

  return token.token;
};

const signIn = async () => {
  try {
    if (isEdge) {
      return await signInEdge();
    } else {
      return await signInChrome();
    }
  } catch (error) {
    console.error("[Drive] drive_auth_failed:", error.message);
    return null;
  }
};

export default signIn;
