import { useEffect } from "react";

// Answers ContentState's mount-time "request-recording-error-state" probe with
// any editorRecordingError already in storage before the editor loaded (its own
// storageListener can't see a pre-registration change). Doesn't listen to live
// changes; ContentState's storageListener handles those with richer copy and
// would lose the editorErrorShownRef race.
const EditorPageBridge = () => {
  useEffect(() => {
    const dispatchError = (payload) => {
      try {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "recording-error-from-parent", payload },
          }),
        );
      } catch {}
    };

    const respondWithLatest = () => {
      chrome.storage.local.get(["editorRecordingError"]).then((res) => {
        if (!res?.editorRecordingError) return;
        dispatchError(res.editorRecordingError);
      });
    };

    const requestHandler = (event) => {
      if (event?.data?.type === "request-recording-error-state") {
        respondWithLatest();
      }
    };
    window.addEventListener("message", requestHandler);
    respondWithLatest();

    return () => {
      window.removeEventListener("message", requestHandler);
    };
  }, []);

  return null;
};

export default EditorPageBridge;
