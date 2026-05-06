import React, { useContext, useState } from "react";
// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const ProBanner = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context

  return (
    <div className="pro-banner">
      <div className="pro-banner-content">
        <div className="pro-banner-right">
          <div className="pro-banner-title">
            Veja todas as suas gravações sincronizadas com a nuvem
          </div>
          <div className="pro-banner-description">
            Veja todas suas gravacoes sincronizadas com a nuvem, ou ative o modo
            backup para ter todas elas sempre localmente.
          </div>
        </div>
      </div>
      <div className="pro-banner-cta">
        <button
          className="button primaryDarkButton"
          onClick={() => {
            setContentState((prevContentState) => ({
              ...prevContentState,
              bannerSupport: false,
            }));
            chrome.runtime.sendMessage({ type: "hide-banner" });
            chrome.tabs.create({ url: "http://slingui.com/recordings" });
          }}
        >
          Ver gravações
        </button>
      </div>
    </div>
  );
};

export default ProBanner;
