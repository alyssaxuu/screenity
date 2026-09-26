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

const MODES = ["simple", "tus"];
const METHODS = ["POST", "PUT"];
const DEFAULT_TUS_CHUNK_SIZE_MB = 50;
const MAX_TUS_CHUNK_SIZE_MB = 2048;
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
    // Multipart needs the browser's boundary; tus PATCH needs its own type.
    throw new CustomUploadError(
      "forbidden-header",
      "Content-Type is set automatically."
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

const encodeBase64Utf8 = (text) => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
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
      `Basic ${encodeBase64Utf8(`${config.username}:${config.password}`)}`,
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
const normalizeMethod = (method) => {
  const normalizedMethod = String(method || "")
    .trim()
    .toUpperCase();
  if (!METHODS.includes(normalizedMethod)) {
    throw new CustomUploadError(
      "invalid-method",
      "Choose POST or PUT as the upload method."
    );
  }
  return normalizedMethod;
};

const normalizeChunkSize = (chunkSizeMb) => {
  const text = String(chunkSizeMb ?? "").trim();
  const size = /^\d+$/.test(text) ? Number(text) : NaN;
  if (!(size >= 1 && size <= MAX_TUS_CHUNK_SIZE_MB)) {
    throw new CustomUploadError(
      "invalid-chunk-size",
      `Enter a chunk size between 1 and ${MAX_TUS_CHUNK_SIZE_MB} MB.`
    );
  }
  return size;
};

export const validateCustomUploadConfig = ({
  endpoint,
  // Configs saved before these options existed were simple POST uploads
  // with a bearer token.
  mode = "simple",
  method = "POST",
  chunkSizeMb = DEFAULT_TUS_CHUNK_SIZE_MB,
  authType = "bearer",
  headers = [],
  ...credentials
} = {}) => {
  const url = parseEndpoint(endpoint);

  if (!MODES.includes(mode)) {
    throw new CustomUploadError(
      "invalid-mode",
      "Choose a supported upload mode."
    );
  }
  const transport =
    mode === "tus"
      ? { chunkSizeMb: normalizeChunkSize(chunkSizeMb) }
      : { method: normalizeMethod(method) };

  if (!Object.hasOwn(AUTH_NORMALIZERS, authType)) {
    throw new CustomUploadError(
      "invalid-auth-type",
      "Choose a supported authentication type."
    );
  }

  const config = {
    endpoint: url.href,
    mode,
    ...transport,
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
    if (
      mode === "tus" &&
      (key === "tus-resumable" || key.startsWith("upload-"))
    ) {
      throw new CustomUploadError(
        "forbidden-header",
        `The tus client sets the "${name}" header itself.`
      );
    }
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
  mode: "simple",
  method: "POST",
  chunkSizeMb: String(DEFAULT_TUS_CHUNK_SIZE_MB),
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
    const value = stored[key];
    if (typeof value === "string") draft[key] = value;
    else if (Number.isFinite(value)) draft[key] = String(value);
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

const RESULT_URL_HEADER = "X-Video-Url";
const TUS_VERSION = "1.0.0";
const TUS_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];
// 409 and 423 mean the server's offset or lock moved; a HEAD resyncs.
const RETRYABLE_STATUSES = new Set([409, 423, 429]);

const cancelledError = () =>
  new CustomUploadError("upload-cancelled", "The upload was cancelled.");

// Resolves with the finished XHR for any HTTP status; rejects only on
// network failure or cancellation.
const sendRequest = ({
  xhrFactory,
  method,
  url,
  headers,
  body = null,
  signal,
  onUploadProgress,
}) =>
  new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abortRequest);
      callback(value);
    };
    const abortRequest = () => {
      try {
        xhr.abort();
      } catch {}
      finish(reject, cancelledError());
    };

    if (signal?.aborted) {
      abortRequest();
      return;
    }
    signal?.addEventListener("abort", abortRequest, { once: true });

    xhr.open(method, url);
    for (const [name, value] of headers) xhr.setRequestHeader(name, value);
    if (onUploadProgress) xhr.upload.onprogress = onUploadProgress;
    xhr.onload = () => finish(resolve, xhr);
    xhr.onerror = () =>
      finish(
        reject,
        new CustomUploadError(
          "connection-failed",
          "Could not connect to the upload endpoint."
        )
      );
    xhr.onabort = () => finish(reject, cancelledError());
    xhr.send(body);
  });

