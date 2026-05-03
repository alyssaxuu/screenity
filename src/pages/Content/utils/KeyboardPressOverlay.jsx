import React, { useEffect, useRef, useContext, useState, useCallback } from "react";
import { contentStateContext } from "../context/ContentState";

// Key display name mapping for special keys
const KEY_DISPLAY_NAMES = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Cmd",
  Enter: "↵",
  Backspace: "⌫",
  Delete: "Del",
  Tab: "Tab",
  Escape: "Esc",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  " ": "Space",
};

// Maximum number of keys to show at once
const MAX_VISIBLE_KEYS = 3;

// Time before a key press fades out (ms)
const KEY_FADE_TIMEOUT = 1000;

const KeyboardPressOverlay = () => {
  const [contentState] = useContext(contentStateContext);
  const contentStateRef = useRef(contentState);
  const [pressedKeys, setPressedKeys] = useState([]);
  const activeKeysRef = useRef(new Set());
  const timeoutsRef = useRef(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  // Get display name for a key
  const getKeyDisplayName = useCallback((key, code) => {
    // Handle modifier keys by code for consistency
    if (code === "ControlLeft" || code === "ControlRight") return "Ctrl";
    if (code === "AltLeft" || code === "AltRight") return "Alt";
    if (code === "ShiftLeft" || code === "ShiftRight") return "Shift";
    if (code === "MetaLeft" || code === "MetaRight") return "Cmd";
    if (code === "Space") return "Space";

    return KEY_DISPLAY_NAMES[key] || key;
  }, []);

  // Remove a key from the display
  const removeKey = useCallback((keyId) => {
    activeKeysRef.current.delete(keyId);
    setPressedKeys((prev) => prev.filter((k) => k.id !== keyId));

    // Clear timeout if exists
    if (timeoutsRef.current.has(keyId)) {
      clearTimeout(timeoutsRef.current.get(keyId));
      timeoutsRef.current.delete(keyId);
    }
  }, []);

  // Add a key to the display
  const addKey = useCallback(
    (key, code) => {
      const keyId = `${code}`;

      // Don't add if already showing
      if (activeKeysRef.current.has(keyId)) {
        // Reset the timeout for this key
        if (timeoutsRef.current.has(keyId)) {
          clearTimeout(timeoutsRef.current.get(keyId));
          timeoutsRef.current.set(
            keyId,
            setTimeout(() => removeKey(keyId), KEY_FADE_TIMEOUT)
          );
        }
        return;
      }

      activeKeysRef.current.add(keyId);

      const displayName = getKeyDisplayName(key, code);
      const newKeyEntry = {
        id: keyId,
        name: displayName,
        timestamp: Date.now(),
      };

      setPressedKeys((prev) => {
        // Keep only the most recent keys up to max
        const updated = [...prev, newKeyEntry].slice(-MAX_VISIBLE_KEYS);
        return updated;
      });

      // Set timeout to remove this key
      const timeoutId = setTimeout(() => {
        removeKey(keyId);
      }, KEY_FADE_TIMEOUT);

      timeoutsRef.current.set(keyId, timeoutId);
    },
    [getKeyDisplayName, removeKey]
  );

  // Handle keydown event
  const handleKeyDown = useCallback(
    (event) => {
      const state = contentStateRef.current;

      // Only track when recording is active and feature is enabled
      if (!state?.recording || !state?.showKeyboardPress) return;

      // Don't track shortcuts that might interfere with browser functionality
      // Only track if it's a "pure" key or simple combination
      const isModifier =
        event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;

      // Track all keys including modifiers
      addKey(event.key, event.code);

      // Also track modifier combinations
      if (isModifier) {
        const modifiers = [];
        if (event.ctrlKey && event.code !== "ControlLeft" && event.code !== "ControlRight") {
          modifiers.push("Ctrl");
        }
        if (event.altKey && event.code !== "AltLeft" && event.code !== "AltRight") {
          modifiers.push("Alt");
        }
        if (event.shiftKey && event.code !== "ShiftLeft" && event.code !== "ShiftRight") {
          modifiers.push("Shift");
        }
        if (event.metaKey && event.code !== "MetaLeft" && event.code !== "MetaRight") {
          modifiers.push("Cmd");
        }

        if (modifiers.length > 0 && !["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
          const comboId = `combo-${modifiers.join("+")}+${event.code}`;
          const comboName = `${modifiers.join(" + ")} + ${getKeyDisplayName(event.key, event.code)}`;

          if (!activeKeysRef.current.has(comboId)) {
            activeKeysRef.current.add(comboId);
            setPressedKeys((prev) => {
              const updated = [
                ...prev,
                { id: comboId, name: comboName, timestamp: Date.now() },
              ].slice(-MAX_VISIBLE_KEYS);
              return updated;
            });

            const timeoutId = setTimeout(() => {
              removeKey(comboId);
            }, KEY_FADE_TIMEOUT);

            timeoutsRef.current.set(comboId, timeoutId);
          }
        }
      }
    },
    [addKey, getKeyDisplayName, removeKey]
  );

  // Handle keyup event - remove modifier keys immediately when released
  const handleKeyUp = useCallback(
    (event) => {
      const state = contentStateRef.current;
      if (!state?.recording || !state?.showKeyboardPress) return;

      const keyId = `${event.code}`;

      // Remove immediately on keyup for modifier keys
      if (
        event.code.startsWith("Control") ||
        event.code.startsWith("Alt") ||
        event.code.startsWith("Shift") ||
        event.code.startsWith("Meta") ||
        event.code === "Space"
      ) {
        removeKey(keyId);
      }
    },
    [removeKey]
  );

  // Set up and tear down keyboard listeners
  useEffect(() => {
    const state = contentStateRef.current;
    if (!state?.showKeyboardPress) return;

    // Use capture phase to ensure we catch all keys
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Clear all timeouts on unmount or when feature disabled
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      timeoutsRef.current.clear();
      activeKeysRef.current.clear();
    };
  }, []);

  // Don't render if not recording or feature disabled
  if (!contentState.recording || !contentState.showKeyboardPress) {
    return null;
  }

  return (
    <div
      className="screenity-keyboard-overlay"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 99999999999,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        alignItems: "flex-end",
      }}
    >
      {pressedKeys.map((keyEntry) => (
        <div
          key={keyEntry.id}
          className="screenity-key-badge"
          style={{
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            color: "#ffffff",
            padding: "8px 16px",
            borderRadius: "8px",
            fontFamily:
              "'Satoshi-Medium', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            animation: "screenity-key-fade-in 0.15s ease-out",
            whiteSpace: "nowrap",
            letterSpacing: "0.5px",
          }}
        >
          {keyEntry.name}
        </div>
      ))}
      <style>{`
        @keyframes screenity-key-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default KeyboardPressOverlay;
