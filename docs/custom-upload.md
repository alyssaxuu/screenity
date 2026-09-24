# Custom upload

Custom Upload sends the current recording from the editor to an HTTP endpoint
you control. The endpoint stores the video and returns a URL. Screenity shows
that URL and copies it to the clipboard.

- [Setting it up](#setting-it-up)
- [The request](#the-request)
- [Authentication](#authentication)
- [The response](#the-response)
- [Errors](#errors)
- [Security notes](#security-notes)
- [Example endpoints](#example-endpoints)

## Setting it up

1. Open a recording in the editor.
2. In the right panel's **Save** section, click **Configure** below
   **Custom Upload** (under Save to Google Drive).
3. Fill in the settings and click **Save settings**.
4. Click **Custom Upload**. The first time, Chrome may ask to let Screenity
   access the endpoint's host.

| Setting            | Required | Notes                                                                                                                       |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Endpoint URL       | yes      | Must be `https://`. `http://` works only for `localhost`, `*.localhost`, `127.0.0.1` and `[::1]`. The query string is kept. |
| Method             | yes      | `POST` (default) or `PUT`. The body is multipart either way.                                                                |
| Authentication     | yes      | `Bearer token` (default), `Basic auth`, `Custom header` or `None`. See [Authentication](#authentication).                   |
| Additional headers | no       | One header per line, `Name: value`. Blank lines are ignored.                                                                |

Settings live in `chrome.storage.local` under the key `customUploadConfig`.
Only the fields for the selected authentication type are saved. Switching from
Basic auth to Bearer token and saving removes the stored username and password.

## The request

```
POST /api/upload HTTP/1.1
Host: video.example.com
Authorization: Bearer <token>
X-Folder-Id: 42
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
Origin: chrome-extension://<extension-id>

------WebKitFormBoundary...
Content-Disposition: form-data; name="file"; filename="Product demo.mp4"
Content-Type: video/mp4

<binary video>
------WebKitFormBoundary...
Content-Disposition: form-data; name="filename"

Product demo.mp4
------WebKitFormBoundary...
Content-Disposition: form-data; name="duration"

12.5
------WebKitFormBoundary...
Content-Disposition: form-data; name="mime_type"

video/mp4
------WebKitFormBoundary...--
```

### Multipart fields

| Field       | Type   | Always sent | Description                                                                                                                                                                         |
| ----------- | ------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`      | file   | yes         | The video. Its part filename matches the `filename` field.                                                                                                                          |
| `filename`  | string | yes         | The recording title plus `.mp4` or `.webm`. `\ / : * ? " < > \|` and control characters become spaces, and runs of spaces collapse to one. Defaults to `Screenity Recording.<ext>`. |
| `duration`  | string | no          | Length in seconds, as a decimal (`12.5`). Omitted when the duration is unknown.                                                                                                     |
| `mime_type` | string | yes         | The video's MIME type, e.g. `video/mp4` or `video/webm;codecs=vp9,opus`. Falls back to `application/octet-stream`.                                                                  |

Fields arrive in the order above, so a streaming parser sees the file first.

### Which video is sent

Screenity sends the current version of the recording, edits included:

1. When the MP4 export is ready, it's converted to a standard (non-fragmented)
   MP4, the same file a local MP4 download gives you. If that conversion fails,
   the fragmented MP4 is sent instead.
2. Otherwise the WebM export.
3. Otherwise the raw recording (WebM).

Check `mime_type` or the filename extension instead of assuming MP4.

### Headers

Headers are sent in this order: the authentication header first, then the
additional headers in the order you entered them. Header names are compared
case-insensitively, and the same name can't be set twice. That includes an
additional `Authorization` header when an auth type already sets one.

These headers are rejected when you save:

- `Content-Type`. The browser sets it so the multipart boundary is included.
- Headers the browser won't let a page set (it would drop them silently):
  `Accept-Charset`, `Accept-Encoding`, `Access-Control-Request-*`,
  `Connection`, `Content-Length`, `Cookie`, `Cookie2`, `Date`, `DNT`, `Expect`,
  `Host`, `Keep-Alive`, `Origin`, `Referer`, `Set-Cookie`, `TE`, `Trailer`,
  `Transfer-Encoding`, `Upgrade`, `Via`, and anything starting with `Proxy-` or
  `Sec-`.
- Names with characters not allowed in an HTTP header name, and values with
  control characters (CR, LF, NUL...) or characters outside Latin-1.

## Authentication

| Type            | Fields                    | Header sent                                          |
| --------------- | ------------------------- | ---------------------------------------------------- |
| `Bearer token`  | API token                 | `Authorization: Bearer <token>`                      |
| `Basic auth`    | Username, password        | `Authorization: Basic base64(<username>:<password>)` |
| `Custom header` | Header name, header value | `<name>: <value>`                                    |
| `None`          | -                         | nothing                                              |

- **Basic auth** encodes the credentials as UTF-8, as RFC 7617 recommends. The
  username can't contain `:`. The password can be empty, for services that take
  an API key as the username.
- **Custom header** covers API-key headers (`X-API-Key: ...`) and non-Bearer
  `Authorization` schemes (header name `Authorization`, value `Token abc123`).
- Tokens, usernames and header names/values are trimmed. Passwords are sent
  exactly as typed.
- Put secrets in an auth field, not in **Additional headers**. Auth fields are
  masked, but additional headers are shown in plain text.

## The response

Upload succeeded: return any `2xx` status with a JSON body that has a `url`
string:

```json
{ "url": "https://video.example.com/v/abc123" }
```

- `url` must be an absolute `http://` or `https://` URL. It's shown as a link
  and copied to the clipboard.
- Any other properties are ignored. The `Content-Type` of the response isn't
  checked, but `application/json` is the right choice.
- A `204 No Content` or an empty body counts as an error, since there's no URL.

Upload failed: return a non-`2xx` status. The user sees
`The upload server returned HTTP <status>.` The response body is never shown,
so a body that echoes the request can't leak credentials into the UI.

## Errors

| When                              | Message                                               |
| --------------------------------- | ----------------------------------------------------- |
| Chrome host access denied         | Allow access to the upload endpoint and try again.    |
| Network failure, DNS or TLS error | Could not connect to the upload endpoint.             |
| Non-2xx status                    | The upload server returned HTTP `<status>`.           |
| Body isn't JSON                   | The upload server returned invalid JSON.              |
| No `url` string in the JSON       | The upload response did not include a "url" property. |
| `url` isn't a valid http(s) URL   | The upload response URL is invalid.                   |
| User clicked Cancel               | The upload was cancelled.                             |

Invalid settings open the settings form with the specific problem, such as a
missing token or a header on the forbidden list.

## Security notes

- **HTTPS only.** Credentials and video never travel over plain HTTP, except to
  a loopback address for local development. Credentials embedded in the URL
  (`https://user:pass@host`) are rejected. Use Basic auth for those.
- **Host permission.** Before each upload Screenity requests Chrome access to
  `<scheme>://<hostname>/*` for the endpoint. The permission covers all ports
  and paths on that host. If the extension already has access, there's no
  prompt.
- **Stored in plain text.** Credentials are kept unencrypted in the Chrome
  profile (`chrome.storage.local`). Use a dedicated token scoped to uploads that
  you can revoke, not a personal password.
- **Origin.** Requests come from the extension page, so `Origin` is
  `chrome-extension://<extension-id>`. The extension's host permission means
  CORS response headers aren't needed. Still, a server or WAF that rejects
  unknown origins has to allow this one.

## Example endpoints

### Test with curl

This request is the same as the one the extension sends:

```sh
curl -X POST https://video.example.com/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@demo.mp4;type=video/mp4" \
  -F "filename=demo.mp4" \
  -F "duration=12.5" \
  -F "mime_type=video/mp4"
```

### Node (Express + multer)

```js
import express from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";

const app = express();
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) =>
      cb(
        null,
        `${randomUUID()}${file.mimetype.includes("webm") ? ".webm" : ".mp4"}`
      ),
  }),
  limits: { fileSize: 2 * 1024 ** 3 },
});

const requireToken = (req, res, next) =>
  req.get("authorization") === `Bearer ${process.env.UPLOAD_TOKEN}`
    ? next()
    : res.sendStatus(401);

// multer parses multipart for PUT too.
app.put("/api/upload", requireToken, upload.single("file"), respond);
app.post("/api/upload", requireToken, upload.single("file"), respond);

function respond(req, res) {
  if (!req.file) return res.sendStatus(422);
  res
    .status(201)
    .json({ url: `https://video.example.com/v/${req.file.filename}` });
}

app.use("/v", express.static("uploads"));
app.listen(8787);
```

### Laravel

```php
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::post('/api/upload', function (Request $request) {
    $request->validate([
        'file' => ['required', 'file', 'mimetypes:video/mp4,video/webm'],
        'duration' => ['nullable', 'numeric', 'min:0'],
    ]);

    $path = $request->file('file')->store('recordings', 'public');

    return response()->json(['url' => Storage::disk('public')->url($path)], 201);
})->middleware('auth:sanctum');
```

A Sanctum personal access token works as the Bearer token.

### Server gotchas

- **PHP and PUT.** PHP only fills `$_FILES`/`$_POST` for `POST`, so
  `$request->file('file')` is `null` for a multipart `PUT`. Use `POST`, or on
  PHP 8.4+ call `request_parse_body()`.
- **Body size limits.** Recordings get large. Raise them wherever they apply:
  nginx `client_max_body_size`, PHP `upload_max_filesize` and `post_max_size`,
  multer `limits.fileSize`, and any proxy or CDN limit in front. A limit hit
  usually shows up as `HTTP 413`, or as "Could not connect" when the proxy
  drops the connection.
- **Timeouts.** The extension has no timeout of its own, but proxies do. Allow
  for slow uplinks on multi-GB files.
