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

export const validateCustomUploadEndpoint = (endpoint) =>
  parseEndpoint(endpoint).href;

const METHODS = ["POST", "PUT"];
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
// Control characters allow header injection; setRequestHeader throws on
// values outside Latin-1.
const UNSAFE_HEADER_VALUE = /[\x00-\x1f\x7f]|[^\x00-\xff]/;
// Fetch forbidden request headers: XHR drops them silently.
const FORBIDDEN_HEADER_NAMES = new Set([
  "accept-charset",
  "accept-encoding",
  "access-control-request-headers",
  "access-control-request-method",
  "connection",
  "content-length",
  "cookie",
  "cookie2",
  "date",
  "dnt",
  "expect",
  "host",
  "keep-alive",
  "origin",
  "referer",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "via",
]);

const assertHeader = (name, value) => {
  if (!HEADER_NAME.test(name)) {
    throw new CustomUploadError(
      "invalid-header",
      `"${name}" is not a valid header name.`
    );
  }
  const lowerName = name.toLowerCase();
  if (lowerName === "content-type") {
    // Overriding it drops the multipart boundary the browser generates.
    throw new CustomUploadError(
      "forbidden-header",
      "Content-Type is set automatically for multipart uploads."
    );
  }
  if (
    FORBIDDEN_HEADER_NAMES.has(lowerName) ||
    lowerName.startsWith("proxy-") ||
    lowerName.startsWith("sec-")
  ) {
    throw new CustomUploadError(
      "forbidden-header",
      `The browser does not allow setting the "${name}" header.`
    );
  }
  if (UNSAFE_HEADER_VALUE.test(value)) {
    throw new CustomUploadError(
      "invalid-header",
      `The "${name}" header value contains unsupported characters.`
    );
  }
};

const normalizeApiToken = (apiToken) => {
  const normalizedToken = String(apiToken || "").trim();
  if (!normalizedToken) {
    throw new CustomUploadError(
      "missing-api-token",
      "Enter an API token before uploading."
    );
  }
  if (UNSAFE_HEADER_VALUE.test(normalizedToken)) {
    throw new CustomUploadError(
      "invalid-api-token",
      "The API token contains unsupported characters."
    );
  }
  return { apiToken: normalizedToken };
};

const normalizeBasicCredentials = (username, password) => {
  const normalizedUsername = String(username || "").trim();
  const normalizedPassword = String(password ?? "");
  if (!normalizedUsername) {
    throw new CustomUploadError(
      "missing-username",
      "Enter a username for Basic auth."
    );
  }
  // RFC 7617: the first colon separates the user-id from the password.
  if (normalizedUsername.includes(":")) {
    throw new CustomUploadError(
      "invalid-username",
      "The Basic auth username cannot contain a colon."
    );
  }
  if (/[\x00-\x1f\x7f]/.test(normalizedUsername)) {
    throw new CustomUploadError(
      "invalid-username",
      "The Basic auth username contains unsupported characters."
    );
  }
  if (/[\x00-\x1f\x7f]/.test(normalizedPassword)) {
    throw new CustomUploadError(
      "invalid-password",
      "The Basic auth password contains unsupported characters."
    );
  }
  return { username: normalizedUsername, password: normalizedPassword };
};

const normalizeAuthHeader = (headerName, headerValue) => {
  const name = String(headerName || "").trim();
  const value = String(headerValue || "").trim();
  if (!name) {
    throw new CustomUploadError(
      "missing-header-name",
      "Enter the authentication header name."
    );
  }
  if (!value) {
    throw new CustomUploadError(
      "missing-header-value",
      "Enter the authentication header value."
    );
  }
  assertHeader(name, value);
  return { headerName: name, headerValue: value };
};

const AUTH_NORMALIZERS = {
  bearer: ({ apiToken }) => normalizeApiToken(apiToken),
  basic: ({ username, password }) =>
    normalizeBasicCredentials(username, password),
  header: ({ headerName, headerValue }) =>
    normalizeAuthHeader(headerName, headerValue),
  none: () => ({}),
};

