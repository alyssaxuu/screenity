import React, { useContext } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";

// Context
import { contentStateContext } from "../../context/ContentState";

const BackgroundEffects = () => {
  const [contentState, setContentState] = React.useContext(contentStateContext);

  // Background images
  const URL =
    "chrome-extension://" +
    chrome.i18n.getMessage("@@extension_id") +
    "/assets/";

  const images = [
    URL + "backgrounds/back1.webp",
    URL + "backgrounds/back2.webp",
    URL + "backgrounds/back3.webp",
    URL + "backgrounds/back4.webp",
    URL + "backgrounds/back5.webp",
    URL + "backgrounds/back6.webp",
  ];

  return (
    <div className="background-effects">
      <ToggleGroup.Root
        className="background-effects-toggle-group"
        type="single"
        defaultValue="blur"
        value={contentState.backgroundEffect}
        onValueChange={(value) => {
          if (value) {
            setContentState((prevContentState) => ({
              ...prevContentState,
              backgroundEffect: value,
            }));
            chrome.storage.local.set({ backgroundEffect: value });
          }
        }}
      >
        <ToggleGroup.Item
          className="background-effect"
          value="blur"
          aria-label="Blur effect"
        >
          <span>{chrome.i18n.getMessage("blurTypeLabel")}</span>
          <img src={URL + "backgrounds/blur.webp"} alt="blur" />
        </ToggleGroup.Item>
        {images.map((image, index) => (
          <ToggleGroup.Item
            className="background-effect"
            value={image}
            aria-label="Background image"
          >
            <img src={image} alt="background" />
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
};

export default BackgroundEffects;
