import React from "react";
import RecorderShell from "../Components/RecorderShell";

const RecorderUI = ({
  started,
  initProject = false,
  isTab,
  finalizeFailure = null,
  retryingFinalize = false,
  onRetryFinalize = null,
  onExportDiagnostics = null,
  onExportDebugBundle = null,
}) => {
  const title = initProject
    ? chrome.i18n.getMessage("recorderSetupTitle")
    : !started
    ? chrome.i18n.getMessage("recorderSelectTitle")
    : chrome.i18n.getMessage("recorderSelectProgressTitle");
  const subtitle = initProject
    ? chrome.i18n.getMessage("recorderSetupDescription")
    : chrome.i18n.getMessage("recorderSelectDescription");

  return (
    <RecorderShell
      title={title}
      subtitle={subtitle}
      started={started}
      isTab={isTab}
      warningAlwaysInteractive
    >
      {finalizeFailure && (
        <>
          <div className="button-strong" onClick={onRetryFinalize}>
            {retryingFinalize ? "Retrying..." : "Retry finalize"}
          </div>
          <div className="button-stop" onClick={onExportDiagnostics}>
            Export diagnostics
          </div>
        </>
      )}
    </RecorderShell>
  );
};

export default RecorderUI;
