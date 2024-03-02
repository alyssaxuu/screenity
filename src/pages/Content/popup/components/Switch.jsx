import React, { useContext, useEffect, useState, useRef } from "react";
import * as S from "@radix-ui/react-switch";

// Components
import { DropdownIcon } from "../../images/popup/images";

// Context
import { contentStateContext } from "../../context/ContentState";

const Switch = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);
  const switchRef = useRef(null);
  const [hideToolbarLabel, setHideToolbarLabel] = useState(
    chrome.i18n.getMessage("hideToolbarLabel")
  );
  const [hideToolbarState, setHideToolbarState] = useState(1);

  useEffect(() => {
    // Check click outside
    const handleClickOutside = (event) => {
      if (props.name != "hideUI") return;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !dropdownInRef.current.contains(event.target)
      ) {
        if (dropdownRef.current.querySelector(":hover")) return;
        if (dropdownInRef.current.querySelector(":hover")) return;
        // Check if any children of dropdownref are clicked also
        let children = dropdownRef.current.querySelectorAll("*");
        for (let i = 0; i < children.length; i++) {
          if (children[i].contains(event.target)) return;
        }

        dropdownRef.current.classList.remove("labelDropdownActive");
      }
    };

    // Bind the event listener
    document.addEventListener("click", handleClickOutside);

    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (props.name === "hideUI") {
      if (contentState.hideUIAlerts) {
        setHideToolbarLabel(chrome.i18n.getMessage("hideUIAlerts"));
        setHideToolbarState(2);
      } else if (contentState.hideToolbar) {
        setHideToolbarLabel(chrome.i18n.getMessage("hideToolbarLabel"));
        setHideToolbarState(1);
      } else if (contentState.toolbarHover) {
        setHideToolbarLabel(chrome.i18n.getMessage("toolbarHoverOnly"));
        setHideToolbarState(3);
      }
    }
  }, [contentState.hideToolbar]);

  const dropdownRef = useRef(null);
  const dropdownInRef = useRef(null);
  return (
    <form>
      <div className="SwitchRow">
        <label
          className="Label"
          htmlFor={props.name}
          style={{ paddingRight: 15 }}
          onClick={(e) => {
            if (props.name === "hideUI") {
              e.preventDefault();
              e.stopPropagation();
              if (e.target.classList.contains("labelDropdownContentItem"))
                return;
              dropdownRef.current.classList.toggle("labelDropdownActive");
            }
          }}
        >
          {props.name !== "hideUI" && props.label}
          {props.name === "hideUI" && (
            <div className="labelDropdownWrap" ref={dropdownRef}>
              <div className="labelDropdown" ref={dropdownInRef}>
                {hideToolbarLabel}
                <img src={DropdownIcon} />
              </div>
              <div className="labelDropdownContent">
                <div
                  className="labelDropdownContentItem"
                  onClick={() => {
                    setContentState((prevContentState) => ({
                      ...prevContentState,
                      hideToolbar: true,
                      hideUIAlerts: false,
                      toolbarHover: false,
                    }));
                    chrome.storage.local.set({
                      hideToolbar: true,
                      hideUIAlerts: false,
                      toolbarHover: false,
                    });
                    setHideToolbarLabel(
                      chrome.i18n.getMessage("hideToolbarLabel")
                    );
                    dropdownRef.current.classList.remove("labelDropdownActive");
                    setHideToolbarState(1);
                  }}
                >
                  {chrome.i18n.getMessage("hideToolbarLabel")}
                </div>
                <div
                  className="labelDropdownContentItem"
                  onClick={() => {
                    setContentState((prevContentState) => ({
                      ...prevContentState,
                      hideToolbar: false,
                      hideUIAlerts: true,
                      toolbarHover: false,
                    }));
                    chrome.storage.local.set({
                      hideToolbar: false,
                      hideUIAlerts: true,
                      toolbarHover: false,
                    });
                    setHideToolbarLabel(chrome.i18n.getMessage("hideUIAlerts"));
                    dropdownRef.current.classList.remove("labelDropdownActive");
                    setHideToolbarState(2);
                  }}
                >
                  {chrome.i18n.getMessage("hideUIAlerts")}
                </div>
                <div
                  className="labelDropdownContentItem"
                  onClick={() => {
                    setContentState((prevContentState) => ({
                      ...prevContentState,
                      hideToolbar: false,
                      hideUIAlerts: false,
                      toolbarHover: true,
                    }));
                    chrome.storage.local.set({
                      hideToolbar: false,
                      hideUIAlerts: false,
                      toolbarHover: true,
                    });
                    setHideToolbarLabel(
                      chrome.i18n.getMessage("toolbarHoverOnly")
                    );
                    dropdownRef.current.classList.remove("labelDropdownActive");
                    setHideToolbarState(3);
                  }}
                >
                  {chrome.i18n.getMessage("toolbarHoverOnly")}
                </div>
              </div>
            </div>
          )}
          {props.experimental && (
            <span className="ExperimentalLabel">Experimental</span>
          )}
        </label>
        {props.value ? (
          <S.Root
            className="SwitchRoot"
            id={props.value}
            ref={switchRef}
            checked={contentState[props.value]}
            onCheckedChange={(checked) => {
              setContentState((prevContentState) => ({
                ...prevContentState,
                [props.value]: checked,
              }));
              chrome.storage.local.set({ [props.value]: checked });

              if (props.value === "customRegion") {
                if (checked) {
                  chrome.storage.local.set({
                    region: true,
                  });
                }
              }

              if (props.name === "hideUI") {
                if (hideToolbarState === 1) {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    hideToolbar: true,
                    hideUIAlerts: false,
                    toolbarHover: false,
                  }));
                  chrome.storage.local.set({
                    hideToolbar: true,
                    hideUIAlerts: false,
                    toolbarHover: false,
                  });
                } else if (hideToolbarState === 2) {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    hideToolbar: false,
                    hideUIAlerts: true,
                    toolbarHover: false,
                  }));
                  chrome.storage.local.set({
                    hideToolbar: false,
                    hideUIAlerts: true,
                    toolbarHover: false,
                  });
                } else if (hideToolbarState === 3) {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    hideToolbar: false,
                    hideUIAlerts: false,
                    toolbarHover: true,
                  }));
                  chrome.storage.local.set({
                    hideToolbar: false,
                    hideUIAlerts: false,
                    toolbarHover: true,
                  });
                }
              } else if (props.name === "pushToTalk") {
                if (!checked) {
                  setContentState((prevContentState) => ({
                    ...prevContentState,
                    micActive: true,
                  }));
                }
              }
            }}
          >
            <S.Thumb className="SwitchThumb" />
          </S.Root>
        ) : (
          <S.Root className="SwitchRoot" id={props.name}>
            <S.Thumb className="SwitchThumb" />
          </S.Root>
        )}
      </div>
    </form>
  );
};

export default Switch;
