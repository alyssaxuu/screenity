import React, { useCallback, useEffect, useState } from "react";
import { listHeldTakes } from "./heldTakeList";
import { readTrack, discardHeldTake } from "./heldTakeActions";
import { openExistingChunksStore, TRACK_KEY_PREFIX } from "../CloudRecorder/recorderStorage/chooseChunksStore";
import { destroySessionDir } from "../CloudRecorder/recorderStorage/opfsKvStore";
import { storeHoldsTake } from "../CloudRecorder/localCopyGate";

// File names stay fixed English; the labels on the page are translated.
const LABELS = { screen: "Screen", camera: "Camera", audio: "Audio" };
const trackLabel = (track) =>
  chrome.i18n.getMessage(
    { screen: "heldTakesTrackScreen", camera: "heldTakesTrackCamera", audio: "heldTakesTrackAudio" }[track],
  ) || LABELS[track];
const msg = (key, subs) => chrome.i18n.getMessage(key, subs);

// Same tokens as the content-script modal and popup (_Modal.scss, _variables.scss).
const CSS = `
.ht-page { box-sizing: border-box; max-width: 560px; margin: 0 auto; padding: 56px 20px 64px; font-family: Satoshi-Medium, sans-serif; font-size: 14px; color: #29292f; }
.ht-page *, .ht-page *::before, .ht-page *::after { box-sizing: border-box; }
.ht-head { padding: 0 4px; margin-bottom: 24px; }
.ht-title { margin: 0; font-family: Satoshi-Bold, sans-serif; font-weight: 700; font-size: 18px; line-height: 1.4; }
.ht-intro { margin: 6px 0 0; color: #6e7684; line-height: 1.5; }
.ht-loading { padding: 0 4px; color: #6e7684; }
.ht-list { display: flex; flex-direction: column; gap: 14px; }
.ht-card { background: #fff; border-radius: 22px; padding: 20px; box-shadow: 0px 10px 38px -10px rgba(22, 23, 24, 0.12), 0px 10px 20px -15px rgba(22, 23, 24, 0.08); }
.ht-top { display: flex; align-items: flex-start; gap: 14px; }
.ht-thumb { flex: none; display: flex; align-items: center; justify-content: center; width: 64px; height: 44px; border-radius: 12px; background: #f6f7fb; color: #9797a4; }
.ht-thumb svg { width: 20px; height: 20px; }
.ht-info { min-width: 0; flex: 1; }
.ht-name { font-family: Satoshi-Bold, sans-serif; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.ht-meta { margin-top: 2px; font-size: 12px; color: #6e7684; line-height: 1.4; }
.ht-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ht-chip { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px; border-radius: 30px; background: #f6f7fb; color: #6e7684; font-size: 12px; line-height: 1; }
.ht-chip svg { width: 12px; height: 12px; color: #9797a4; }
.ht-notes { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding: 12px 14px; border-radius: 14px; background: #f6f7fb; }
.ht-note { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; line-height: 1.45; color: #6e7684; }
.ht-note svg { flex: none; width: 14px; height: 14px; margin-top: 1px; color: #9797a4; }
.ht-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px 12px; margin-top: 16px; }
.ht-foot-text { flex: 1 1 200px; font-size: 12px; line-height: 1.45; color: #6e7684; }
.ht-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-left: auto; }
.ht-btn { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; height: 35px; padding: 0 15px; border-radius: 30px; font-size: 14px; line-height: 1; font-weight: 500; font-family: Satoshi-Medium, sans-serif; white-space: nowrap; cursor: pointer; }
.ht-btn:focus-visible { box-shadow: 0px 0px 0px 2px rgba(48, 128, 248, 0.5); }
.ht-btn[disabled] { opacity: .5; cursor: default; }
.ht-blue { background: rgba(48, 128, 248, 0.1); color: #3080f8; }
.ht-blue:hover:not([disabled]) { background: rgba(48, 128, 248, 0.15); }
.ht-red { background: rgba(247, 56, 90, 0.1); color: rgba(247, 56, 90, 1); }
.ht-red:hover:not([disabled]) { background: rgba(247, 56, 90, 0.15); }
.ht-grey { background: rgba(110, 118, 132, 0.1); color: #6e7684; }
.ht-grey:hover { background: rgba(110, 118, 132, 0.15); }
.ht-text { color: #6e7684; }
.ht-text:hover:not([disabled]) { background: rgba(110, 118, 132, 0.05); }
.ht-empty { display: flex; align-items: center; gap: 14px; }
.ht-empty p { margin: 0; color: #6e7684; line-height: 1.5; }
@media (max-width: 480px) {
  .ht-page { padding: 32px 16px 48px; }
  .ht-card { padding: 18px 16px; border-radius: 20px; }
  .ht-thumb { width: 52px; height: 40px; }
}
`;

