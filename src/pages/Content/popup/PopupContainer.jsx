import React, {
  useState,
  useEffect,
  useContext,
  useLayoutEffect,
  useRef,
} from "react";
import * as Tabs from "@radix-ui/react-tabs";

import {
  RecordTabActive,
  RecordTabInactive,
  VideoTabActive,
  VideoTabInactive,
  TempLogo,
  ProfilePic,
} from "../images/popup/images";

import { Rnd } from "react-rnd";

import {
  CloseIconPopup,
  GrabIconPopup,
  HelpIconPopup,
} from "../toolbar/components/SVG";

/* Component import */
import RecordingTab from "./layout/RecordingTab";
import VideosTab from "./layout/VideosTab";

// Layouts
import Announcement from "./layout/Announcement";
import SettingsMenu from "./layout/SettingsMenu";

// Context
import { contentStateContext } from "../context/ContentState";

const PopupContainer = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const contentStateRef = useRef(contentState);
  const [tab, setTab] = useState("record");
  const [badge, setBadge] = useState(TempLogo);
  const DragRef = useRef(null);
  const PopupRef = useRef(null);
  const [elastic, setElastic] = React.useState("");
  const [shake, setShake] = React.useState("");
  const [dragging, setDragging] = React.useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [open, setOpen] = useState(false);
  const recordTabRef = useRef(null);
  const videoTabRef = useRef(null);
  const pillRef = useRef(null);
  const [URL, setURL] = useState("https://help.screenity.io/");

  useEffect(() => {
    // Check chrome storage
    chrome.storage.local.get(["updatingFromOld"], function (result) {
      if (result.updatingFromOld) {
        setOnboarding(true);
      }
    });
  }, []);

  useEffect(() => {
    const locale = chrome.i18n.getMessage("@@ui_locale");
    if (!locale.includes("en")) {
      setURL(
        `https://translate.google.com/translate?sl=en&tl=${locale}&u=https://help.screenity.io/`
      );
    }
  }, []);

  const onValueChange = (tab) => {
    setTab(tab);
    if (tab === "record") {
      setBadge(TempLogo);
    } else {
      setBadge(ProfilePic);
    }
    setContentState((prevContentState) => ({
      ...prevContentState,
      bigTab: tab,
    }));
  };

  useEffect(() => {
    setTab(contentState.bigTab);
  }, []);

  useEffect(() => {
    if (!recordTabRef.current) return;
    if (!videoTabRef.current) return;
    if (!pillRef.current) return;

    if (tab === "record") {
      pillRef.current.style.left = recordTabRef.current.offsetLeft + "px";
      pillRef.current.style.width =
        recordTabRef.current.getBoundingClientRect().width + "px";
    } else {
      pillRef.current.style.left = videoTabRef.current.offsetLeft + "px";

      pillRef.current.style.width =
        videoTabRef.current.getBoundingClientRect().width + "px";
    }
  }, [tab, recordTabRef.current, videoTabRef.current, pillRef.current]);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  useLayoutEffect(() => {
    function setPopupPosition(e) {
      let xpos = DragRef.current.getDraggablePosition().x;
      let ypos = DragRef.current.getDraggablePosition().y;

      // Width and height of popup
      const width = PopupRef.current.getBoundingClientRect().width;
      const height = PopupRef.current.getBoundingClientRect().height;

      // Keep popup positioned relative to the bottom and right of the screen, proportionally
      if (xpos > window.innerWidth + 10) {
        xpos = window.innerWidth + 10;
      }
      if (ypos + height + 40 > window.innerHeight) {
        ypos = window.innerHeight - height - 40;
      }

      // Check if attached to right or bottom, if so, keep it there
      if (contentStateRef.current.popupPosition.fixed) {
        if (xpos < window.innerWidth) {
          xpos = window.innerWidth + 10;
        }
      }

      DragRef.current.updatePosition({ x: xpos, y: ypos });
    }
    window.addEventListener("resize", setPopupPosition);
    setPopupPosition();
    return () => window.removeEventListener("resize", setPopupPosition);
  }, []);

  const handleDragStart = (e, d) => {
    setDragging("ToolbarDragging");
  };

  const handleDrag = (e, d) => {
    // Width and height
    const width = PopupRef.current.getBoundingClientRect().width;
    const height = PopupRef.current.getBoundingClientRect().height;

    if (
      d.x - 40 < width ||
      d.x > window.innerWidth + 10 ||
      d.y < 0 ||
      d.y + height + 40 > window.innerHeight
    ) {
      setShake("ToolbarShake");
    } else {
      setShake("");
    }
  };

  const handleDrop = (e, d) => {
    let anim = "ToolbarElastic";
    if (e === null) {
      anim = "";
    }
    setShake("");
    setDragging("");
    let xpos = d.x;
    let ypos = d.y;

    // Width and height
    const width = PopupRef.current.getBoundingClientRect().width;
    const height = PopupRef.current.getBoundingClientRect().height;

    // Check if popup is off screen
    if (d.x - 40 < width) {
      setElastic(anim);
      xpos = width + 40;
    } else if (d.x + 10 > window.innerWidth) {
      setElastic(anim);
      xpos = window.innerWidth + 10;
    }

    if (d.y < 0) {
      setElastic(anim);
      ypos = 0;
    } else if (d.y + height + 40 > window.innerHeight) {
      setElastic(anim);
      ypos = window.innerHeight - height - 40;
    }
    DragRef.current.updatePosition({ x: xpos, y: ypos });

    setTimeout(() => {
      setElastic("");
    }, 250);

    setContentState((prevContentState) => ({
      ...prevContentState,
      popupPosition: {
        ...prevContentState.popupPosition,
        offsetX: xpos,
        offsetY: ypos,
        left: xpos < window.innerWidth / 2 ? true : false,
        right: xpos < window.innerWidth / 2 ? false : true,
        top: ypos < window.innerHeight / 2 ? true : false,
        bottom: ypos < window.innerHeight / 2 ? false : true,
      },
    }));

    // Is it on the left or right, also top or bottom
    let left = xpos < window.innerWidth / 2 ? true : false;
    let right = xpos < window.innerWidth / 2 ? false : true;
    let top = ypos < window.innerHeight / 2 ? true : false;
    let bottom = ypos < window.innerHeight / 2 ? false : true;
    let offsetX = xpos;
    let offsetY = ypos;
    let fixed = d.x + 9 > window.innerWidth ? true : false;

    if (right) {
      offsetX = window.innerWidth - xpos;
    }
    if (bottom) {
      offsetY = window.innerHeight - ypos;
    }

    setContentState((prevContentState) => ({
      ...prevContentState,
      popupPosition: {
        ...prevContentState.popupPosition,
        offsetX: offsetX,
        offsetY: offsetY,
        left: left,
        right: right,
        top: top,
        bottom: bottom,
        fixed: fixed,
      },
    }));

    chrome.storage.local.set({
      popupPosition: {
        offsetX: offsetX,
        offsetY: offsetY,
        left: left,
        right: right,
        top: top,
        bottom: bottom,
        fixed: fixed,
      },
    });
  };

  useEffect(() => {
    let x = contentState.popupPosition.offsetX;
    let y = contentState.popupPosition.offsetY;

    if (contentState.popupPosition.bottom) {
      y = window.innerHeight - contentState.popupPosition.offsetY;
    }

    if (contentState.popupPosition.right) {
      x = window.innerWidth - contentState.popupPosition.offsetX;
    }

    DragRef.current.updatePosition({ x: x, y: y });

    handleDrop(null, { x: x, y: y });
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      <div className={"ToolbarBounds" + " " + shake}></div>
      <Rnd
        default={{
          x: contentState.popupPosition.offsetX,
          y: contentState.popupPosition.offsetY,
        }}
        className={
          "react-draggable" + " " + elastic + " " + shake + " " + dragging
        }
        enableResizing={false}
        dragHandleClassName="drag-area"
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragStop={handleDrop}
        ref={DragRef}
      >
        <div className="popup-container" ref={PopupRef}>
          <div
            className={open ? "popup-drag-head" : "popup-drag-head drag-area"}
          ></div>
          <div
            className={
              open ? "popup-controls open" : "popup-controls drag-area"
            }
          >
            <SettingsMenu
              shadowRef={props.shadowRef}
              open={open}
              setOpen={setOpen}
            />
            <div
              style={{ marginBottom: "-4px", cursor: "pointer" }}
              onClick={() => {
                window.open(URL, "_blank");
              }}
            >
              <HelpIconPopup />
            </div>
            <div
              className="popup-control popup-close"
              onClick={() => {
                setContentState((prevContentState) => ({
                  ...prevContentState,
                  showExtension: false,
                }));
              }}
            >
              <CloseIconPopup />
            </div>
          </div>
          <div className="popup-cutout">
            <img src={badge} />
          </div>
          <div className="popup-nav"></div>
          <div className="popup-content">
            {onboarding && <Announcement setOnboarding={setOnboarding} />}
            {!onboarding && (
              <Tabs.Root
                className="TabsRoot tl"
                defaultValue="record"
                onValueChange={onValueChange}
              >
                <Tabs.List
                  className="TabsList tl"
                  data-value={tab}
                  aria-label="Manage your account"
                  tabIndex={0}
                >
                  <div className="pill-anim" ref={pillRef}></div>
                  <Tabs.Trigger
                    className="TabsTrigger tl"
                    value="record"
                    ref={recordTabRef}
                    tabIndex={0}
                  >
                    <div className="TabsTriggerIcon">
                      <img
                        src={
                          tab === "record" ? RecordTabActive : RecordTabInactive
                        }
                      />
                    </div>
                    {chrome.i18n.getMessage("recordTab")}
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    className="TabsTrigger tl"
                    value="dashboard"
                    ref={videoTabRef}
                    tabIndex={0}
                  >
                    <div className="TabsTriggerIcon">
                      <img
                        src={
                          tab === "dashboard"
                            ? VideoTabActive
                            : VideoTabInactive
                        }
                      />
                    </div>
                    {chrome.i18n.getMessage("videosTab")}
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content className="TabsContent tl" value="record">
                  <RecordingTab shadowRef={props.shadowRef} />
                </Tabs.Content>
                <Tabs.Content className="TabsContent tl" value="dashboard">
                  <VideosTab />
                </Tabs.Content>
              </Tabs.Root>
            )}
          </div>
          {contentState.settingsOpen && (
            <div
              className="HelpSection"
              onClick={() => {
                window.open(URL, "_blank");
              }}
            >
              <span className="HelpIcon">
                <HelpIconPopup />
              </span>
              {chrome.i18n.getMessage("helpPopup")}
            </div>
          )}
        </div>
      </Rnd>
    </div>
  );
};

export default PopupContainer;
