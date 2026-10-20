import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_STEP,
  WPM_MAX,
  WPM_MIN,
  WPM_STEP,
  wpmToPxPerSecond,
} from "./prompterRules";

// Inline styles throughout: this renders inside the Picture-in-Picture
// window, which has none of the page's or the extension's stylesheets.

const msg = (key, fallback) => chrome.i18n.getMessage(key) || fallback;

const LEAD_IN_SECONDS = 3;
const FONT_STACK =
  '"Satoshi-Medium", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SURFACE = "#1b1b1f";
const HAIRLINE = "rgb(255 255 255 / 8%)";
const PRIMARY = "#3080f8";

const pill = {
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 2,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const pillButton = {
  width: 32,
  height: 32,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  flexShrink: 0,
};

const roundButton = { ...pillButton, width: 40, height: 40 };

const textButton = {
  ...pillButton,
  width: "auto",
  height: 36,
  padding: "0 14px",
  borderRadius: 999,
  fontSize: 13,
  fontFamily: "inherit",
  border: `1px solid ${HAIRLINE}`,
};

const stopButton = {
  ...roundButton,
  width: 40,
  height: 40,
  padding: 0,
  background: "transparent",
  border: "none",
};

const menuPanel = {
  position: "absolute",
  top: 48,
  right: 8,
  zIndex: 3,
  minWidth: 236,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  padding: 6,
  background: "#141418",
  border: `1px solid ${HAIRLINE}`,
  borderRadius: 16,
  boxShadow: "0 8px 24px rgb(0 0 0 / 35%)",
  userSelect: "none",
};

const menuItem = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  height: 36,
  padding: "0 12px",
  background: "transparent",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

const CSS = `
.stp-edit::-webkit-scrollbar{width:6px;background:transparent}
.stp-edit::-webkit-scrollbar-track{background:transparent;margin:20px 0}
.stp-edit::-webkit-scrollbar-thumb{background-color:transparent;border-radius:8px;transition:background-color .3s ease}
.stp-edit:hover::-webkit-scrollbar-thumb{background-color:rgb(255 255 255 / 18%)}
.stp-edit:hover::-webkit-scrollbar-thumb:hover{background-color:rgb(255 255 255 / 30%)}
[data-tip]{position:relative}
[data-tip]::after{content:attr(data-tip);position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);white-space:nowrap;background:#29292f;color:#fff;font-family:${FONT_STACK};font-size:12px;line-height:1;padding:7px 12px;border-radius:30px;box-shadow:hsl(206 22% 7% / 35%) 0 10px 38px -10px,hsl(206 22% 7% / 20%) 0 10px 20px -15px;pointer-events:none;user-select:none;z-index:10;opacity:0;visibility:hidden}
[data-tip]:hover::after,[data-tip]:focus-visible::after{visibility:visible;animation:stp-tip .4s cubic-bezier(.16,1,.3,1) .7s both}
@keyframes stp-tip{from{opacity:0;margin-top:2px}to{opacity:1;margin-top:0}}
.stp-bar-controls [data-tip]::after{top:auto;bottom:calc(100% + 8px)}
.stp-pill-top [data-tip]::after{left:auto;right:0;transform:none}
.stp-pill-dim{opacity:.55;transition:opacity .2s ease}
.stp-quiet .stp-quiet-hide{opacity:0;transition:opacity .2s ease}
.stp-quiet:hover .stp-quiet-hide,.stp-quiet .stp-quiet-hide:focus-within{opacity:1}
.stp-root:hover .stp-pill-dim,.stp-pill-dim:focus-within{opacity:1}
.stp-viewport:hover .stp-bar{opacity:1 !important}
.stp-menu-item:hover,.stp-menu-item:focus-visible{background:${HAIRLINE} !important}
.stp-menu-item:focus-visible{outline:none;box-shadow:0 0 0 2px rgb(48 128 248 / 50%)}
.stp-pill-button:hover:not(:disabled){background:${HAIRLINE} !important}
.stp-stop:hover:not(:disabled){filter:brightness(1.12)}
.stp-stop-record{background:none !important}
.stp-stop:disabled{cursor:default}
.stp-stop:disabled>*{opacity:.35}
.stp-stop:focus-visible{outline:none;box-shadow:0 0 0 2px rgb(255 255 255 / 60%)}
.stp-pill-button:disabled{cursor:default}
.stp-pill-button:disabled>*{opacity:.35}
.stp-pill-button:focus-visible{outline:none;box-shadow:0 0 0 2px rgb(48 128 248 / 50%)}
`;

const ICONS = {
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  pause: (
    <>
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </>
  ),
  scroll: (
    <>
      <path d="m7 6 5 5 5-5" />
      <path d="m7 13 5 5 5-5" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M5 12h14M12 5v14" />,
  check: <path d="M20 6 9 17l-5-5" />,
  restart: (
    <>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  discard: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
  mic: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </>
  ),
  micOff: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
      <path d="M2 2l20 20" stroke="#ff5c5c" />
    </>
  ),
};

const RecordingIcon = ({ paused, size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paused ? (
      <path strokeWidth="1.5" d="m3.5 2.5 9 5.5-9 5.5v-11Z" />
    ) : (
      <path strokeWidth="2" d="M4.922 13.538V2.46m6.156 11.078V2.46" />
    )}
  </svg>
);

const MicLevelIcon = ({ on, level = 0 }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ display: "block" }}
  >
    <defs>
      <clipPath id="stp-mic-clip">
        <path
          d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"
          stroke="black"
          strokeWidth="2"
          fill="black"
        />
      </clipPath>
    </defs>
    {on && (
      <g clipPath="url(#stp-mic-clip)">
        <rect
          x="7"
          y="5"
          width="10"
          height="12"
          fill="#30A46C"
          stroke="none"
          style={{
            transform: `translateY(${
              (1 - Math.min(1, Math.max(0, level))) * 12
            }px)`,
            transition: "transform 0.08s linear",
          }}
        />
      </g>
    )}
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
    {!on && <path d="M2 2l20 20" stroke="#ff5c5c" />}
  </svg>
);

