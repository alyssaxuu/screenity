import React, { useEffect, useState } from "react";

const Setup = () => {
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    // Inject content script
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("contentScript.bundle.js");
    script.async = true;
    document.body.appendChild(script);

    // Also inject CSS
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.type = "text/css";
    style.href = chrome.runtime.getURL("assets/fonts/fonts.css");
    document.body.appendChild(style);

    // Return
    return () => {
      document.body.removeChild(script);
      document.body.removeChild(style);
    };
  }, []);

  useEffect(() => {
    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponse
    ) {
      if (request.type === "setup-complete") {
        setSetupComplete(true);
      }
    });
  }, []);

  return (
    <div className="setupBackground">
      {!setupComplete && (
        <div className="setupContainer">
          <div className="setupImage">
            <img src={chrome.runtime.getURL("assets/helper/pin.gif")} />
          </div>
          <div className="setupText">
            <div className="setupEmoji">👋</div>
            <div className="setupTitle">
              {chrome.i18n.getMessage("setupTitle")}
            </div>
            <div className="setupDescription">
              <div className="setupStep">
                {chrome.i18n.getMessage("setupStep1Before")}
                <span>
                  <img
                    src={chrome.runtime.getURL("assets/helper/puzzle.svg")}
                  />
                </span>
                {chrome.i18n.getMessage("setupStep1After")}
              </div>
              <div className="setupStep">
                {chrome.i18n.getMessage("setupStep2Before")}
                <span>
                  <img src={chrome.runtime.getURL("assets/helper/pin.svg")} />
                </span>{" "}
                {chrome.i18n.getMessage("setupStep2After")}
              </div>
              <div className="setupStep">
                {chrome.i18n.getMessage("setupStep3Before")}
                <span>
                  <img
                    src={chrome.runtime.getURL(
                      "assets/helper/mini-screenity.png"
                    )}
                  />
                </span>
                {chrome.i18n.getMessage("setupStep3After")}
              </div>
            </div>
          </div>
        </div>
      )}
      {setupComplete && (
        <div className="setupContainer center">
          <div className="setupText center">
            <div className="setupEmoji">🥳</div>
            <div className="setupTitle">
              {chrome.i18n.getMessage("setupCompleteTitle")}
            </div>
            <div className="setupDescription">
              {chrome.i18n.getMessage("setupCompleteDescription")}
            </div>
          </div>
        </div>
      )}
      <img
        className="setupLogo"
        src={chrome.runtime.getURL("assets/logo-text.svg")}
      />
      <style>
        {`
				body {
					overflow: hidden;
					margin: 0px;
					margin: 0;
	padding: 0;
	min-height: 100%;
		background-color: #F6F7FB!important;
		background: url('` +
          chrome.runtime.getURL("assets/helper/pattern-svg.svg") +
          `') repeat;
		background-size: 62px 23.5px;
		animation: moveBackground 138s linear infinite;
		transform: rotate(0deg);
				}

				.setupInfo {
					margin-top: 20px;
				}
				a {
					text-decoration: none!important;
					color: #4C7DE2;
				}
				
				@keyframes moveBackground {
					0% {
						background-position: 0 0;
					}
					100% {
						background-position: 100% 0;
					}
				}


				.setupLogo {
					position: absolute;
					bottom: 30px;
					left: 0px;
					right: 0px;
					margin: auto;
					width: 120px;
				}


				.setupBackground {
					height: 100vh;
					width: 100vw;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				.setupContainer {
					position: absolute;
					top: 0px;
					left: 0px;
					right: 0px;
					bottom: 0px;
					margin: auto;
					z-index: 999;
					display: flex;
					justify-content: center;
					align-items: center;
					width: 60%;
					height: fit-content;
					background-color: #fff;
					border-radius: 30px;
					padding: 50px 50px;
					gap: 80px;
					font-family: 'Satoshi-Medium', sans-serif;
				}

				.setupImage {
					width: 70%;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				.setupImage img {
					width: 100%;
					border-radius: 30px;
				}

				.setupText {
					width: 50%;
					display: flex;
					flex-direction: column;
					justify-content: left;
					align-items: left;
					text-align: left;
				}

				.setupEmoji {
					font-size: 20px;
					margin-bottom: 10px;
				}

				.setupTitle {
					font-size: 20px;
					font-weight: bold;
					margin-bottom: 10px;
					color: #29292F;
					font-family: 'Satoshi-Bold', sans-serif!important;
					letter-spacing: -0.5px;
				}

				.setupDescription {
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: left;
					margin-top: 10px;
					color: #6E7684;
					font-size: 14px;
				}

				.setupStep {
					margin-bottom: 10px;
					vertical-align: middle;
				}

				.setupStep span {

					align-items: center;
					justify-content: center;
					text-align: center;
					width: 20px;
					height: 20px;
					padding: 2px;
					border-radius: 30px;
					display: inline-flex;
					vertical-align: middle;
					margin-left: 3px;
					margin-right: 3px;
					background-color: #F4F2F2;
				}

				.setupStep img {
					width: 100%;
					text-align: center;
					display: block;
				}

				.center {
					text-align: center!important;
				}
				.setupText.center {
					width: auto!important;
				}
				.setupContainer.center {
					width: 40%!important;
				}
				
				@media only screen and (max-width: 800px) {
					.setupContainer {
						flex-direction: column;
						gap: 40px;

					}

					.setupText, .setupImage {
						width: 100%!important;
					}
				}

				@media only screen and (max-width: 500px) {
					.setupContainer {
						width: 80%!important;
						padding: 20px!important;
					}
					.setupTitle {
						font-size: 18px!important;
					}
					.setupDescription {
						font-size: 12px!important;
					}
					.setupStep {
						font-size: 12px!important;
					}
				}


				`}
      </style>
    </div>
  );
};

export default Setup;
