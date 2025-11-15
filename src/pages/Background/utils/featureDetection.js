export const supportsWebCodecsUA = () => {
  try {
    const ua = navigator.userAgent;
    const chromeMatch = ua.match(/Chrom(?:e|ium|iumWebview)\/([0-9]+)/);
    if (chromeMatch) return parseInt(chromeMatch[1], 10) >= 94;

    const safariMatch = ua.match(/Version\/([0-9]+\.[0-9]+).*Safari/);
    if (safariMatch && !chromeMatch) return parseFloat(safariMatch[1]) >= 16.4;

    const operaMatch = ua.match(/OPR\/([0-9]+)/);
    if (operaMatch) return parseInt(operaMatch[1], 10) >= 80;

    const edgeMatch = ua.match(/Edg\/([0-9]+)/);
    if (edgeMatch) return parseInt(edgeMatch[1], 10) >= 94;

    return false;
  } catch {
    return false;
  }
};

export const getBrowserCapabilities = () => {
  const ua = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "Unknown";

  const chromeMatch = ua.match(/Chrom(?:e|ium)\/([0-9]+)/);
  if (chromeMatch) {
    browserName = "Chrome";
    browserVersion = chromeMatch[1];
  }

  const safariMatch = ua.match(/Version\/([0-9]+\.[0-9]+).*Safari/);
  if (safariMatch && !chromeMatch) {
    browserName = "Safari";
    browserVersion = safariMatch[1];
  }

  const firefoxMatch = ua.match(/Firefox\/([0-9]+)/);
  if (firefoxMatch) {
    browserName = "Firefox";
    browserVersion = firefoxMatch[1];
  }

  const operaMatch = ua.match(/OPR\/([0-9]+)/);
  if (operaMatch) {
    browserName = "Opera";
    browserVersion = operaMatch[1];
  }

  const edgeMatch = ua.match(/Edg\/([0-9]+)/);
  if (edgeMatch) {
    browserName = "Edge";
    browserVersion = edgeMatch[1];
  }

  return {
    webCodecsUA: supportsWebCodecsUA(),
    browser: browserName,
    version: browserVersion,
    userAgent: ua,
  };
};

export const supportsWebCodecs = async () => {
  const { realWebCodecsSupport } = await chrome.storage.local.get(
    "realWebCodecsSupport"
  );

  if (realWebCodecsSupport === true) return true;

  return supportsWebCodecsUA();
};
