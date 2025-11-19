export const executeScripts = async (): Promise<void> => {
  const manifest = chrome.runtime.getManifest();
  const contentScripts = manifest.content_scripts || [];
  const tabQueries = contentScripts.map((cs) =>
    chrome.tabs.query({ url: cs.matches })
  );
  const tabResults = await Promise.all(tabQueries);

  const executeScriptPromises: Promise<any>[] = [];
  for (let i = 0; i < tabResults.length; i++) {
    const tabs = tabResults[i];
    const cs = contentScripts[i];

    for (const tab of tabs) {
      if (tab.id && cs.js) {
        const executeScriptPromise = chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            files: cs.js,
          },
          () => chrome.runtime.lastError
        );
        executeScriptPromises.push(executeScriptPromise);
      }
    }
  }

  await Promise.all(executeScriptPromises);
};
