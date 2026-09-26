# Custom upload

Custom Upload sends the current recording from the editor to an HTTP endpoint
you control. The endpoint stores the video and returns a URL. Screenity shows
that URL and copies it to the clipboard.

There are two upload modes:

- **Single request** (default): one multipart `POST` or `PUT` with the whole
  video. Easy to build on any backend.
- **Resumable (tus)**: the [tus](https://tus.io) protocol. The video goes up in
  chunks, and a dropped connection resumes where it stopped instead of starting
  over. Use it when recordings can exceed a request size limit on the path (for
  example Cloudflare's 100 MB on Free and Pro plans) or when networks are
  unreliable.

- [Setting it up](#setting-it-up)
- [Single-request mode](#single-request-mode)
- [Resumable mode (tus)](#resumable-mode-tus)
- [Headers](#headers)
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

| Setting            | Mode   | Notes                                                                                                                                                                                                           |
| ------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload mode        | both   | `Single request` (default) or `Resumable (tus)`.                                                                                                                                                                |
| Endpoint URL       | both   | Must be `https://`. `http://` works only for `localhost`, `*.localhost`, `127.0.0.1` and `[::1]`. The query string is kept. In tus mode, this is the tus creation URL (e.g. `https://video.example.com/files`). |
| Method             | single | `POST` (default) or `PUT`. The body is multipart either way.                                                                                                                                                    |
| Chunk size (MB)    | tus    | Whole megabytes, 1 to 2048. Default 50. See [Chunk size](#chunk-size).                                                                                                                                          |
| Authentication     | both   | `Bearer token` (default), `Basic auth`, `Custom header` or `None`. See [Authentication](#authentication).                                                                                                       |
| Additional headers | both   | Optional. One header per line, `Name: value`. Blank lines are ignored.                                                                                                                                          |

Settings live in `chrome.storage.local` under the key `customUploadConfig`.
Only the fields that apply are saved: switching from Basic auth to Bearer token
and saving removes the stored username and password. Settings saved before the
mode and auth options existed load as Single request, POST and Bearer token.

## Single-request mode

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

## Resumable mode (tus)

Screenity speaks [tus 1.0.0](https://tus.io/protocols/resumable-upload): the
core protocol plus the `creation` extension. On cancel it also sends a
`termination` request, which servers without that extension can ignore. No
other extension (checksum, concatenation, creation-with-upload...) is needed.
Any compliant server works: [tusd](https://github.com/tus/tusd),
[`@tus/server`](https://github.com/tus/tus-node-server),
[tus-php](https://github.com/ankitpokhrel/tus-php) and others.

### The requests

```
POST /files HTTP/1.1
Host: video.example.com
Tus-Resumable: 1.0.0
Authorization: Bearer <token>
Upload-Length: 125829120
Upload-Metadata: filename UHJvZHVjdCBkZW1vLm1wNA==,filetype dmlkZW8vbXA0,duration MTIuNQ==

HTTP/1.1 201 Created
Location: https://video.example.com/files/abc123
```

```
PATCH /files/abc123 HTTP/1.1
Host: video.example.com
Tus-Resumable: 1.0.0
Authorization: Bearer <token>
Upload-Offset: 0
Content-Type: application/offset+octet-stream

<first 52428800 bytes>

HTTP/1.1 204 No Content
Upload-Offset: 52428800
```

The client repeats `PATCH` with the next offset until `Upload-Offset` equals
`Upload-Length`. The response to that last `PATCH` carries the video URL (see
[The response](#the-response)):

```
HTTP/1.1 204 No Content
Upload-Offset: 125829120
X-Video-Url: https://video.example.com/v/abc123
```

The `Location` can be absolute or relative to the endpoint. It must stay on the
endpoint's origin (same scheme, host and port), because credentials go out with
every request. Otherwise the upload stops before any video is sent.

### Metadata

`Upload-Metadata` holds comma-separated `key base64(value)` pairs, UTF-8
encoded. Keys follow tus conventions, so tus servers pick them up without extra
configuration:

| Key        | Always sent | Description                                                       |
| ---------- | ----------- | ----------------------------------------------------------------- |
| `filename` | yes         | Same value as the single-request `filename` field.                |
| `filetype` | yes         | The video's MIME type (single-request mode calls it `mime_type`). |
| `duration` | no          | Length in seconds, as a decimal. Omitted when unknown.            |

The same video is sent as in single-request mode. See
[Which video is sent](#which-video-is-sent).

### Chunk size

Every `PATCH` body is one chunk. Keep the chunk size below the smallest request
size limit between Screenity and your tus server:

- Cloudflare proxy: 100 MB (Free and Pro), 200 MB (Business).
- nginx `client_max_body_size` (1 MB by default).
- Any load balancer, API gateway or WAF in front.

A server that rejects a chunk with `413` produces the error "The server
rejected a chunk as too large (HTTP 413). Lower the chunk size." Larger chunks
mean fewer requests, while smaller chunks resend less data after a dropped
connection. The default of 50 MB fits under Cloudflare's limit.

### Retries and resume

- A request that fails with a network error, a `5xx`, `409`, `423` or `429` is
  retried up to 5 times, after 0, 1, 3, 5 and 10 seconds. Other `4xx` statuses
  fail at once.
- Before retrying a chunk, the client sends `HEAD` to the upload URL and
  resumes from the server's `Upload-Offset`. Bytes the server already stored
  aren't sent again.
- The retry budget resets after every accepted chunk, so a long upload can
  survive many short outages.
- Resume works while the editor stays open. Uploading again after closing the
  editor, or after the retries run out, starts a new upload from zero. The
  abandoned one is left to the server's expiration.

### Cancel

Cancel aborts the request in progress and sends `DELETE` to the upload URL
(the `termination` extension) so the server can drop the partial file. If the
server doesn't support termination, the upload just expires.

## Headers

Headers are sent in this order: the authentication header first, then the
additional headers in the order you entered them. In tus mode, both go out on
every request (`POST`, `PATCH`, `HEAD`, `DELETE`), after `Tus-Resumable`.
Header names are compared case-insensitively, and the same name can't be set
twice. That includes an additional `Authorization` header when an auth type
already sets one.

These headers are rejected when you save:

- `Content-Type`. It's set automatically: the multipart boundary in
  single-request mode, `application/offset+octet-stream` on tus `PATCH`.
- In tus mode, `Tus-Resumable` and any `Upload-*` header, since the tus client
  sets those itself.
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

The response that completes the upload carries the video URL. In
single-request mode that's the only response. In tus mode it's the response to
the last `PATCH`.

Upload succeeded: return any `2xx` status and give the URL in one of two ways.

- An `X-Video-Url` response header:

  ```
  HTTP/1.1 204 No Content
  X-Video-Url: https://video.example.com/v/abc123
  ```

- Or a JSON body with a `url` string:

  ```json
  { "url": "https://video.example.com/v/abc123" }
  ```

If both are present, the header wins. For tus, prefer the header: the spec
requires `204 No Content` for `PATCH`, and some servers (tus-php) can add
headers to that response but not a body.

- The URL must be an absolute `http://` or `https://` URL. It's shown as a link
  and copied to the clipboard.
- Other JSON properties are ignored. The response `Content-Type` isn't checked.
- A response with neither the header nor a body counts as an error, since
  there's no URL.
- If your server sends CORS headers, list `X-Video-Url` in
  `Access-Control-Expose-Headers`.

Upload failed: return a non-`2xx` status. The user sees
`The upload server returned HTTP <status>.` The response body is never shown,
so a body that echoes the request can't leak credentials into the UI.

## Errors

| When                                          | Message                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Chrome host access denied                     | Allow access to the upload endpoint and try again.                                           |
| Network failure, DNS or TLS error             | Could not connect to the upload endpoint.                                                    |
| Non-2xx status                                | The upload server returned HTTP `<status>`.                                                  |
| No `X-Video-Url` header and body isn't JSON   | The upload server returned invalid JSON.                                                     |
| No `X-Video-Url` header and no `url` in body  | The upload response did not include a "url" property or an X-Video-Url header.               |
| URL isn't a valid http(s) URL                 | The upload response URL is invalid.                                                          |
| User clicked Cancel                           | The upload was cancelled.                                                                    |
| tus: `413` on a chunk                         | The server rejected a chunk as too large (HTTP 413). Lower the chunk size.                   |
| tus: no `Location` after creation             | The tus server did not return an upload URL (Location header).                               |
| tus: `Location` on another origin             | The tus server returned an upload URL on `<origin>`, but the endpoint is on `<origin>`.      |
| tus: missing or inconsistent `Upload-Offset`  | The tus server returned an invalid Upload-Offset. / ...reported an unexpected Upload-Offset. |
| tus: last chunk stored, but its response lost | The upload finished, but the connection dropped before the server sent the video URL.        |

In tus mode, retryable failures show up only after the retries run out. See
[Retries and resume](#retries-and-resume).

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
- **tus upload URLs stay on the endpoint's origin.** A `Location` pointing
  anywhere else is refused before any credentials or video go there.
- **Stored in plain text.** Credentials are kept unencrypted in the Chrome
  profile (`chrome.storage.local`). Use a dedicated token scoped to uploads that
  you can revoke, not a personal password.
- **Origin.** Requests come from the extension page, so `Origin` is
  `chrome-extension://<extension-id>`. The extension's host permission means
  CORS response headers aren't needed. Still, a server or WAF that rejects
  unknown origins has to allow this one.

## Example endpoints

### Single request: test with curl

This request is the same as the one the extension sends:

```sh
curl -X POST https://video.example.com/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@demo.mp4;type=video/mp4" \
  -F "filename=demo.mp4" \
  -F "duration=12.5" \
  -F "mime_type=video/mp4"
```

### Single request: Node (Express + multer)

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

### Single request: Laravel

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

### tus: Node (`@tus/server`)

Endpoint URL: `https://video.example.com/files`.

```js
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";

const server = new Server({
  path: "/files",
  datastore: new FileStore({ directory: "./files" }),
  // Behind a TLS-terminating proxy, build https:// Location headers.
  respectForwardedHeaders: true,
  exposedHeaders: ["X-Video-Url"],
  async onIncomingRequest(req) {
    const expected = `Bearer ${process.env.UPLOAD_TOKEN}`;
    if (req.headers.get("authorization") !== expected) {
      throw { status_code: 401, body: "Unauthorized" };
    }
  },
  // upload.metadata holds filename, filetype and duration.
  async onUploadFinish(req, upload) {
    return {
      headers: { "X-Video-Url": `https://video.example.com/v/${upload.id}` },
    };
  },
});

server.listen({ host: "127.0.0.1", port: 1080 });
```

This was tested against `@tus/server` 2.4.5. In 2.x, `onUploadFinish` receives
`(req, upload)`.

### tus: Laravel (tus-php)

Endpoint URL: `https://your-app.example.com/api/tus`.

```sh
composer require ankitpokhrel/tus-php
```

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Http\File;
use Illuminate\Support\Facades\Storage;
use TusPhp\Events\TusEvent;
use TusPhp\Tus\Server as TusServer;

public function register(): void
{
    $this->app->singleton('tus-server', function () {
        // Redis or APCu; tus-php's file cache isn't meant for production.
        $server = new TusServer('redis');
        $server->setApiPath('/api/tus')
            ->setUploadDir(storage_path('app/tus'));

        $server->event()->addListener('tus-server.upload.complete', function (TusEvent $event) {
            // tus-php names the file after the "filename" metadata; move it to a unique name.
            $source = $event->getFile()->details()['file_path'];
            $path = Storage::disk('public')->putFile('recordings', new File($source));
            unlink($source);

            $event->getResponse()->setHeaders([
                'X-Video-Url' => Storage::disk('public')->url($path),
            ]);
        });

        return $server;
    });
}
```

```php
// routes/api.php (run `php artisan install:api` first on Laravel 11+)
Route::any('/tus/{any?}', fn () => app('tus-server')->serve())
    ->where('any', '.*')
    ->middleware('auth:sanctum');
```

tus-php answers the last `PATCH` with `204` and no body. That's why the URL goes
in the `X-Video-Url` header.

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
  for slow uplinks on multi-GB files. In tus mode only one chunk has to fit in
  a proxy timeout.
- **tus behind a proxy.** tus servers build `Location` from the incoming
  request. If TLS ends at a proxy (Cloudflare, a load balancer, nginx), the
  server may generate an `http://` URL, which Screenity refuses as another
  origin. Fix it on the server: `respectForwardedHeaders: true` in
  `@tus/server`, trusted proxies in Laravel, `-behind-proxy` in tusd.
- **tus-php file names.** tus-php writes to `<upload dir>/<filename metadata>`,
  so two uploads with the same title at the same time collide. Move the file
  on completion (as above), or use another server if that matters.
