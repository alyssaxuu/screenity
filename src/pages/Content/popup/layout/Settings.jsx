import React, { useState, useContext, useEffect } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { DropdownIcon } from "../../images/popup/images";

// Components
import Switch from "../components/Switch";
import TimeSetter from "../components/TimeSetter";

// Context
import { contentStateContext } from "../../context/ContentState";

const Settings = () => {
  const [open, setOpen] = useState(false);
  const [contentState, setContentState] = useContext(contentStateContext);
  const [chromeVersion, setChromeVersion] = useState(null);
  // Check if Mac
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  // Set shortcut to Option+Shift+E on Mac and Alt+Shift+E on Windows, using character codes
  const shortcut = isMac ? "⌥⇧E" : "Alt⇧E";

  // Get Chrome version
  const getChromeVersion = () => {
    var raw = navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./);
    return raw ? parseInt(raw[2], 10) : false;
  };

  useEffect(() => {
    setChromeVersion(getChromeVersion());
  }, []);

  useEffect(() => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      settingsOpen: open,
    }));
  }, [open]);

  return (
    <Collapsible.Root
      className="CollapsibleRoot"
      open={open}
      onOpenChange={setOpen}
    >
      <Collapsible.Trigger className="CollapsibleTrigger">
        <div className="CollapsibleLabel">
          ✨ {chrome.i18n.getMessage("showMoreOptionsLabel")}{" "}
          <img src={DropdownIcon} />
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Switch
          label={chrome.i18n.getMessage("hideToolbarLabel")}
          name="hideUI"
          value="hideUI"
        />
        <Switch
          label={chrome.i18n.getMessage("countdownLabel")}
          name="countdown"
          value="countdown"
        />
        <Switch
          label={chrome.i18n.getMessage("alarmLabel")}
          name="alarm"
          value="alarm"
        />
        {contentState.alarm && <TimeSetter />}
        <Switch
          label={chrome.i18n.getMessage("micReminderPopup")}
          name="askMicrophone"
          value="askMicrophone"
        />
        {contentState.recordingType != "region" &&
          contentState.recordingType != "camera" &&
          (chromeVersion === null || chromeVersion >= 109) && (
            <Switch
              label={chrome.i18n.getMessage("stayInPagePopup")}
              name="offscreenRecording"
              value="offscreenRecording"
            />
          )}
        <Switch
          label={
            chrome.i18n.getMessage("zoomToPointPopup") + " (" + shortcut + ")"
          }
          name="zoomEnabled"
          value="zoomEnabled"
          experimental={true}
        />
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export default Settings;
