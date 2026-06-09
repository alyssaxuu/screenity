import React, { useContext } from "react";
import styles from "../../styles/edit/_EditorNav.module.scss";
import { ContentStateContext } from "../../context/ContentState";

const URL = "/assets/";

const CropNav = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);

  const handleCancel = () => {
    contentState.cancelEditOp();
    setContentState((prevContentState) => ({
      ...prevContentState,
      mode: "player",
      start: 0,
      end: 1,
      width: contentState.prevWidth,
      height: contentState.prevHeight,
      left: 0,
      top: 0,
      fromCropper: false,
    }));

    contentState.clearBackup();
  };

  const handleRevert = () => {
    const prev = {
      blob: contentState.blob,
      start: contentState.start,
      end: contentState.end,
      width: contentState.width,
      height: contentState.height,
      left: contentState.left,
      top: contentState.top,
      fromCropper: contentState.fromCropper,
    };
    setContentState((prevContentState) => ({
      ...prevContentState,
      blob: contentState.originalBlob,
      start: 0,
      end: 1,
      width: contentState.prevWidth,
      height: contentState.prevHeight,
      left: 0,
      top: 0,
      fromCropper: false,
    }));
    contentState.openToast?.(
      chrome.i18n.getMessage("sandboxToastReverted"),
      () => {
        setContentState((p) => ({ ...p, ...prev }));
      },
    );
  };

  const saveChanges = async () => {
    await contentState.handleCrop(
      contentState.left,
      contentState.top,
      contentState.width,
      contentState.height
    );

    setContentState((prev) => ({
      ...prev,
      fromCropper: true,
      hasTempChanges: false,
    }));

    contentState.clearBackup();
    contentState.openToast?.(
      chrome.i18n.getMessage("sandboxToastSaved"),
      () => contentState.undo?.(),
    );
  };

  return (
    <div className={styles.editorNav}>
      <div className={styles.navWrap}>
        <div
          className={styles.editorNavLeft}
          onClick={() => {
            chrome.runtime.sendMessage({ type: "open-home" });
          }}
        >
          <img src={URL + "editor/logo.svg"} alt="Logo" />
        </div>
        <div className={styles.editorNavCenter}>
          <div className={styles.editorNavTitle}>
            {chrome.i18n.getMessage("sandboxEditorMainTitle") + " "}{" "}
            <span className={styles.beta}>BETA</span>
          </div>
        </div>
        <div className={styles.editorNavRight}>
          <button
            className="button simpleButton blackButton"
            onClick={handleCancel}
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

export default CropNav;