const assertSuccess = (xhr) => {
  if (xhr.status >= 200 && xhr.status < 300) return;
  throw new CustomUploadError(
    "http-error",
    `The upload server returned HTTP ${xhr.status}.`,
    { status: xhr.status }
  );
};

const toProgress = (loaded, total) => ({
  loaded,
  total,
  percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : null,
});

// The tus spec requires 204 for PATCH and some servers (tus-php) can only add
// headers to it, so the URL may come from a header instead of JSON.
const readResultUrl = (xhr) => {
  let rawUrl = xhr.getResponseHeader(RESULT_URL_HEADER);
  if (!rawUrl) {
    if (!String(xhr.responseText || "").trim()) {
      throw new CustomUploadError(
        "missing-url",
        `The upload response did not include a "url" property or an ${RESULT_URL_HEADER} header.`
      );
    }
    let result;
    try {
      result = JSON.parse(xhr.responseText);
    } catch {
      throw new CustomUploadError(
        "invalid-json",
        "The upload server returned invalid JSON."
      );
    }
    if (typeof result?.url !== "string" || !result.url.trim()) {
      throw new CustomUploadError(
        "missing-url",
        `The upload response did not include a "url" property or an ${RESULT_URL_HEADER} header.`
      );
    }
    rawUrl = result.url;
  }

  let resultUrl;
  try {
    resultUrl = new URL(rawUrl.trim());
  } catch {
    throw new CustomUploadError(
      "invalid-response-url",
      "The upload response URL is invalid."
    );
  }
  if (resultUrl.protocol !== "https:" && resultUrl.protocol !== "http:") {
    throw new CustomUploadError(
      "invalid-response-url",
      "The upload response URL is invalid."
    );
  }
  return { url: resultUrl.href };
};

const uploadSimpleVideo = async ({
  config,
  blob,
  filename,
  duration,
  onProgress,
  signal,
  xhrFactory,
}) => {
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("filename", filename);
  if (Number.isFinite(duration) && duration >= 0) {
    formData.append("duration", String(duration));
  }
  formData.append("mime_type", blob.type || "application/octet-stream");

  const xhr = await sendRequest({
    xhrFactory,
    method: config.method,
    url: config.endpoint,
    headers: buildRequestHeaders(config),
    body: formData,
    signal,
    onUploadProgress: (event) =>
      onProgress?.(
        toProgress(event.loaded, event.lengthComputable ? event.total : null)
      ),
  });
  assertSuccess(xhr);
  return readResultUrl(xhr);
};

const isRetryable = (error) =>
  error?.code === "connection-failed" ||
  (error?.code === "http-error" &&
    (error.details.status >= 500 ||
      RETRYABLE_STATUSES.has(error.details.status)));

// `attempt` receives the number of failures so far.
const withRetries = async (attempt, retryDelays, signal) => {
  for (let failures = 0; ; failures += 1) {
    try {
      return await attempt(failures);
    } catch (error) {
      if (failures >= retryDelays.length || !isRetryable(error)) throw error;
      await awaitWithAbort(
        new Promise((resolve) => setTimeout(resolve, retryDelays[failures])),
        signal
      );
    }
  }
};

