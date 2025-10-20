// For some reason without this the service worker doesn't always work
export const onStartupListener = async () => {
  chrome.runtime.onStartup.addListener(() => {
    console.log("Service worker started up successfully.");
  });
};
