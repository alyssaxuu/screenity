import React from "react";

import {
  CopyLinkIcon,
  MoreActionsIcon,
  LockIcon,
} from "../../images/popup/images";

const VideoItem = ({ title, date, thumbnail, isPublic, onOpen, onCopyLink }) => {
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInSeconds = Math.floor((now - then) / 1000);

    const thresholds = [
      { unit: "year", seconds: 31536000 },
      { unit: "month", seconds: 2592000 },
      { unit: "week", seconds: 604800 },
      { unit: "day", seconds: 86400 },
      { unit: "hour", seconds: 3600 },
      { unit: "minute", seconds: 60 },
      { unit: "second", seconds: 1 },
    ];

    for (const { unit, seconds } of thresholds) {
      const value = Math.floor(diffInSeconds / seconds);
      if (value >= 1) {
        return `${value} ${unit}${value !== 1 ? "s" : ""} ago`;
      }
    }

    return "just now";
  };

  return (
    <div
      className="video-item-root"
      tabIndex="0"
      onClick={(e) => {
        if (
          e.target.closest(".copy-link") ||
          e.target.closest(".more-actions")
        ) {
          e.stopPropagation();
          return;
        }
        onOpen();
      }}
    >
      <div className="video-item">
        <div className="video-item-left">
          {thumbnail && (
            <div className="video-item-thumbnail">
              <img src={thumbnail} alt="" loading="lazy" decoding="async" />
            </div>
          )}
          <div className="video-item-info">
            <div className="video-item-info-title">{title}</div>
            <div className="video-item-info-date">
              {isPublic === false && (
                <img
                  className="video-item-lock"
                  src={LockIcon}
                  alt={chrome.i18n.getMessage("privateVideoTooltip")}
                  title={chrome.i18n.getMessage("privateVideoTooltip")}
                />
              )}
              {formatRelativeTime(date)}
            </div>
          </div>
        </div>
        <div className="video-item-right">
          <button
            role="button"
            tabIndex="0"
            className="copy-link"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCopyLink();
            }}
          >
            <img src={CopyLinkIcon} alt="Copy link" />
          </button>
          {/* <button
            role="button"
            tabIndex="0"
            title="More actions"
            className="more-actions"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <img src={MoreActionsIcon} alt="More actions" />
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default VideoItem;