const encodeBasicCredentials = (username, password) => {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

// Expects a config returned by validateCustomUploadConfig.
const buildRequestHeaders = (config) => {
  const headers = [];
  if (config.authType === "bearer") {
    headers.push(["Authorization", `Bearer ${config.apiToken}`]);
  } else if (config.authType === "basic") {
    headers.push([
      "Authorization",
      `Basic ${encodeBasicCredentials(config.username, config.password)}`,
    ]);
  } else if (config.authType === "header") {
    headers.push([config.headerName, config.headerValue]);
  }
  for (const { name, value } of config.headers) headers.push([name, value]);
  return headers;
};

export const parseCustomUploadHeaders = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line)
    .map(({ line, number }) => {
      const separator = line.indexOf(":");
      if (separator <= 0) {
        throw new CustomUploadError(
          "invalid-header",
          `Header line ${number} must use the "Name: value" format.`
        );
      }
      return {
        name: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    });

export const formatCustomUploadHeaders = (headers) =>
  (Array.isArray(headers) ? headers : [])
    .filter(
      (header) =>
        typeof header?.name === "string" && typeof header?.value === "string"
    )
    .map(({ name, value }) => `${name}: ${value}`)
    .join("\n");

// Returns only the fields of the selected auth type, so switching type and
// saving drops the previous type's secrets from storage.
export const validateCustomUploadConfig = ({
  endpoint,
  method = "POST",
  // Configs saved before authType existed always used a bearer token.
  authType = "bearer",
  headers = [],
  ...credentials
} = {}) => {
  const url = parseEndpoint(endpoint);

  const normalizedMethod = String(method || "")
    .trim()
    .toUpperCase();
  if (!METHODS.includes(normalizedMethod)) {
    throw new CustomUploadError(
      "invalid-method",
      "Choose POST or PUT as the upload method."
    );
  }

  if (!Object.hasOwn(AUTH_NORMALIZERS, authType)) {
    throw new CustomUploadError(
      "invalid-auth-type",
      "Choose a supported authentication type."
    );
  }

  const config = {
    endpoint: url.href,
    method: normalizedMethod,
    authType,
    ...AUTH_NORMALIZERS[authType](credentials),
    headers: headers.map((header) => {
      const name = String(header?.name ?? "").trim();
      const value = String(header?.value ?? "").trim();
      assertHeader(name, value);
      return { name, value };
    }),
  };

  const seen = new Set();
  for (const [name] of buildRequestHeaders(config)) {
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new CustomUploadError(
        "duplicate-header",
        `The "${name}" header is set more than once.`
      );
    }
    seen.add(key);
  }

  return config;
};

export const EMPTY_CUSTOM_UPLOAD_DRAFT = Object.freeze({
  endpoint: "",
  method: "POST",
  authType: "bearer",
  apiToken: "",
  username: "",
  password: "",
  headerName: "",
  headerValue: "",
  headersText: "",
});

// Accepts anything read from storage, including configs saved before auth
// options existed.
export const toCustomUploadDraft = (stored) => {
  const draft = { ...EMPTY_CUSTOM_UPLOAD_DRAFT };
  if (!stored || typeof stored !== "object") return draft;
  for (const key of Object.keys(draft)) {
    if (typeof stored[key] === "string") draft[key] = stored[key];
  }
  draft.headersText = formatCustomUploadHeaders(stored.headers);
  return draft;
};

export const validateCustomUploadDraft = ({ headersText, ...draft } = {}) =>
  validateCustomUploadConfig({
    ...draft,
    headers: parseCustomUploadHeaders(headersText),
  });

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
  blob,
  filename,
  duration,
  onProgress,
  signal,
  xhrFactory = () => new XMLHttpRequest(),
  ...settings
}) => {
  const config = validateCustomUploadConfig(settings);
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

    xhr.open(config.method, config.endpoint);
    for (const [name, value] of buildRequestHeaders(config)) {
      xhr.setRequestHeader(name, value);
    }
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
