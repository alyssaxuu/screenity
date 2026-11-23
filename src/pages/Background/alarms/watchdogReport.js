// What the first-chunk watchdog saw when it gave up, for the forensic event.
// Prod could not tell "live track, zero bytes" from "recorder never answered
// the snapshot"; rearm reasons and the snapshot stayed in the local diag ring.
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : "na");

export const watchdogVerdict = (snapshot, snapshotError) => {
  if (!snapshot) return snapshotError ? "no-snapshot" : "empty-snapshot";
  const vt = snapshot?.stream?.videoTrack;
  if (!vt) return "no-video-track";
  if (vt.readyState !== "live") return "track-ended";
  return vt.muted === true ? "track-muted" : "live-unmuted-no-bytes";
};

export const buildWatchdogGaveUp = ({ snapshot, snapshotError, reasons = [], rearms = 0 }) => {
  const vt = snapshot?.stream?.videoTrack || null;
  const p = snapshot?.progress || null;
  const c = snapshot?.counts || null;
  const msg = [
    `rearms=${n(rearms)}`,
    `reasons=${reasons.slice(-6).join(",") || "none"}`,
    `snapErr=${snapshotError || "none"}`,
    `vt=${vt ? `${vt.readyState}/${vt.muted === true ? "muted" : "unmuted"}` : "na"}`,
    `rec=${snapshot?.recorder?.state || "na"}`,
    `frames=${n(p?.frameCount)}/${n(p?.framesFromMSTP)}`,
    `saved=${n(c?.saved)} pend=${n(c?.pendingBytes)}`,
  ].join(" ");
  return { reason: watchdogVerdict(snapshot, snapshotError), errMsg: msg.slice(0, 280) };
};