const Icon = ({ d }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={d} />
  </svg>
);
const ICONS = {
  screen: "M8 21h8m-4-4v4m-5.2-4h10.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C22 14.72 22 13.88 22 12.2V7.8c0-1.68 0-2.52-.327-3.162a3 3 0 0 0-1.311-1.311C19.72 3 18.88 3 17.2 3H6.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C2 5.28 2 6.12 2 7.8v4.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C4.28 17 5.12 17 6.8 17Z",
  camera: "M22 8.931c0-.605 0-.908-.12-1.049a.5.5 0 0 0-.42-.173c-.183.014-.398.228-.826.657L17 12l3.634 3.634c.428.428.642.642.826.657a.5.5 0 0 0 .42-.174c.12-.14.12-.443.12-1.048V8.93ZM2 9.8c0-1.68 0-2.52.327-3.162a3 3 0 0 1 1.311-1.311C4.28 5 5.12 5 6.8 5h5.4c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311C17 7.28 17 8.12 17 9.8v4.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311C14.72 19 13.88 19 12.2 19H6.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C2 16.72 2 15.88 2 14.2V9.8Z",
  audio: "M19 10v2a7 7 0 1 1-14 0v-2m7 9v3m-4 0h8m-4-7a3 3 0 0 1-3-3V5a3 3 0 1 1 6 0v4a3 3 0 0 1-3 3Z",
  done: "m7.5 12 3 3 6-6m5.5 3c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10Z",
};

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7.999 14.665a6.667 6.667 0 1 0 0-13.333 6.667 6.667 0 0 0 0 13.333ZM8 5.332v2.667m0 2.669h.007" />
  </svg>
);

const fmtBytes = (n) => {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
};

const deps = {
  openStore: (tr) =>
    openExistingChunksStore({
      sessionId: tr.opfsSessionId,
      track: tr.track,
      backend: tr.backend,
    }).store,
  keyPrefix: (track) => TRACK_KEY_PREFIX[track],
  storeHoldsTake,
  destroySessionDir,
  storage: {
    get: (k) => chrome.storage.local.get(k),
    set: (o) => chrome.storage.local.set(o),
    remove: (k) => chrome.storage.local.remove(k),
  },
};

const readHeldTrack = async (take, tr) => {
  const { recorderSession } = await chrome.storage.local.get(["recorderSession"]);
  return readTrack(take, tr, deps, recorderSession?.id || null);
};

