import React from "react";

import { CopyLinkIcon, MoreActionsIcon } from "../../images/popup/images";

const VideoItem = (props) => {
  return (
    <div className="video-item-root" tabIndex="0">
      <div className="video-item">
        <div className="video-item-left">
          <div
            className="video-item-thumbnail"
            style={{
              backgroundImage: "url(" + props.thumbnail + ")",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          ></div>
          <div className="video-item-info">
            <div className="video-item-info-title">{props.title}</div>
            <div className="video-item-info-date">{props.date}</div>
          </div>
        </div>
        <div className="video-item-right">
          <button role="button" tabIndex="0" className="copy-link">
            <img src={CopyLinkIcon} />
            Copy link
          </button>
          <button
            role="button"
            tabIndex="0"
            title="More actions"
            className="more-actions"
          >
            <img src={MoreActionsIcon} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoItem;
