export class CustomUploadError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CustomUploadError";
    this.code = code;
    this.details = details;
  }
}

const isLoopbackHost = (hostname) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]";

const parseEndpoint = (endpoint) => {
  const rawEndpoint = String(endpoint || "").trim();
  if (!rawEndpoint) {
    throw new CustomUploadError(
      "endpoint-not-configured",
      "Configure an upload endpoint before uploading."
    );
  }

  let url;
  try {
    url = new URL(rawEndpoint);
  } catch {
    throw new CustomUploadError(
      "invalid-endpoint",
      "Enter a valid HTTPS endpoint URL."
    );
  }

  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && isLoopbackHost(url.hostname))
  ) {
    throw new CustomUploadError(
      "invalid-endpoint",
      "Use HTTPS, or HTTP only for a local development endpoint."
    );
  }

  if (url.username || url.password) {
    throw new CustomUploadError(
      "invalid-endpoint",
      "Keep credentials out of the endpoint URL."
    );
  }

  return url;
};

export const validateCustomUploadConfig = ({ endpoint, apiToken } = {}) => {
  const url = parseEndpoint(endpoint);

  const normalizedToken = String(apiToken || "").trim();
  if (!normalizedToken) {
    throw new CustomUploadError(
      "missing-api-token",
      "Enter an API token before uploading."
    );
  }
  if (/[\x00-\x1f\x7f]/.test(normalizedToken)) {
    throw new CustomUploadError(
      "invalid-api-token",
      "The API token contains unsupported characters."
    );
  }

  return {
    endpoint: url.href,
    apiToken: normalizedToken,
  };
};

export const getEndpointPermissionOrigin = (endpoint) => {
  const url = parseEndpoint(endpoint);
  return `${url.protocol}//${url.hostname}/*`;
};

const callPermissionMethod = (permissionsApi, method, request) =>
  new Promise((resolve, reject) => {
    try {
      let callbackCalled = false;
      const callback = (value) => {
        callbackCalled = true;
        resolve(Boolean(value));
      };
      const result = permissionsApi[method](request, callback);
      if (result && typeof result.then === "function") {
        result.then((value) => {
          if (!callbackCalled) resolve(Boolean(value));
        }, reject);
      }
    } catch (error) {
      reject(error);
    }
  });

export const requestCustomUploadPermission = async (
  endpoint,
  permissionsApi = chrome.permissions
) => {
  const origin = getEndpointPermissionOrigin(endpoint);
  const request = { origins: [origin] };
  let granted = false;

  try {
    // Must be the first asynchronous Chrome API call made by the click handler.
    granted = await callPermissionMethod(permissionsApi, "request", request);
    if (granted) return origin;
  } catch {}

  // A false or rejected request is ambiguous when a required host permission
  // is already granted, so settle that case without prompting again.
  try {
    const alreadyGranted = await callPermissionMethod(
      permissionsApi,
      "contains",
      request
    );
    if (alreadyGranted) return origin;
  } catch {}

  throw new CustomUploadError(
    "permission-denied",
    "Allow access to the upload endpoint and try again."
  );
};

export const buildCustomUploadFilename = (title, mimeType) => {
  const extension = String(mimeType || "")
    .toLowerCase()
    .includes("webm")
    ? "webm"
    : "mp4";
  const base =
    String(title || "")
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/[\x00-\x1f\x7f]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Screenity Recording";
  const withoutKnownExtension = base.replace(/\.(?:mp4|webm)$/i, "");
  return `${withoutKnownExtension}.${extension}`;
};

export const selectCustomUploadSource = (contentState = {}) => {
  if (contentState.mp4ready && contentState.blob instanceof Blob) {
    return contentState.blob;
  }
  if (contentState.webm instanceof Blob) return contentState.webm;
  if (contentState.rawBlob instanceof Blob) return contentState.rawBlob;
  return null;
};

const awaitWithAbort = (promise, signal) => {
  if (!signal) return Promise.resolve(promise);
  if (signal.aborted) {
    return Promise.reject(
      new CustomUploadError("upload-cancelled", "The upload was cancelled.")
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      callback(value);
    };
    const abort = () =>
      finish(
        reject,
        new CustomUploadError("upload-cancelled", "The upload was cancelled.")
      );
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error)
    );
  });
};

export const resolveCustomUploadSource = async (contentState = {}, signal) => {
  const readySource = selectCustomUploadSource(contentState);
  if (!readySource) return null;
  if (typeof contentState.getFinalUploadBlob !== "function") {
    return readySource;
  }

  try {
    const finalized = await awaitWithAbort(
      contentState.getFinalUploadBlob(),
      signal
    );
    if (finalized instanceof Blob && finalized.size > 0) return finalized;
  } catch (error) {
    if (error?.code === "upload-cancelled") throw error;
  }
  return readySource;
};

export const uploadCustomVideo = ({
  endpoint,
  apiToken,
  blob,
  filename,
  duration,
  onProgress,
  signal,
  xhrFactory = () => new XMLHttpRequest(),
}) => {
  const config = validateCustomUploadConfig({ endpoint, apiToken });
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new CustomUploadError(
      "source-unavailable",
      "The exported video is not ready to upload."
    );
  }
  const resolvedFilename =
    filename || buildCustomUploadFilename("Screenity Recording", blob?.type);
  const formData = new FormData();
  formData.append("file", blob, resolvedFilename);
  formData.append("filename", resolvedFilename);
  if (Number.isFinite(duration) && duration >= 0) {
    formData.append("duration", String(duration));
  }
  formData.append("mime_type", blob?.type || "application/octet-stream");

  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", abortUpload);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const fail = (code, message, details) =>
      finish(reject, new CustomUploadError(code, message, details));
    const abortUpload = () => {
      try {
        xhr.abort();
      } catch {}
      fail("upload-cancelled", "The upload was cancelled.");
    };

    if (signal?.aborted) {
      abortUpload();
      return;
    }
    signal?.addEventListener("abort", abortUpload, { once: true });

    xhr.open("POST", config.endpoint);
    xhr.setRequestHeader("Authorization", `Bearer ${config.apiToken}`);
    xhr.upload.onprogress = (event) => {
      const total = event.lengthComputable ? event.total : null;
      const percent = total
        ? Math.min(100, Math.round((event.loaded / total) * 100))
        : null;
      onProgress?.({ loaded: event.loaded, total, percent });
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        fail("http-error", `The upload server returned HTTP ${xhr.status}.`, {
          status: xhr.status,
        });
        return;
      }

      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        fail("invalid-json", "The upload server returned invalid JSON.");
        return;
      }

      if (typeof result?.url !== "string" || !result.url.trim()) {
        fail(
          "missing-url",
          'The upload response did not include a "url" property.'
        );
        return;
      }

      let resultUrl;
      try {
        resultUrl = new URL(result.url.trim());
      } catch {
        fail("invalid-response-url", "The upload response URL is invalid.");
        return;
      }
      if (resultUrl.protocol !== "https:" && resultUrl.protocol !== "http:") {
        fail("invalid-response-url", "The upload response URL is invalid.");
        return;
      }

      finish(resolve, { url: resultUrl.href });
    };
    xhr.onerror = () =>
      fail("connection-failed", "Could not connect to the upload endpoint.");
    xhr.onabort = () => fail("upload-cancelled", "The upload was cancelled.");
    xhr.send(formData);
  });
};