const HeldTakes = () => {
  const [takes, setTakes] = useState(null);
  const [sizes, setSizes] = useState({});
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const [confirming, setConfirming] = useState(null);

  const refresh = useCallback(async () => {
    const all = await chrome.storage.local.get(null);
    const list = listHeldTakes(all);
    setTakes(list);
    const next = {};
    for (const take of list) {
      for (const tr of take.tracks) {
        try {
          const { entries, owned } = await readHeldTrack(take, tr);
          next[`${take.sessionId}:${tr.track}`] = {
            owned,
            bytes: entries.reduce((n, e) => n + e.chunk.size, 0),
            count: entries.length,
          };
        } catch {
          next[`${take.sessionId}:${tr.track}`] = { owned: false, bytes: 0, count: 0 };
        }
      }
    }
    setSizes(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const exportTake = async (take) => {
    setBusy(take.sessionId);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const urls = [];
    let exported = 0;
    let failed = false;
    for (const tr of take.tracks) {
      try {
        const { entries } = await readHeldTrack(take, tr);
        if (!entries.length) continue;
        const blob = new Blob(
          entries.map((e) => e.chunk),
          { type: tr.mime },
        );
        const url = URL.createObjectURL(blob);
        urls.push(url);
        await chrome.downloads.download({
          url,
          filename: `Screenity-Recovery-${LABELS[tr.track]}-${ts}.${tr.ext}`,
          saveAs: false,
        });
        exported++;
      } catch (err) {
        failed = true;
        console.error("[HeldTakes] export failed", tr.track, err);
      }
    }
    // Exporting never removes anything: the copy stays until it is discarded.
    await new Promise((r) => setTimeout(r, 2000));
    urls.forEach((u) => URL.revokeObjectURL(u));
    setNotes((n) => ({
      ...n,
      [take.sessionId]: failed
        ? msg("heldTakesSaveFailed")
        : exported
          ? msg("heldTakesSaved")
          : msg("heldTakesNoData"),
    }));
    setBusy(null);
  };

  const discardTake = async (take) => {
    setBusy(take.sessionId);
    const { ok, stale } = await discardHeldTake(take, deps);
    if (!ok) {
      setNotes((n) => ({ ...n, [take.sessionId]: msg("heldTakesDiscardFailed") }));
      setBusy(null);
      setConfirming(null);
      if (stale) refresh();
      return;
    }
    setConfirming(null);
    setBusy(null);
    refresh();
  };

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("assets/fonts/fonts.css");
    document.head.appendChild(link);
    document.body.style.background = "#f6f7fb";
    document.body.style.margin = "0";
    return () => link.remove();
  }, []);

  const shell = (children) => (
    <div className="ht-page">
      <style>{CSS}</style>
      {children}
    </div>
  );

  if (takes === null) return shell(<p className="ht-loading">{msg("heldTakesLoading")}</p>);
  const head = (
    <div className="ht-head">
      <h1 className="ht-title">{msg("heldTakesTitle")}</h1>
      {takes.length > 0 && <p className="ht-intro">{msg("heldTakesIntro")}</p>}
    </div>
  );
  if (!takes.length) {
    return shell(
      <>
        {head}
        <div className="ht-card ht-empty">
          <div className="ht-thumb"><Icon d={ICONS.done} /></div>
          <p>{msg("heldTakesEmpty")}</p>
        </div>
      </>,
    );
  }
  return shell(
    <>
      {head}
      <div className="ht-list">
        {takes.map((take) => {
          const partial = take.tracks.some((t) => t.mark);
          const gap = take.tracks.some((t) => t.gapFrom !== null && t.gapFrom !== undefined);
          const total = take.tracks.reduce((n, t) => n + (sizes[`${take.sessionId}:${t.track}`]?.bytes || 0), 0);
          const sized = take.tracks.every((t) => sizes[`${take.sessionId}:${t.track}`]);
          const noData = sized && total === 0;
          const isBusy = busy === take.sessionId;
          const asking = confirming === take.sessionId;
          const note = notes[take.sessionId];
          return (
            <div key={take.sessionId} className="ht-card">
              <div className="ht-top">
                <div className="ht-thumb"><Icon d={ICONS[take.tracks[0]?.track] || ICONS.screen} /></div>
                <div className="ht-info">
                  <div className="ht-name">{take.title || msg("heldTakesUntitled")}</div>
                  <div className="ht-meta">
                    {take.heldAt ? `${new Date(take.heldAt).toLocaleString()} · ` : ""}
                    {msg("heldTakesStored", [fmtBytes(total)])}
                  </div>
                  <div className="ht-chips">
                    {take.tracks.map((t) => (
                      <span key={t.track} className="ht-chip">
                        <Icon d={ICONS[t.track]} />
                        {trackLabel(t.track)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {(partial || gap || noData || take.kind === "retrying") && (
                <div className="ht-notes">
                  {partial && <div className="ht-note"><AlertIcon />{msg("heldTakesPartial")}</div>}
                  {gap && <div className="ht-note"><AlertIcon />{msg("heldTakesGap")}</div>}
                  {noData && <div className="ht-note"><AlertIcon />{msg("heldTakesNoData")}</div>}
                  {take.kind === "retrying" && <div className="ht-note"><AlertIcon />{msg("heldTakesRetrying")}</div>}
                </div>
              )}
              <div className="ht-foot">
                {(asking || note) && (
                  <div className="ht-foot-text" role="status">
                    {asking ? msg("heldTakesDiscardWarning") : note}
                  </div>
                )}
                <div className="ht-actions">
                  {asking ? (
                    <>
                      <button className="ht-btn ht-grey" onClick={() => setConfirming(null)}>
                        {msg("heldTakesKeep")}
                      </button>
                      <button className="ht-btn ht-red" disabled={isBusy} onClick={() => discardTake(take)}>
                        {msg("heldTakesDiscardConfirm")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="ht-btn ht-text" disabled={isBusy} onClick={() => setConfirming(take.sessionId)}>
                        {msg("heldTakesDiscard")}
                      </button>
                      <button className="ht-btn ht-blue" disabled={isBusy || total === 0} onClick={() => exportTake(take)}>
                        {msg("heldTakesSave")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>,
  );
};

export default HeldTakes;
