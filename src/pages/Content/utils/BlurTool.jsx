import React, {
  useLayoutEffect,
  useState,
  useRef,
  useContext,
  useEffect,
} from "react";

// Context
import { contentStateContext } from "../context/ContentState";

const BlurTool = () => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const hoveredElementRef = useRef(null);
  const blurModeRef = useRef(null);
  const [showOutline, setShowOutline] = useState(false);
  const [outlineRect, setOutlineRect] = useState(null);

  useEffect(() => {
    blurModeRef.current = contentState.blurMode;
  }, [contentState.blurMode]);

  useEffect(() => {
    if (!contentState.showExtension) {
      setShowOutline(false);
      // Remove blur from all elements
      const elements = document.querySelectorAll(".screenity-blur");
      elements.forEach((element) => {
        element.classList.remove("screenity-blur");
      });
    }
  }, [contentState.showExtension]);

  useLayoutEffect(() => {
    const updateOutline = (target) => {
      if (!target) return;
      hoveredElementRef.current = target;
      const rect = target.getBoundingClientRect();
      setOutlineRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: target.offsetWidth,
        height: target.offsetHeight,
      });
      setShowOutline(true);
    };

    const handleMouseMove = (event) => {
      if (!blurModeRef.current) {
        setShowOutline(false);
        setOutlineRect(null);
        return;
      }
      const target = event.target;
      if (
        !target.classList.contains("screenity-outline") &&
        !target.closest("#screenity-ui #screenity-ui *")
      ) {
        updateOutline(target);
        document.body.style.cursor = "pointer";
      } else {
        document.body.style.cursor = "auto";
        setShowOutline(false);
        setOutlineRect(null);
      }
    };

    const handleMouseOut = () => {
      setShowOutline(false);
      setOutlineRect(null);
    };

    const handleMouseDown = (event) => {
      if (!blurModeRef.current) {
        setShowOutline(false);
        return;
      }

      const target = event.target;
      if (target.closest("#screenity-ui, #screenity-ui *")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const handleElementClick = (event) => {
      if (!blurModeRef.current) {
        setShowOutline(false);
        return;
      }

      const target = event.target;
      if (target.closest("#screenity-ui, #screenity-ui *")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      target.classList.toggle("screenity-blur");
    };

    const handleMouseUp = (event) => {
      if (!blurModeRef.current) {
        setShowOutline(false);
        setOutlineRect(null);
        return;
      }

      const target = event.target;
      if (target.closest("#screenity-ui, #screenity-ui *")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const handleScroll = () => {
      if (!blurModeRef.current || !hoveredElementRef.current) return;
      updateOutline(hoveredElementRef.current);
    };

    document.body.addEventListener("mousemove", handleMouseMove, true);
    document.body.addEventListener("mousedown", handleMouseDown, true);
    document.body.addEventListener("mouseout", handleMouseOut, true);
    document.body.addEventListener("mouseup", handleMouseUp, true);
    document.body.addEventListener("click", handleElementClick, true);
    document.addEventListener("scroll", handleScroll, true);

    return () => {
      document.body.removeEventListener("mousemove", handleMouseMove, true);
      document.body.removeEventListener("mousedown", handleMouseDown, true);
      document.body.removeEventListener("mouseout", handleMouseOut, true);
      document.body.removeEventListener("mouseup", handleMouseUp, true);
      document.body.removeEventListener("click", handleElementClick, true);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  return (
    <div>
      {showOutline && outlineRect && (
        <div
          className="screenity-outline"
          style={{
            top: outlineRect.top + "px",
            left: outlineRect.left + "px",
            width: outlineRect.width + "px",
            height: outlineRect.height + "px",
          }}
        ></div>
      )}
    </div>
  );
};

export default BlurTool;
