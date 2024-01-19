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
    const handleMouseMove = (event) => {
      if (!blurModeRef.current) {
        setShowOutline(false);
        return;
      }
      const target = event.target;
      if (
        !target.classList.contains("screenity-outline") &&
        !target.closest("#screenity-ui #screenity-ui *")
      ) {
        hoveredElementRef.current = target;
        setShowOutline(true);
        document.body.style.cursor = "pointer";
      } else {
        document.body.style.cursor = "auto";
      }
    };

    const handleMouseOut = () => {
      setShowOutline(false);
    };

    const handleElementClick = (event) => {
      if (!blurModeRef.current) {
        setShowOutline(false);
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      if (target.closest("#screenity-ui, #screenity-ui *")) {
        return;
      }
      target.classList.toggle("screenity-blur");
    };

    document.body.addEventListener("mouseover", handleMouseMove);
    document.body.addEventListener("mouseout", handleMouseOut);
    document.body.addEventListener("click", handleElementClick);

    return () => {
      document.body.removeEventListener("mouseover", handleMouseMove);
      document.body.removeEventListener("mouseout", handleMouseOut);
      document.body.removeEventListener("click", handleElementClick);
    };
  }, []);

  return (
    <div>
      {showOutline && (
        <div
          className="screenity-outline"
          style={{
            top:
              hoveredElementRef.current.getBoundingClientRect().top +
              window.scrollY +
              "px",
            left:
              hoveredElementRef.current.getBoundingClientRect().left +
              window.scrollX +
              "px",
            width: hoveredElementRef.current.offsetWidth + "px",
            height: hoveredElementRef.current.offsetHeight + "px",
          }}
        ></div>
      )}
    </div>
  );
};

export default BlurTool;
