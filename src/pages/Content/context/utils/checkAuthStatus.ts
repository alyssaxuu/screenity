export const checkAuthStatus = async (): Promise<any> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "check-auth-status" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "❌ Error checking auth status:",
          chrome.runtime.lastError.message
        );
        resolve({ authenticated: false });
      } else {
        resolve({
          authenticated: !!response?.authenticated,
          user: response?.user ?? null,
          subscribed: !!response?.subscribed,
          proSubscription: response?.proSubscription ?? null,
          cached: response?.cached ?? false,
        });
      }
    });
  });
};
