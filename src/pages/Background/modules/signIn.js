const signIn = async () => {
  try {
    // Check if the browser is Microsoft Edge
    const isEdge = navigator.userAgent.includes('Edg');
    
    if (isEdge) {
      // For Edge, use the launchWebAuthFlow method instead
      // Use the published extension's redirect URI for consistency
      const publishedExtensionId = 'kbbdabhdfibnancpjfhlkhafgdilcnji';
      const redirectUri = `https://${publishedExtensionId}.chromiumapp.org/`;
      const clientId = "560517327251-m7n1k3kddknu7s9s4ejvrs1bj91gutd7.apps.googleusercontent.com";
      const scopes = "https://www.googleapis.com/auth/drive.file";
      
      // Construct the OAuth URL
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `response_type=token&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}`;
      
      // Use launchWebAuthFlow for Edge
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      
      // Extract the token from the response URL
      const tokenMatch = responseUrl.match(/access_token=([^&]+)/);
      if (!tokenMatch) {
        throw new Error("Failed to extract token from response");
      }
      
      const token = tokenMatch[1];
      
      // Save token to storage
      await new Promise((resolve) =>
        chrome.storage.local.set({ token: token }, () => resolve())
      );
      
      return token;
    } else {
      // For Chrome, use the standard getAuthToken method
      const token = await chrome.identity.getAuthToken({ interactive: true });

      if (!token) {
        throw new Error("User cancelled sign-in or failed to get token");
      }

      // Save token to storage
      await new Promise((resolve) =>
        chrome.storage.local.set({ token: token.token }, () => resolve())
      );

      const userInfo = await chrome.identity.getProfileUserInfo();

      return token.token; // Return the token if sign-in is successful
    }
  } catch (error) {
    console.error("Error signing in:", error.message);
    return null;
    throw error; // Reject the Promise if sign-in fails
  }
};

export default signIn;
