// The editor drops a handoff until its project has loaded. When the page has
// only just opened, replay the ready note for a few seconds more. Every replay
// stays inside the editor's 8 s dedup window, and its toasts show once per project.
const COLD_PAGE_MS = 10000;

export const handoffReplayDelays = (source, pageAgeMs) =>
  source === "update-project-ready" && pageAgeMs < COLD_PAGE_MS
    ? [250, 1000, 3000]
    : [250];