const encodeTusMetadata = (metadata) =>
  Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key} ${encodeBase64Utf8(String(value))}`)
    .join(",");

const invalidTusResponse = (message) =>
  new CustomUploadError("invalid-tus-response", message);

// Credentials go out with every tus request, so the upload URL must stay on
// the origin the user configured (and that holds the host permission).
const resolveTusUploadUrl = (location, endpoint) => {
  if (!location) {
    throw invalidTusResponse(
      "The tus server did not return an upload URL (Location header)."
    );
  }
  let url;
  try {
    url = new URL(location, endpoint);
  } catch {
    throw invalidTusResponse("The tus server returned an invalid upload URL.");
  }
  const { origin } = new URL(endpoint);
  if (url.origin !== origin) {
    throw new CustomUploadError(
      "tus-origin-mismatch",
      `The tus server returned an upload URL on ${url.origin}, but the endpoint is on ${origin}.`
    );
  }
  return url.href;
};

const readTusOffset = (xhr) => {
  const value = xhr.getResponseHeader("Upload-Offset") ?? "";
  const offset = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(offset)) {
    throw invalidTusResponse(
      "The tus server returned an invalid Upload-Offset."
    );
  }
  return offset;
};

const uploadTusVideo = async ({
  config,
  blob,
  filename,
  duration,
  onProgress,
  signal,
  xhrFactory,
  retryDelays,
}) => {
  const baseHeaders = [
    ["Tus-Resumable", TUS_VERSION],
    ...buildRequestHeaders(config),
  ];
  const send = (method, url, headers = [], options = {}) =>
    sendRequest({
      xhrFactory,
      method,
      url,
      headers: [...baseHeaders, ...headers],
      signal,
      ...options,
    });

  const uploadUrl = await withRetries(
    async () => {
      const created = await send("POST", config.endpoint, [
        ["Upload-Length", String(blob.size)],
        [
          "Upload-Metadata",
          encodeTusMetadata({
            filename,
            filetype: blob.type || "application/octet-stream",
            duration:
              Number.isFinite(duration) && duration >= 0
                ? String(duration)
                : undefined,
          }),
        ],
      ]);
      assertSuccess(created);
      return resolveTusUploadUrl(
        created.getResponseHeader("Location"),
        config.endpoint
      );
    },
    retryDelays,
    signal
  );

  const chunkSize = config.chunkSizeMb * 1024 * 1024;
  let offset = 0;
  try {
    for (;;) {
      const { response, start } = await withRetries(
        async (failures) => {
          // After a failure the server may hold more or fewer bytes than we
          // sent; resume from its offset.
          if (failures > 0) {
            const head = await send("HEAD", uploadUrl);
            assertSuccess(head);
            offset = readTusOffset(head);
            if (offset > blob.size) {
              throw invalidTusResponse(
                "The tus server reported more data than was sent."
              );
            }
            if (offset === blob.size) {
              throw new CustomUploadError(
                "tus-response-lost",
                "The upload finished, but the connection dropped before the server sent the video URL."
              );
            }
          }
          const chunkStart = offset;
          const patched = await send(
            "PATCH",
            uploadUrl,
            [
              ["Upload-Offset", String(chunkStart)],
              ["Content-Type", "application/offset+octet-stream"],
            ],
            {
              body: blob.slice(
                chunkStart,
                Math.min(chunkStart + chunkSize, blob.size)
              ),
              onUploadProgress: (event) =>
                onProgress?.(toProgress(chunkStart + event.loaded, blob.size)),
            }
          );
          if (patched.status === 413) {
            throw new CustomUploadError(
              "http-error",
              "The server rejected a chunk as too large (HTTP 413). Lower the chunk size.",
              { status: 413 }
            );
          }
          assertSuccess(patched);
          return { response: patched, start: chunkStart };
        },
        retryDelays,
        signal
      );

      offset = readTusOffset(response);
      if (offset <= start || offset > blob.size) {
        throw invalidTusResponse(
          "The tus server reported an unexpected Upload-Offset."
        );
      }
      onProgress?.(toProgress(offset, blob.size));
      if (offset === blob.size) return readResultUrl(response);
    }
  } catch (error) {
    if (error?.code === "upload-cancelled") {
      // Termination extension; servers without it let the upload expire.
      sendRequest({
        xhrFactory,
        method: "DELETE",
        url: uploadUrl,
        headers: baseHeaders,
      }).catch(() => {});
    }
    throw error;
  }
};

// Validation errors throw synchronously; transfer errors reject.
export const uploadCustomVideo = ({
  blob,
  filename,
  duration,
  onProgress,
  signal,
  xhrFactory = () => new XMLHttpRequest(),
  retryDelays = TUS_RETRY_DELAYS,
  ...settings
}) => {
  const config = validateCustomUploadConfig(settings);
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new CustomUploadError(
      "source-unavailable",
      "The exported video is not ready to upload."
    );
  }
  const request = {
    config,
    blob,
    filename:
      filename || buildCustomUploadFilename("Screenity Recording", blob.type),
    duration,
    onProgress,
    signal,
    xhrFactory,
  };
  return config.mode === "tus"
    ? uploadTusVideo({ ...request, retryDelays })
    : uploadSimpleVideo(request);
};
