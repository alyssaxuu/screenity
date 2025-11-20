import React, { useContext } from "react";
import styles from "../../styles/edit/_EditorNav.module.scss";
import { ContentStateContext } from "../../context/ContentState";

const URL = "/assets/";

const AudioNav = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);

  const handleCancel = () => {
    setContentState((prev) => ({
      ...prev,
      mode: "player",
      start: 0,
      end: 1,
      pendingAudio: null,
    }));
    contentState.restoreBackup();
  };

  const handleRevert = () => {
    setContentState((prev) => ({
      ...prev,
      blob: contentState.originalBlob,
      start: 0,
      end: 1,
      pendingAudio: null,
    }));
  };

  const saveChanges = async (): Promise<any> => {
    const { pendingAudio, volume } = contentState;
    const source = contentState.blob;

    setContentState((prev) => ({
      ...prev,
      isFfmpegRunning: true,
      processingProgress: 0,
      fromAudio: true,
    }));

    if (pendingAudio) {
      contentState.addAudio(source, pendingAudio, volume);
    } else {
      contentState.handleReencode(true);
    }

    await contentState.waitForUpdatedBlob?.();

    contentState.clearBackup();
  };

  return (
    <div className={styles.editorNav}>
      <div className={styles.navWrap}>
        <div
          className={styles.editorNavLeft}
          onClick={() => chrome.runtime.sendMessage({ type: "open-home" })}
        >
          <img src={URL + "editor/logo.svg"} alt="Logo" />
        </div>

        <div className={styles.editorNavCenter}>
          <div className={styles.editorNavTitle}>
            {chrome.i18n.getMessage("sandboxEditorMainTitle")}{" "}
            <span className={styles.beta}>BETA</span>
          </div>
        </div>

        <div className={styles.editorNavRight}>
          <button
            className="button simpleButton blackButton"
            onClick={handleCancel}
            disabled={contentState.isFfmpegRunning}
          >
            {chrome.i18n.getMessage("sandboxEditorCancelButton")}
          </button>

          <button
            className="button secondaryButton"
            onClick={handleRevert}
            disabled={contentState.isFfmpegRunning}
          >
            {chrome.i18n.getMessage("sandboxEditorRevertButton")}
          </button>

          <button
            className="button primaryButton"
            onClick={saveChanges}
            disabled={contentState.isFfmpegRunning}
          >
            {contentState.isFfmpegRunning ? (
              contentState.processingProgress > 0 ? (
                <>
                  {chrome.i18n.getMessage("sandboxEditorSaveProgressButton") ||
                    "Saving"}{" "}
                  {Math.round(contentState.processingProgress)}%
                </>
              ) : (
                chrome.i18n.getMessage("sandboxEditorSaveProgressButton") ||
                "Saving..."
              )
            ) : (
              chrome.i18n.getMessage("sandboxEditorSaveButton") ||
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioNav;
