import React from "react";
import Warning from "./Warning";
import GradientBackground from "./GradientBackground";

// shared loading/preparing screen for the recorder pages; copy and finalize-failure buttons come in as props/children
const RecorderShell = ({
  title,
  subtitle,
  started,
  isTab,
  warningAlwaysInteractive = false,
  children = null,
}) => {
  return (
    <div className="wrap">
      <img
        className="logo"
        src={chrome.runtime.getURL("assets/logo-text.svg")}
        alt="Screenity logo"
      />
      <div className="middle-area">
        <img
          src={chrome.runtime.getURL("assets/record-tab-active.svg")}
          alt="Recording icon"
        />
        <div className="title">{title}</div>
        <div className="subtitle">{subtitle}</div>
        {children}
      </div>

      {!isTab && !started && (
        <Warning alwaysInteractive={warningAlwaysInteractive} />
      )}

      <GradientBackground subtle />

      <style>
        {`
          body {
            overflow: hidden;
          }
          .button-stop {
            padding: 10px 20px;
            background: #FFF;
            border-radius: 30px;
            color: #29292F;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            margin-top: 0px;
            border: 1px solid #E8E8E8;
            margin-left: auto;
            margin-right: auto;
            z-index: 999999;
          }
          .logo {
            position: absolute;
            bottom: 30px;
            left: 0px;
            right: 0px;
            margin: auto;
            width: 120px;
          }
          .wrap {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: #F6F7FB;
            isolation: isolate;
          }
          .middle-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            font-family: "Satoshi Medium", sans-serif;
          }
          .middle-area img {
            width: 40px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 24px;
            font-weight: 700;
            color: #1A1A1A;
            margin-bottom: 14px;
            font-family: Satoshi-Medium, sans-serif;
            text-align: center;
          }
          .subtitle {
            font-size: 14px;
            font-weight: 400;
            color: #6E7684;
            margin-bottom: 24px;
            font-family: Satoshi-Medium, sans-serif;
            text-align: center;
          }
        `}
      </style>
    </div>
  );
};

export default RecorderShell;
