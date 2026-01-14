import React, { useEffect, useContext, useRef } from "react";

// Context
import { contentStateContext } from "../context/ContentState";
import { undoCanvas, redoCanvas, saveCanvas } from "../canvas/modules/History";

const Shortcuts = ({ shortcuts }) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const contentStateRef = useRef(contentState);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);
  /* For the record, this is the shortcuts object:
	shortcuts: {
      "start-recording": "ctrl+shift+1",
      "stop-recording": "ctrl+shift+2",
      "pause-recording": "ctrl+shift+3",
      "resume-recording": "ctrl+shift+4",
      "dismiss-recording": "ctrl+shift+5",
      "restart-recording": "ctrl+shift+6",
      "toggle-drawing-mode": "ctrl+shift+7",
    },
	*/

  // Set up all the hotkeys programmatically from the shortcuts object, without using useEffect

  /*
  useHotkeys(shortcuts["toggle-drawing-mode"], () => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      drawingMode: !prevContentState.drawingMode,
    }));
  });
  */

  // in-app shortcuts for screenity tools
  useEffect(() => {
    const getDeepActiveElement = () => {
      let active = document.activeElement;
      while (active && active.shadowRoot && active.shadowRoot.activeElement) {
        active = active.shadowRoot.activeElement;
      }
      return active;
    };

    const isEditableElement = (element) => {
      if (!element) return false;
      if (element.isContentEditable) return true;
      const tag = element.tagName ? element.tagName.toLowerCase() : "";
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const isTextEditingActive = () => {
      const state = contentStateRef.current;
      if (state?.tool !== "text") return false;
      const activeObj = state?.canvas?.getActiveObject?.();
      return Boolean(activeObj && activeObj.isEditing);
    };

    const shouldHandleShortcut = (event) => {
      const state = contentStateRef.current;
      if (!state?.drawingMode && !state?.blurMode) return false;
      if (event.altKey || event.ctrlKey || event.metaKey) return false;

      const active = getDeepActiveElement();
      if (isEditableElement(active)) return false;
      if (isTextEditingActive()) return false;

      return true;
    };

    const getDigitKey = (event) => {
      if (event.code && event.code.startsWith("Digit")) {
        return event.code.replace("Digit", "");
      }
      if (event.code && event.code.startsWith("Numpad")) {
        return event.code.replace("Numpad", "");
      }
      if (event.key >= "0" && event.key <= "9") {
        return event.key;
      }
      return null;
    };

    const setTool = (tool, nextShape) => {
      setContentState((prev) => ({
        ...prev,
        tool,
        ...(nextShape ? nextShape : {}),
      }));
    };

    const clearDrawings = () => {
      const state = contentStateRef.current;
      if (!state?.canvas) return;
      state.canvas.clear();
      state.canvas.renderAll();
      state.canvas.requestRenderAll();
      saveCanvas(state, setContentState);
    };

    const clearBlurMasks = () => {
      const blurredElements = document.querySelectorAll(".screenity-blur");
      blurredElements.forEach((element) => {
        element.classList.remove("screenity-blur");
      });
    };

    const getShadowRoot = () =>
      contentStateRef.current?.shadowRef?.shadowRoot || null;

    const toggleColorPicker = () => {
      const shadowRoot = getShadowRoot();
      const trigger = shadowRoot
        ? shadowRoot.querySelector("[data-color-trigger]")
        : document.querySelector("[data-color-trigger]");
      if (trigger) {
        trigger.click();
      }
    };

    const openImagePicker = () => {
      const shadowRoot = getShadowRoot();
      const fileInput = shadowRoot
        ? shadowRoot.querySelector('[data-image-upload="true"]')
        : document.querySelector('[data-image-upload="true"]');
      if (fileInput) {
        fileInput.click();
      }
    };

    const deriveCursorMode = (effects, fallback) => {
      if (effects.length === 0) return "none";
      if (effects.length === 1) return effects[0];
      return fallback || effects[0] || "none";
    };

    const clearCursorEffects = () => {
      setContentState((prev) => ({
        ...prev,
        cursorEffects: [],
        cursorMode: "none",
      }));
      chrome.storage.local.set({
        cursorEffects: [],
        cursorMode: "none",
      });
    };

    const toggleCursorEffect = (effect) => {
      const state = contentStateRef.current;
      const current = Array.isArray(state.cursorEffects)
        ? state.cursorEffects
        : [];
      const next = current.includes(effect)
        ? current.filter((item) => item !== effect)
        : [...current, effect];
      const nextMode = deriveCursorMode(next, effect);

      setContentState((prev) => ({
        ...prev,
        cursorEffects: next,
        cursorMode: nextMode,
      }));
      chrome.storage.local.set({
        cursorEffects: next,
        cursorMode: nextMode,
      });
    };

    const handleKeyDown = (event) => {
      const state = contentStateRef.current;
      if (state?.drawingMode && (event.ctrlKey || event.metaKey)) {
        const key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          undoCanvas(state, setContentState);
          return;
        }
        if ((key === "z" && event.shiftKey) || key === "y") {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          redoCanvas(state, setContentState);
          return;
        }
      }

      if (!shouldHandleShortcut(event)) return;
      const digitKey = getDigitKey(event);
      if (!digitKey) return;

      let handled = true;
      if (state?.drawingMode) {
        switch (digitKey) {
          case "1":
            setTool("select");
            break;
          case "2":
            setTool("pen");
            break;
          case "3":
            setTool("highlighter");
            break;
          case "4":
            setTool("eraser");
            break;
          case "5":
            toggleColorPicker();
            break;
          case "6":
            setTool("text");
            break;
          case "7":
            setTool("shape", { shape: "rectangle", shapeFill: false });
            break;
          case "8":
            setTool("arrow");
            break;
          case "9":
            openImagePicker();
            break;
          case "0":
            clearDrawings();
            break;
          default:
            handled = false;
        }
      } else {
        switch (digitKey) {
          case "0":
            if (state?.blurMode) {
              clearBlurMasks();
            }
            clearCursorEffects();
            break;
          case "1":
            toggleCursorEffect("target");
            break;
          case "2":
            toggleCursorEffect("highlight");
            break;
          case "3":
            toggleCursorEffect("spotlight");
            break;
          default:
            handled = false;
        }
      }
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  // Push to talk (while Alt/Option + Shift + J key is pressed enable microphone, disable on key up)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!contentStateRef.current.pushToTalk) return;
      if (event.code === "KeyU" && event.altKey && event.shiftKey) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          micActive: true,
        }));

        chrome.storage.local.set({
          micActive: true,
        });

        chrome.runtime.sendMessage({
          type: "set-mic-active-tab",
          active: true,
          defaultAudioInput: contentState.defaultAudioInput,
        });
      }
    };

    const handleKeyUp = (event) => {
      if (!contentStateRef.current.pushToTalk) return;
      if (event.code === "KeyU" && event.altKey && event.shiftKey) {
        setContentState((prevContentState) => ({
          ...prevContentState,
          micActive: false,
        }));

        chrome.storage.local.set({
          micActive: false,
        });

        chrome.runtime.sendMessage({
          type: "set-mic-active-tab",
          active: false,
          defaultAudioInput: contentState.defaultAudioInput,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return <></>;
};

export default Shortcuts;
