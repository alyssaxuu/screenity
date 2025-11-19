import React, { useContext, useEffect } from "react";
import * as S from "@radix-ui/react-switch";

// Styles
import styles from "../../styles/edit/_Switch.module.scss";

// Context
import { ContentStateContext } from "../../context/ContentState"; // Import the ContentState context

const Switch = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);

  return (
    <form>
      <div className={styles.SwitchRow}>
        <label
          className={styles.Label}
          htmlFor="replaceAudio"
          style={{ paddingRight: 15 }}
        >
          {chrome.i18n.getMessage("replaceAudioEditor")}
        </label>
        <S.Root
          className={styles.SwitchRoot}
          checked={contentState.replaceAudio}
          onCheckedChange={(checked) => {
            setContentState((prevContentState) => ({
              ...prevContentState,
              replaceAudio: checked,
            }));
          }}
        >
          <S.Thumb className={styles.SwitchThumb} />
        </S.Root>
      </div>
    </form>
  );
};

export default Switch;
