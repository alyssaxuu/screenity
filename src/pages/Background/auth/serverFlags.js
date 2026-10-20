// Server-controlled flags carried in the /auth/verify response, mirrored into
// chrome.storage.local so the recorders can read them without a network call.
// A flag the server does not send is left as it is, so an older server changes
// nothing; to switch one off the server sends false.
// Tests: tests/unit/serverFlags.test.mjs

// verify field (under user.flags) -> storage key
const FLAG_KEYS = {
  cloud4kRecording: "cloud4kRecording",
};

// Account settings that only apply to subscribers. Non-subscribers keep their
// own local switch, which a mirrored account value would overwrite.
const SUBSCRIBER_FLAG_KEYS = {
  smootherMotion: "smootherMotion",
};

export function flagUpdatesFromUser(user, { subscribed = false } = {}) {
  const updates = {};
  const flags = user?.flags;
  if (!flags || typeof flags !== "object") return updates;
  const copy = (map) => {
    for (const [field, key] of Object.entries(map)) {
      if (typeof flags[field] === "boolean") updates[key] = flags[field];
    }
  };
  copy(FLAG_KEYS);
  if (subscribed === true) copy(SUBSCRIBER_FLAG_KEYS);
  return updates;
}
