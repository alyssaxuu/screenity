// For some reason without this the service worker doesn't always work
export const onStartupListener = async (): Promise<void> => {
  chrome.runtime.onStartup.addListener(() => {
    console.log("Service worker started up successfully.");
  });
};
