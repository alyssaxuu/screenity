export const createTab = async (url, active = false) => {
  if (!url) return;

  return new Promise((resolve) => {
    chrome.tabs.create(
      {
        url: url,
        active: active,
      },
      (tab) => {
        resolve(tab);
      }
    );
  });
};
