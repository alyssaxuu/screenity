// The separated-mic upload flag, one key per take: takes finishing side by side
// in the host document must not overwrite or clear each other's flag. The bare
// key is an older build's single shared flag and is still honoured.
export const LEGACY_MIC_UPLOAD_FLAG_KEY = "micUploadInFlight";
const PREFIX = `${LEGACY_MIC_UPLOAD_FLAG_KEY}:`;

// A tab-hosted take has no frame take id; its scene id is just as unique.
export const micUploadFlagKey = ({ takeId = null, sceneId = null } = {}) => {
  if (takeId) return `${PREFIX}${takeId}`;
  if (sceneId) return `${PREFIX}scene:${sceneId}`;
  return LEGACY_MIC_UPLOAD_FLAG_KEY;
};

export const isMicUploadFlagKey = (key) =>
  key === LEGACY_MIC_UPLOAD_FLAG_KEY || String(key).startsWith(PREFIX);

// Every flag in storage, as { key: flag }. getKeys needs Chrome 130; older
// Chrome lists keys with a full read. The legacy key is always asked for.
export const readMicUploadFlags = async () => {
  const local = chrome.storage.local;
  let keys = [];
  try {
    keys =
      typeof local.getKeys === "function"
        ? await local.getKeys()
        : Object.keys((await local.get(null)) || {});
  } catch {}
  const wanted = [
    ...new Set([LEGACY_MIC_UPLOAD_FLAG_KEY, ...keys.filter(isMicUploadFlagKey)]),
  ];
  return (await local.get(wanted)) || {};
};
