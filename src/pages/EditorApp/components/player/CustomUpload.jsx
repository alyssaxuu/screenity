import React, { useContext, useEffect, useRef, useState } from "react";
import { ReactSVG } from "react-svg";

import { ContentStateContext } from "../../context/ContentState";
import styles from "../../styles/player/_RightPanel.module.scss";
import { showEditorToast } from "../../utils/editorToast";
import {
  buildCustomUploadFilename,
  CustomUploadError,
  requestCustomUploadPermission,
  resolveCustomUploadSource,
  selectCustomUploadSource,
  uploadCustomVideo,
  validateCustomUploadConfig,
} from "../../utils/customUpload";

const URL =
  "chrome-extension://" + chrome.i18n.getMessage("@@extension_id") + "/assets/";
const STORAGE_KEY = "customUploadConfig";
const EMPTY_CONFIG = { endpoint: "", apiToken: "" };

const t = (key, fallback) => chrome.i18n.getMessage(key) || fallback;

const CustomUpload = () => {
  const [contentState, setContentState] = useContext(ContentStateContext);
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [draft, setDraft] = useState(EMPTY_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [resultUrl, setResultUrl] = useState("");
  const abortRef = useRef(null);
  const mountedRef = useRef(false);
  const settingsErrorRef = useRef(null);
  const uploadErrorRef = useRef(null);

  const source = selectCustomUploadSource(contentState);

  useEffect(() => {
    mountedRef.current = true;
    chrome.storage.local
      .get([STORAGE_KEY])
      .then((stored) => {
        if (!mountedRef.current) return;
        const next = stored?.[STORAGE_KEY] || EMPTY_CONFIG;
        const loaded = {
          endpoint: typeof next.endpoint === "string" ? next.endpoint : "",
          apiToken: typeof next.apiToken === "string" ? next.apiToken : "",
        };
        setConfig(loaded);
        setDraft(loaded);
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (settingsError) settingsErrorRef.current?.focus();
  }, [settingsError]);

  useEffect(() => {
    if (uploadError) uploadErrorRef.current?.focus();
  }, [uploadError]);

  const openSettings = () => {
    if (uploading) return;
    setDraft(config);
    setSettingsError("");
    setShowSettings(true);
  };

  const validateEndpointOnBlur = () => {
    try {
      validateCustomUploadConfig({
        endpoint: draft.endpoint,
        apiToken: draft.apiToken || "validation-placeholder",
      });
      setSettingsError("");
    } catch (error) {
      if (
        error?.code === "endpoint-not-configured" ||
        error?.code === "invalid-endpoint"
      ) {
        setSettingsError(error.message);
      }
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    let normalized;
    try {
      normalized = validateCustomUploadConfig(draft);
    } catch (error) {
      setSettingsError(error.message);
      return;
    }

    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    } catch {
      if (mountedRef.current) {
        setSettingsError("Could not save the upload settings.");
      }
      return;
    }
    if (!mountedRef.current) return;
    setConfig(normalized);
    setDraft(normalized);
    setSettingsError("");
    setShowSettings(false);
    showEditorToast(
      contentState,
      chrome.i18n.getMessage("sandboxToastSaved") || "Changes saved"
    );
  };

  const copyResult = async (url = resultUrl, showFailure = true) => {
    if (!url) return false;
    try {
      await navigator.clipboard.writeText(url);
      showEditorToast(
        contentState,
        chrome.i18n.getMessage("copiedToClipboardToast") ||
          "Link copied to clipboard"
      );
      return true;
    } catch {
      if (showFailure) {
        showEditorToast(
          contentState,
          chrome.i18n.getMessage("failedToCopyToClipboardToast") ||
            "Failed to copy link"
        );
      }
      return false;
    }
  };

  const startUpload = () => {
    if (uploading) return;

    let normalized;
    try {
      normalized = validateCustomUploadConfig(config);
      if (!source) {
        throw new CustomUploadError(
          "source-unavailable",
          "The exported video is not ready to upload."
        );
      }
    } catch (error) {
      if (
        error?.code === "endpoint-not-configured" ||
        error?.code === "missing-api-token" ||
        error?.code === "invalid-api-token" ||
        error?.code === "invalid-endpoint"
      ) {
        setShowSettings(true);
        setDraft(config);
        setSettingsError(error.message);
      } else {
        setUploadError(error.message);
      }
      return;
    }

    // Calling this before any await preserves Chrome's user-gesture context.
    const permissionPromise = requestCustomUploadPermission(
      normalized.endpoint
    );
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setProgress(null);
    setUploadError("");
    setResultUrl("");

    (async () => {
      try {
        await permissionPromise;
        const uploadSource = await resolveCustomUploadSource(
          contentState,
          controller.signal
        );
        if (!uploadSource) {
          throw new CustomUploadError(
            "source-unavailable",
            "The exported video is not ready to upload."
          );
        }
        const filename = buildCustomUploadFilename(
          contentState.title,
          uploadSource.type
        );
        const result = await uploadCustomVideo({
          ...normalized,
          blob: uploadSource,
          filename,
          duration: contentState.duration,
          signal: controller.signal,
          onProgress: ({ percent }) => {
            if (mountedRef.current) setProgress(percent);
          },
        });

        if (!mountedRef.current) return;
        setResultUrl(result.url);
        setProgress(100);
        setContentState((previous) => ({ ...previous, saved: true }));
        chrome.runtime.sendMessage({ type: "recording-saved" }).catch(() => {});
        await copyResult(result.url, false);
      } catch (error) {
        if (mountedRef.current) {
          setUploadError(error?.message || "The upload failed.");
        }
      } finally {
        abortRef.current = null;
        if (mountedRef.current) setUploading(false);
      }
    })();
  };

  const cancelUpload = () => abortRef.current?.abort();
  const progressLabel =
    progress === null
      ? t("customUploadUploadingLabel", "Uploading…")
      : `${t("customUploadUploadingLabel", "Uploading…")} ${progress}%`;

  return (
    <div className={styles.customUpload}>
      <button
        type="button"
        className={styles.button}
        onClick={startUpload}
        disabled={uploading}
        aria-disabled={uploading}
      >
        <div className={styles.buttonLeft} aria-hidden="true">
          <ReactSVG src={URL + "editor/icons/upload.svg"} />
        </div>
        <div className={styles.buttonMiddle}>
          <div className={styles.buttonTitle}>
            {t("customUploadButtonTitle", "Custom Upload")}
          </div>
          <div className={styles.buttonDescription}>
            {uploading
              ? progressLabel
              : t(
                  "customUploadButtonDescription",
                  "Upload the current version to your endpoint"
                )}
          </div>
        </div>
        <div className={styles.buttonRight} aria-hidden="true">
          <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
        </div>
        {uploading && (
          <div
            className={styles.customUploadProgressTrack}
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin="0"
            aria-valuemax="100"
            {...(progress !== null ? { "aria-valuenow": progress } : {})}
          >
            <div
              className={styles.customUploadProgressBar}
              style={{ width: `${progress || 3}%` }}
            />
          </div>
        )}
      </button>

      <div className={styles.customUploadActions}>
        {uploading ? (
          <button type="button" onClick={cancelUpload}>
            {chrome.i18n.getMessage("cancelLabel") || "Cancel"}
          </button>
        ) : (
          <button type="button" onClick={openSettings}>
            {t("customUploadConfigureLabel", "Configure")}
          </button>
        )}
      </div>

      {showSettings && (
        <form className={styles.customUploadSettings} onSubmit={saveSettings}>
          {settingsError && (
            <div
              ref={settingsErrorRef}
              className={styles.customUploadError}
              role="alert"
              tabIndex="-1"
            >
              {settingsError}
            </div>
          )}
          <label htmlFor="custom-upload-endpoint">
            {t("customUploadEndpointLabel", "Endpoint URL")}
          </label>
          <input
            id="custom-upload-endpoint"
            type="url"
            value={draft.endpoint}
            placeholder="https://video.example.com/api/upload"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                endpoint: event.target.value,
              }))
            }
            onBlur={validateEndpointOnBlur}
            required
          />
          <label htmlFor="custom-upload-token">
            {t("customUploadTokenLabel", "API token")}
          </label>
          <input
            id="custom-upload-token"
            type="password"
            value={draft.apiToken}
            autoComplete="off"
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                apiToken: event.target.value,
              }))
            }
            onBlur={() => {
              if (!draft.apiToken.trim()) {
                setSettingsError("Enter an API token before uploading.");
              }
            }}
            required
          />
          <div className={styles.customUploadFormActions}>
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                setSettingsError("");
              }}
            >
              {chrome.i18n.getMessage("cancelLabel") || "Cancel"}
            </button>
            <button type="submit" className={styles.customUploadSaveButton}>
              {t("customUploadSaveSettingsLabel", "Save settings")}
            </button>
          </div>
        </form>
      )}

      {uploadError && (
        <div
          ref={uploadErrorRef}
          className={styles.customUploadError}
          role="alert"
          tabIndex="-1"
        >
          {uploadError}
        </div>
      )}

      {resultUrl && (
        <div className={styles.customUploadResult} aria-live="polite">
          <div className={styles.customUploadResultTitle}>
            {t("customUploadSuccessTitle", "Upload complete")}
          </div>
          <a
            href={resultUrl}
            target="_blank"
            rel="noreferrer"
            title={resultUrl}
          >
            {resultUrl}
          </a>
          <button type="button" onClick={() => copyResult()}>
            {t("customUploadCopyLinkLabel", "Copy link")}
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomUpload;
