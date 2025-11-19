export const createTab = async (
  url: string,
  translate: boolean = false,
  active: boolean = false
): Promise<chrome.tabs.Tab | undefined> => {
  if (!url) return;

  if (translate) {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      url =
        "http://translate.google.com/translate?js=n&sl=auto&tl=" +
        locale +
        "&u=" +
        url;
    }
  }

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