const Icon = ({ name, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[name]}
  </svg>
);

/**
 * The scroll loop runs on the PiP window's animation frame
 * (`ownerDocument.defaultView`), not the page's: the PiP has its own frame
 * clock, and the page is usually a background tab while recording a window,
 * where its frames are throttled.
 */
const Teleprompter = ({
  settings,
  onSettings,
  playing,
  canPlay,
  onPlayingChange,
  rewindToken,
  onRewind,
  onHide,
  timerLabel,
  controls,
  showScript = true,
  backdrop = "solid",
  quiet = false,
  paused = false,
  countdown = null,
  hasCamera = false,
  onShowScript,
  canShowScript = true,
}) => {
  const { script, fontSize, wpm, autoScroll } = settings;

  const [editingRequested, setEditingRequested] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const restoreFocusRef = useRef(false);
  const [clearArmed, setClearArmed] = useState(false);
  const hasScript = script.trim().length > 0;
  // Typing during a take would be heard in it, so edit only before the take or while paused.
  const canEdit = !controls || controls.inactive || controls.paused;
  // No placeholder mid-take: an empty script opens the box only while editing is allowed.
  const editing = canEdit && (editingRequested || !hasScript);

  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const moreRef = useRef(null);
  const viewportRef = useRef(null);
  const textRef = useRef(null);
  const barRef = useRef(null);
  const dragRef = useRef(null);
  const offsetRef = useRef(0);
  const wpmRef = useRef(wpm);
  const fontRef = useRef(fontSize);
  wpmRef.current = wpm;
  fontRef.current = fontSize;

  const apply = useCallback(() => {
    const text = textRef.current;
    if (text) text.style.transform = `translateY(${-offsetRef.current}px)`;
    const viewport = viewportRef.current;
    const bar = barRef.current;
    if (viewport && text && bar) {
      const track = viewport.clientHeight - 40;
      const total = text.scrollHeight;
      const ratio = Math.min(1, viewport.clientHeight / Math.max(1, total));
      const thumb = Math.max(24, track * ratio);
      const max = Math.max(1, total - viewport.clientHeight * 0.66);
      const progress = Math.min(1, offsetRef.current / max);
      bar.style.height = `${thumb}px`;
      bar.style.transform = `translateY(${progress * (track - thumb)}px)`;
      bar.style.display = total <= viewport.clientHeight ? "none" : "block";
    }
  }, []);

  // The last line stops a third of the way down, so the end is read where the eyes already are.
  const maxOffset = useCallback(() => {
    const viewport = viewportRef.current;
    const text = textRef.current;
    if (!viewport || !text) return 0;
    return Math.max(0, text.scrollHeight - viewport.clientHeight * 0.66);
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    apply();
  }, [rewindToken, apply]);

  // A shorter script must not leave the text scrolled past its own end.
  useEffect(() => {
    if (!viewportRef.current) return;
    offsetRef.current = Math.min(offsetRef.current, maxOffset());
    apply();
  }, [script, fontSize, apply, maxOffset, showScript]);

  useEffect(() => {
    if (!playing) return undefined;
    const viewport = viewportRef.current;
    const win = viewport?.ownerDocument?.defaultView;
    if (!viewport || !win) return undefined;

    if (offsetRef.current > 0 && offsetRef.current >= maxOffset()) {
      offsetRef.current = 0;
      apply();
    }

    let frame = 0;
    let last = win.performance.now();
    // Hold at the top so the first line can be read before it moves.
    let hold = offsetRef.current === 0 ? LEAD_IN_SECONDS : 0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (hold > 0) {
        hold -= dt;
        frame = win.requestAnimationFrame(tick);
        return;
      }
      const speed = wpmToPxPerSecond(
        wpmRef.current,
        fontRef.current,
        viewport.clientWidth
      );
      const limit = maxOffset();
      offsetRef.current = Math.min(limit, offsetRef.current + speed * dt);
      apply();
      if (offsetRef.current >= limit) {
        onPlayingChange(false);
        return;
      }
      frame = win.requestAnimationFrame(tick);
    };
    frame = win.requestAnimationFrame(tick);
    return () => win.cancelAnimationFrame(frame);
  }, [playing, apply, maxOffset, onPlayingChange, showScript]);

  useEffect(() => {
    if (!menuOpen) setClearArmed(false);
  }, [menuOpen]);

  const closeMenu = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setMenuOpen(false);
  }, []);

  // Focus moves into the menu on open and back to its button when it closes
  // by keyboard or a choice, not when the user clicked elsewhere.
  useEffect(() => {
    if (menuOpen) {
      restoreFocusRef.current = false;
      menuRef.current
        ?.querySelector("button:not(:disabled)")
        ?.focus({ preventScroll: true });
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      moreRef.current?.focus({ preventScroll: true });
    }
  }, [menuOpen]);

  const onMenuKeyDown = (e) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') ||
        []
    );
    if (!items.length) return;
    const active = e.currentTarget.ownerDocument.activeElement;
    const i = items.indexOf(active);
    let next = null;
    if (e.key === "ArrowDown") next = items[(i + 1) % items.length];
    else if (e.key === "ArrowUp")
      next = items[(i - 1 + items.length) % items.length];
    else if (e.key === "Home") next = items[0];
    else if (e.key === "End") next = items[items.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  // Listeners go on the PiP window's document, not the page's.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return undefined;
    const onPointerDown = (e) => {
      if (
        menuRef.current?.contains(e.target) ||
        moreRef.current?.contains(e.target)
      ) {
        return;
      }
      closeMenu(false);
    };
    const win = doc.defaultView;
    const onBlur = () => closeMenu(false);
    win?.addEventListener("blur", onBlur);
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMenu();
    };
    doc.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("keydown", onKeyDown);
    return () => {
      doc.removeEventListener("pointerdown", onPointerDown);
      doc.removeEventListener("keydown", onKeyDown);
      win?.removeEventListener("blur", onBlur);
    };
  }, [menuOpen, closeMenu]);

  // Manual scroll (wheel or drag) pauses auto-scroll; play resumes from there.
  const nudge = (delta) => {
    if (playing) onPlayingChange(false);
    offsetRef.current = Math.max(
      0,
      Math.min(maxOffset(), offsetRef.current + delta)
    );
    apply();
  };
  const onWheel = (e) => nudge(e.deltaY);
  const onPointerDown = (e) => {
    if (editing || e.button !== 0) return;
    dragRef.current = { y: e.clientY, moved: false };
  };
  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    // A press that ended outside the viewport never reached onPointerUp.
    if (e.buttons === 0 && !drag.moved) {
      dragRef.current = null;
      return;
    }
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 4) return;
    if (!drag.moved) e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.moved = true;
    drag.y = e.clientY;
    nudge(-dy);
  };
  const onPointerUp = () => {
    // Keep `moved` until the click that follows a drag is swallowed.
    if (dragRef.current && !dragRef.current.moved) dragRef.current = null;
  };
  const onPointerCancel = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const doc = rootRef.current?.ownerDocument;
    const win = doc?.defaultView;
    if (!doc || !win) return undefined;
    const release = () => {
      if (dragRef.current && !dragRef.current.moved) dragRef.current = null;
    };
    const clear = () => {
      dragRef.current = null;
    };
    doc.addEventListener("pointerup", release);
    doc.addEventListener("pointercancel", clear);
    win.addEventListener("blur", clear);
    return () => {
      doc.removeEventListener("pointerup", release);
      doc.removeEventListener("pointercancel", clear);
      win.removeEventListener("blur", clear);
    };
  }, []);

  // The toolbar floats over the top 40px, so the script fades out there rather
  // than scrolling under the buttons.
  const viewportMask =
    "linear-gradient(to bottom, transparent 0, transparent 36px, #000 58px, #000 86%, transparent 100%)";
  const viewportH = viewportRef.current?.clientHeight || 0;
  // Only a script taller than the window scrolls, and only then does the edit
  // box need the prompter's extra travel.
  const overflows =
    hasScript && (textRef.current?.scrollHeight || 0) > viewportH;
  const playTip = playing
    ? msg("teleprompterPause", "Pause scrolling")
    : canPlay
    ? msg("teleprompterPlay", "Start scrolling")
    : msg(
        "teleprompterPlayDisabled",
        "Scrolls automatically once you start recording"
      );
  const sidePad = "20px";
  // Shared by prompter text and edit box so switching between them shifts nothing.
  const textMetrics = {
    paddingTop: "max(1.6em, 80px)",
    paddingBottom: "3em",
    fontSize,
    lineHeight: 1.5,
    fontWeight: 500,
    textAlign: "center",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };

  // Focus manually with preventScroll: the browser's autofocus scrolls the
  // caret into view and drags the text back to the top.
  const editBoxRef = useRef(null);
  useLayoutEffect(() => {
    const el = editBoxRef.current;
    if (!editing || !el) return;
    el.focus({ preventScroll: true });
    el.scrollTop = offsetRef.current;
  }, [editing]);

  const startEditing = () => {
    if (!canEdit) return;
    onPlayingChange(false);
    setEditingRequested(true);
  };

  const overCamera = backdrop === "none";
  const quietNow = quiet && overCamera && !paused;

  const stepRows = [
    {
      label: msg("teleprompterTextSize", "Text size"),
      value: fontSize,
      less: () => onSettings({ fontSize: fontSize - FONT_STEP }),
      more: () => onSettings({ fontSize: fontSize + FONT_STEP }),
      lessOff: fontSize <= FONT_SIZE_MIN,
      moreOff: fontSize >= FONT_SIZE_MAX,
      lessLabel: msg("teleprompterSmaller", "Smaller text"),
      moreLabel: msg("teleprompterLarger", "Larger text"),
    },
    {
      label: msg("teleprompterSpeed", "Speed"),
      value: `${wpm} ${msg("teleprompterWpmUnit", "wpm")}`,
      less: () => onSettings({ wpm: wpm - WPM_STEP }),
      more: () => onSettings({ wpm: wpm + WPM_STEP }),
      lessOff: wpm <= WPM_MIN,
      moreOff: wpm >= WPM_MAX,
      lessLabel: msg("teleprompterSlower", "Slower"),
      moreLabel: msg("teleprompterFaster", "Faster"),
    },
  ];

  return (
    <div
      className={quietNow ? "stp-root stp-quiet" : "stp-root"}
      ref={rootRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background:
          backdrop === "solid"
            ? SURFACE
            : backdrop === "scrim"
            ? "linear-gradient(rgb(27 27 31 / 82%), rgb(27 27 31 / 64%))"
            : "transparent",
        color: "#fff",
        fontFamily: FONT_STACK,
      }}
    >
      <style>{CSS}</style>

      {showScript ? (
        <div
          ref={viewportRef}
          className="stp-viewport"
          onWheel={editing ? undefined : onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={() => {
            if (dragRef.current?.moved) {
              dragRef.current = null;
              return;
            }
            if (!playing && !editing) startEditing();
          }}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            padding: `0 ${sidePad}`,
            cursor: editing ? "text" : "grab",
            WebkitMaskImage: viewportMask,
            maskImage: viewportMask,
          }}
        >
          <div
            ref={textRef}
            dir="auto"
            style={{
              ...textMetrics,
              visibility: editing ? "hidden" : "visible",
              willChange: "transform",
            }}
          >
            {script}
          </div>

          {editing && (
            <textarea
              ref={editBoxRef}
              dir="auto"
              value={script}
              readOnly={!canEdit}
              onChange={(e) => {
                // Latch editing so the first character in an empty script does
                // not swap the box for the prompter.
                setEditingRequested(true);
                onSettings({ script: e.target.value });
              }}
              // The prompter resumes from the box's scroll position on leaving it.
              onScroll={(e) => {
                offsetRef.current = Math.min(
                  e.currentTarget.scrollTop,
                  maxOffset()
                );
                apply();
              }}
              // An empty script stays in the box (editing is also true when !hasScript).
              // Ignore the blur from the whole window losing focus (copying text elsewhere).
              onBlur={(e) => {
                if (
                  !e.relatedTarget &&
                  !e.currentTarget.ownerDocument.hasFocus()
                )
                  return;
                setEditingRequested(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") e.currentTarget.blur();
              }}
              placeholder={msg(
                "teleprompterPlaceholder",
                "Write or paste your script"
              )}
              aria-label={msg("teleprompterLabel", "Teleprompter")}
              className="stp-edit"
              style={{
                ...textMetrics,
                // Overlays the viewport with matching padding so lines wrap where the prompter draws them.
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                margin: 0,
                paddingLeft: sidePad,
                // The 6px scrollbar lane is reserved (scrollbarGutter) and taken off
                // this side so lines wrap at the prompter's width.
                paddingRight: `calc(${sidePad} - 6px)`,
                paddingBottom: overflows
                  ? `calc(3em + ${viewportH * 0.34}px)`
                  : undefined,
                scrollbarGutter: "stable",
                boxSizing: "border-box",
                resize: "none",
                background: "transparent",
                color: "#fff",
                border: "none",
                outline: "none",
                fontFamily: FONT_STACK,
                overflowY: "auto",
              }}
            />
          )}
          {!editing && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 20,
                right: 6,
                bottom: 20,
                width: 6,
              }}
            >
              <div
                ref={barRef}
                className="stp-bar"
                style={{
                  width: 6,
                  borderRadius: 8,
                  background: "rgb(255 255 255 / 18%)",
                  opacity: 0,
                  transition: "opacity .3s ease",
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {controls?.confirm && (
        <div
          style={{
            flexShrink: 0,
            boxSizing: "border-box",
            padding: "20px 20px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 16,
            background:
              backdrop === "none"
                ? "linear-gradient(transparent, rgb(0 0 0 / 70%))"
                : "linear-gradient(rgb(27 27 31 / 0%), rgb(27 27 31 / 100%) 28px)",
          }}
        >
          <span
            style={{
              fontSize: 15,
              lineHeight: 1.35,
              textAlign: "center",
              textWrap: "balance",
            }}
          >
            {controls.confirm.title}
          </span>
          <span style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="stp-pill-button"
              style={{
                ...textButton,
                flex: 1,
                height: 40,
                justifyContent: "center",
                padding: "0 12px",
              }}
              onClick={controls.confirm.onCancel}
              autoFocus
            >
              {controls.confirm.cancelLabel}
            </button>
            <button
              type="button"
              className="stp-stop"
              style={{
                ...textButton,
                flex: 1,
                height: 40,
                justifyContent: "center",
                padding: "0 12px",
                background: "#df4848",
                border: "none",
                color: "#fff",
                fontWeight: 600,
              }}
              onClick={controls.confirm.onConfirm}
            >
              {controls.confirm.confirmLabel}
            </button>
          </span>
        </div>
      )}
      {controls && !controls.confirm && (
        <div
          className={
            overCamera ? "stp-bar-controls stp-quiet-hide" : "stp-bar-controls"
          }
          style={{
            position: "relative",
            zIndex: 2,
            flexShrink: 0,
            height: 72,
            boxSizing: "border-box",
            paddingBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <button
            type="button"
            className="stp-pill-button"
            style={roundButton}
            onClick={controls.onMic}
            disabled={!controls.micAvailable}
            aria-label={controls.micLabel}
            aria-pressed={
              controls.micAvailable ? Boolean(controls.micOn) : undefined
            }
            data-tip={controls.micLabel}
          >
            <MicLevelIcon
              on={controls.micOn}
              level={controls.micAvailable ? controls.micLevel : 0}
            />
          </button>
          <button
            type="button"
            className="stp-pill-button"
            style={roundButton}
            onClick={controls.paused ? controls.onResume : controls.onPause}
            disabled={controls.busy || controls.inactive}
            aria-label={
              controls.paused ? controls.resumeLabel : controls.pauseLabel
            }
            data-tip={
              controls.paused ? controls.resumeLabel : controls.pauseLabel
            }
          >
            <RecordingIcon paused={controls.paused} />
          </button>
          <button
            type="button"
            className="stp-stop stp-stop-record"
            style={stopButton}
            onClick={controls.inactive ? controls.onRecord : controls.onStop}
            disabled={
              controls.inactive ? controls.recordDisabled : controls.busy
            }
            aria-label={
              controls.inactive ? controls.recordLabel : controls.stopLabel
            }
            data-tip={
              controls.inactive ? controls.recordLabel : controls.stopLabel
            }
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 52 52"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="26" cy="26" r="25" stroke="#DF4848" strokeWidth="2" />
              {controls.inactive ? (
                <circle cx="26" cy="26" r="21" fill="#DF4848" />
              ) : (
                <rect
                  x="15.6875"
                  y="15.6875"
                  width="20.627"
                  height="20.627"
                  rx="5"
                  fill="#DF4848"
                />
              )}
            </svg>
          </button>
          <button
            type="button"
            className="stp-pill-button"
            style={roundButton}
            onClick={controls.onRestart}
            disabled={controls.busy || controls.inactive}
            aria-label={controls.restartLabel}
            data-tip={controls.restartLabel}
          >
            <Icon name="restart" size={20} />
          </button>
          <button
            type="button"
            className="stp-pill-button"
            style={roundButton}
            onClick={controls.onDiscard}
            disabled={controls.busy || controls.inactive}
            aria-label={controls.discardLabel}
            data-tip={controls.discardLabel}
          >
            <Icon name="discard" size={20} />
          </button>
        </div>
      )}

      {overCamera && (
        <div
          aria-hidden="true"
          className="stp-quiet-hide"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 140,
            zIndex: 1,
            pointerEvents: "none",
            background:
              "linear-gradient(transparent, rgb(0 0 0 / 22%) 35%, rgb(0 0 0 / 52%) 70%, rgb(0 0 0 / 68%))",
          }}
        />
      )}

      {overCamera && (
        <div
          aria-hidden="true"
          className="stp-quiet-hide"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 72,
            zIndex: 1,
            pointerEvents: "none",
            background:
              "linear-gradient(rgb(0 0 0 / 42%), rgb(0 0 0 / 30%) 22%, rgb(0 0 0 / 14%) 55%, rgb(0 0 0 / 4%) 82%, transparent)",
          }}
        />
      )}

      {timerLabel && (
        <div
          className={overCamera ? "stp-quiet-hide" : undefined}
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            zIndex: 2,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            fontSize: 14,
            fontVariantNumeric: "tabular-nums",
            color: overCamera ? "#fff" : "rgb(255 255 255 / 72%)",
          }}
        >
          {overCamera ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 26,
                padding: "0 12px",
                borderRadius: 999,
                background: "rgb(20 20 24 / 55%)",
                WebkitBackdropFilter: "blur(10px)",
                backdropFilter: "blur(10px)",
              }}
            >
              {timerLabel}
            </span>
          ) : (
            timerLabel
          )}
        </div>
      )}

      {!showScript && (hasCamera || onShowScript) && (
        <>
          <div
            style={pill}
            className={
              overCamera ? "stp-pill-top stp-quiet-hide" : "stp-pill-top"
            }
          >
            <button
              type="button"
              className="stp-pill-button"
              style={{
                ...pillButton,
                background: menuOpen ? HAIRLINE : "transparent",
              }}
              ref={moreRef}
              onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={msg("teleprompterMore", "More script options")}
              data-tip={msg("teleprompterMore", "More script options")}
            >
              <Icon name="more" />
            </button>
          </div>
          {menuOpen && (
            <div
              ref={menuRef}
              style={menuPanel}
              role="menu"
              aria-label={msg("teleprompterMore", "More script options")}
              onKeyDown={onMenuKeyDown}
            >
              {onShowScript && canShowScript && (
                <button
                  type="button"
                  role="menuitem"
                  className="stp-menu-item"
                  style={menuItem}
                  onClick={() => {
                    closeMenu();
                    onShowScript();
                  }}
                >
                  {msg("teleprompterShow", "Show script")}
                </button>
              )}
              {hasCamera && (
                <button
                  type="button"
                  role="menuitem"
                  className="stp-menu-item"
                  style={menuItem}
                  onClick={() => {
                    onSettings({ showCamera: false });
                    closeMenu();
                  }}
                >
                  {msg("teleprompterHideCamera", "Move camera to the page")}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {paused && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: 12,
            border: "2px solid #ef4444",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {countdown != null && (
        <div
          aria-live="assertive"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgb(0 0 0 / 45%)",
            fontSize: 96,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            pointerEvents: "none",
          }}
        >
          {countdown}
        </div>
      )}

      {showScript && (
        <>
          <div
            style={pill}
            className={playing ? "stp-pill-top stp-pill-dim" : "stp-pill-top"}
          >
            <span data-tip={playTip} style={{ display: "inline-flex" }}>
              <button
                type="button"
                className="stp-pill-button"
                style={{
                  ...pillButton,
                  background: playing ? "rgb(255 255 255 / 16%)" : "transparent",
                }}
                onClick={() => {
                  const atEnd =
                    offsetRef.current > 0 &&
                    offsetRef.current >= maxOffset();
                  if (!playing && atEnd) return;
                  onPlayingChange(!playing);
                }}
                disabled={!hasScript || (!canPlay && !playing)}
                aria-label={playTip}
                aria-pressed={playing}
              >
                <Icon name="scroll" />
              </button>
            </span>
            <button
              type="button"
              className="stp-pill-button"
              style={{
                ...pillButton,
                background: menuOpen ? HAIRLINE : "transparent",
              }}
              ref={moreRef}
              onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label={msg("teleprompterMore", "More script options")}
              data-tip={msg("teleprompterMore", "More script options")}
            >
              <Icon name="more" />
            </button>
          </div>

          {menuOpen && (
            <div
              ref={menuRef}
              style={menuPanel}
              role="dialog"
              aria-label={msg("teleprompterMore", "More script options")}
            >
              {stepRows.map((r) => (
                <div
                  key={r.label}
                  style={{
                    ...menuItem,
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "0 4px 0 12px",
                    boxSizing: "border-box",
                    cursor: "default",
                  }}
                >
                  <span>{r.label}</span>
                  <span
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
                    <button
                      type="button"
                      className="stp-pill-button"
                      style={pillButton}
                      onClick={r.less}
                      disabled={r.lessOff}
                      aria-label={r.lessLabel}
                      data-tip={r.lessLabel}
                    >
                      <Icon name="minus" />
                    </button>
                    <span style={{ minWidth: 56, textAlign: "center" }}>
                      {r.value}
                    </span>
                    <button
                      type="button"
                      className="stp-pill-button"
                      style={pillButton}
                      onClick={r.more}
                      disabled={r.moreOff}
                      aria-label={r.moreLabel}
                      data-tip={r.moreLabel}
                    >
                      <Icon name="plus" />
                    </button>
                  </span>
                </div>
              ))}
              <span
                style={{
                  display: "block",
                  height: 1,
                  margin: "4px 0",
                  background: HAIRLINE,
                }}
                aria-hidden="true"
              />
              <button
                type="button"
                role="switch"
                aria-checked={autoScroll}
                className="stp-menu-item"
                style={{
                  ...menuItem,
                  justifyContent: "space-between",
                  gap: 12,
                }}
                onClick={() => onSettings({ autoScroll: !autoScroll })}
              >
                {msg(
                  "teleprompterScrollOnStart",
                  "Scroll when recording starts"
                )}
                <span
                  style={{ width: 16, display: "inline-flex", color: "#fff" }}
                >
                  {autoScroll && <Icon name="check" />}
                </span>
              </button>
              <button
                type="button"
                className="stp-menu-item"
                style={menuItem}
                onClick={() => {
                  onRewind();
                  closeMenu();
                }}
              >
                {msg("teleprompterRewind", "Scroll back to the top")}
              </button>
              {hasCamera && (
                <button
                  type="button"
                  className="stp-menu-item"
                  style={menuItem}
                  onClick={() => {
                    onSettings({ showCamera: !settings.showCamera });
                    closeMenu();
                  }}
                >
                  {settings.showCamera
                    ? msg("teleprompterHideCamera", "Move camera to the page")
                    : msg("teleprompterShowCamera", "Move camera here")}
                </button>
              )}
              {canEdit && hasScript && (
                <button
                  type="button"
                  className="stp-menu-item"
                  style={
                    clearArmed ? { ...menuItem, color: "#ff5c5c" } : menuItem
                  }
                  onClick={() => {
                    if (!clearArmed) {
                      setClearArmed(true);
                      return;
                    }
                    setClearArmed(false);
                    closeMenu();
                    onSettings({ script: "" });
                  }}
                >
                  {clearArmed
                    ? msg("teleprompterClearConfirm", "Click again to clear")
                    : msg("teleprompterClear", "Clear script")}
                </button>
              )}
              <button
                type="button"
                className="stp-menu-item"
                style={menuItem}
                onClick={() => {
                  closeMenu();
                  onHide();
                }}
              >
                {msg("teleprompterHide", "Hide script")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Teleprompter;
