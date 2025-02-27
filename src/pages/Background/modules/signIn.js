const signIn = async () => {
  try {
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
  } catch (error) {
    console.error("Error signing in:", error.message);
    return null;
    throw error; // Reject the Promise if sign-in fails
  }
};

export default signIn;
