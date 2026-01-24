const API_BASE = process.env.SCREENITY_API_BASE_URL;

export async function getThumbnailFromBlob(blob, seekTo = 0.1) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";

    const url = URL.createObjectURL(blob);
    video.src = url;

    let timeoutId = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Thumbnail timed out"));
    }, 2000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail"));
    };

    video.onloadedmetadata = () => {
      if (video.duration === Infinity) {
        video.currentTime = 0;
      }
      const targetTime = Math.min(seekTo, video.duration - 0.01);
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (thumbnailBlob) => {
          cleanup();
          if (thumbnailBlob) resolve(thumbnailBlob);
          else reject(new Error("Failed to create thumbnail blob"));
        },
        "image/jpeg",
        0.8
      );
    };
  });
}

export default class BunnyTusUploader {
  constructor(options = {}) {
    this.CHUNK_SIZE = options.chunkSize || 512 * 1024; // 512KB default
    this.MAX_RETRIES = options.maxRetries || 5;
    this.RETRY_DELAY = options.retryDelay || 1000;
    this.UPLOAD_TIMEOUT_MS = options.uploadTimeoutMs || 20000;
    this.HEARTBEAT_INTERVAL_MS = options.heartbeatIntervalMs || 10000;
    this.HEARTBEAT_LAG_MS = options.heartbeatLagMs || 30000;
    this.TOKEN_REFRESH_THRESHOLD = options.tokenRefreshThreshold || 300;
    this.MAX_QUEUE_SIZE = options.maxQueueSize || 100;
    this.onProgress = options.onProgress || null;
    this.onStall = options.onStall || null;

    this.totalBytes = 0;
    this.uploadUrl = null;
    this.offset = 0;
    this.projectId = null;
    this.videoId = null;
    this.mediaId = null;
    this.signature = null;
    this.expires = null;
    this.libraryId = null;
    this.status = "idle";
    this.error = null;
    this.isFinalizing = false;
    this.isPaused = false;
    this.metadata = {};
    this.pendingUploads = [];
    this.userToken = null;
    this.heartbeatTimer = null;
    this.lastProgressAt = Date.now();
    this.stalled = false;

    this.chunkQueue = [];
    this.isProcessingQueue = false;
    this.queueProcessingPromise = null;
    this.queuedBytes = 0;
    this._hasExtractedMeta = true; // Skip in-flight thumbnail extraction to avoid timeouts/noise
  }

  async initialize(
    projectId,
    {
      title,
      type,
      width = null,
      height = null,
      linkedMediaId = null,
      reuse = null,
      sceneId = null,
    }
  ) {
    if (this.status !== "idle" && this.status !== "error") {
      throw new Error("Uploader has already been initialized");
    }

    try {
      this.projectId = projectId;
      this.metadata = { title, type, linkedMediaId, sceneId };
      this.sceneId = sceneId;
      this.metaWidth = width;
      this.metaHeight = height;

      this.status = "initializing";
      this.error = null;
      this.offset = 0;
      this.totalBytes = 0;

      // Validate reuse object if provided
      if (reuse) {
        if (!reuse.videoId || !reuse.mediaId) {
          throw new Error(
            "Invalid reuse object: must have both videoId and mediaId"
          );
        }
        this.videoId = reuse.videoId;
        this.mediaId = reuse.mediaId;
      } else {
        const { authenticated, user } = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "check-auth-status" }, resolve);
        });

        if (!authenticated) throw new Error("Not authenticated with Screenity");

        const { screenityToken } = await chrome.storage.local.get([
          "screenityToken",
        ]);

        this.userToken = screenityToken;

        if (!this.userToken) {
          throw new Error("Missing user token for saving upload metadata");
        }

        const res = await fetch(`${API_BASE}/bunny/videos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            title,
            projectId,
            type,
            linkedMediaId,
            sceneId,
          }),
        });

        if (!res.ok) throw new Error("Failed to create Bunny video");
        const data = await res.json();
        this.videoId = data.videoId;
        this.mediaId = data.mediaId;
      }

      await this.refreshTusAuth();
      await this.initTusUpload();
      this.startHeartbeat();
      this.status = "ready";
      return { videoId: this.videoId, mediaId: this.mediaId };
    } catch (err) {
      this.status = "error";
      this.error = err.message;
      throw err;
    }
  }

  async refreshTusAuth() {
    const res = await fetch(
      `${API_BASE}/bunny/videos/tus-auth?videoId=${this.videoId}`
    );
    if (!res.ok) throw new Error("Failed to refresh TUS auth");
    const { signature, expires, libraryId } = await res.json();
    this.signature = signature;
    this.expires = expires;
    this.libraryId = libraryId;
  }

  async initTusUpload() {
    const res = await fetch("https://video.bunnycdn.com/tusupload", {
      method: "POST",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Defer-Length": "1",
        AuthorizationSignature: this.signature,
        AuthorizationExpire: String(this.expires),
        LibraryId: String(this.libraryId),
        VideoId: this.videoId,
        "Upload-Metadata": `filetype ${btoa("video/webm")},title ${btoa(
          this.metadata.title
        )}`,
      },
    });

    if (!res.ok) throw new Error("Failed to start TUS upload session");
    const location = res.headers.get("location");
    this.uploadUrl = location.startsWith("/")
      ? `https://video.bunnycdn.com${location}`
      : location;

    await fetch(`${API_BASE}/bunny/videos/save-upload-meta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.userToken}`,
      },
      body: JSON.stringify({
        mediaId: this.mediaId,
        uploadUrl: this.uploadUrl,
        signature: this.signature,
        expires: this.expires,
      }),
    });
  }

  async write(chunk) {
    if (this.isFinalizing) throw new Error("Cannot write during finalization");
    if (this.isPaused) throw new Error("Uploader paused");
    if (!this.uploadUrl) throw new Error("Uploader not initialized");

    // Check if we're in error state
    if (this.status === "error") {
      throw new Error(`Uploader in error state: ${this.error}`);
    }

    await this.checkAuthExpiration();
    this.status = "uploading";

    for (let i = 0; i < chunk.size; i += this.CHUNK_SIZE) {
      const subChunk = chunk.slice(i, i + this.CHUNK_SIZE);
      this.chunkQueue.push(subChunk);
      this.queuedBytes += subChunk.size;
      this.totalBytes += subChunk.size;
    }

    // Always ensure queue is processing
    if (!this.isProcessingQueue) {
      this.queueProcessingPromise = this.processQueue();
    }

    // Wait for current queue to finish processing these chunks
    if (this.queuedBytes > 10 * 1024 * 1024) {
      await this.waitForPendingUploads();
    }

    // Thumbnail extraction disabled in-flight to reduce timeouts/noise.
    this._hasExtractedMeta = true;
  }

  async checkAuthExpiration() {
    if (!this.expires) return;
    const now = Math.floor(Date.now() / 1000);
    if (this.expires - now < this.TOKEN_REFRESH_THRESHOLD) {
      await this.refreshTusAuth();

      if (this.isProcessingQueue) {
        this.pause();
        this.resume();
      }
    }
  }
  async uploadChunk(chunk) {
    if (this.isFinalizing) return;
    const data = new Uint8Array(await chunk.arrayBuffer());

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const currentOffset = this.offset;

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort("upload-timeout"),
          this.UPLOAD_TIMEOUT_MS
        );

        const res = await fetch(this.uploadUrl, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": "1.0.0",
            "Content-Type": "application/offset+octet-stream",
            "Upload-Offset": String(currentOffset),
            AuthorizationSignature: this.signature,
            AuthorizationExpire: String(this.expires),
            LibraryId: String(this.libraryId),
            VideoId: this.videoId,
          },
          body: data,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok || res.status === 204) {
          // Server is the source of truth
          const serverOffsetHeader = res.headers.get("Upload-Offset");
          if (serverOffsetHeader) {
            this.offset = parseInt(serverOffsetHeader, 10);
          } else {
            // Fallback if Bunny doesn't return it for some reason
            this.offset = currentOffset + data.length;
          }

          this.recordProgress(data.length);
          return;
        } else {
          const errorText = await res.text();

          // If the TUS session was invalidated (404), flag as fatal so callers can fall back.
          if (res.status === 404) {
            this.status = "error";
            this.error = "tus-session-missing";
            this.stalled = true;
            if (typeof this.onStall === "function") {
              this.onStall({
                mediaId: this.mediaId,
                videoId: this.videoId,
                offset: this.offset,
                diff: Date.now() - this.lastProgressAt,
                reason: "tus-404",
              });
            }
            throw new Error("TUS session missing (404).");
          }

          // Handle offset mismatch errors (409 Conflict)
          if (
            res.status === 409 ||
            errorText.toLowerCase().includes("offset")
          ) {
            console.warn(
              `⚠️ Offset conflict detected (status ${res.status}), fetching current offset from server`
            );

            // Query server for current offset using HEAD request
            try {
              const headRes = await fetch(this.uploadUrl, {
                method: "HEAD",
                headers: {
                  "Tus-Resumable": "1.0.0",
                  AuthorizationSignature: this.signature,
                  AuthorizationExpire: String(this.expires),
                  LibraryId: String(this.libraryId),
                  VideoId: this.videoId,
                },
              });

              if (headRes.ok) {
                const serverOffset = parseInt(
                  headRes.headers.get("Upload-Offset") || "0"
                );

                this.offset = serverOffset;

                // Retry with corrected offset
                continue;
              }
            } catch (headErr) {
              console.error("Failed to fetch server offset:", headErr);
            }
          }

          throw new Error(`Upload failed (${res.status}): ${errorText}`);
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          console.warn("⚠️ Upload chunk timed out");
        }
        if (attempt === this.MAX_RETRIES) {
          console.error(
            `❌ Failed to upload chunk after ${this.MAX_RETRIES} retries:`,
            err
          );
          throw err;
        }
        console.warn(
          `⚠️ Upload attempt ${attempt + 1}/${
            this.MAX_RETRIES + 1
          } failed, retrying...`,
          err.message
        );
        const jitter = Math.random() * 300;
        await new Promise((r) =>
          setTimeout(r, this.RETRY_DELAY * Math.pow(2, attempt) + jitter)
        );
      }
    }
  }

  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.chunkQueue.length && !this.isPaused && !this.isFinalizing) {
        const chunk = this.chunkQueue.shift();
        this.queuedBytes -= chunk.size;

        // Serialize uploads: wait for each chunk to complete before starting next
        try {
          await this.uploadChunk(chunk);
        } catch (err) {
          console.error("❌ Chunk upload failed in queue:", err);

          // Put chunk back at front of queue for potential retry
          this.chunkQueue.unshift(chunk);
          this.queuedBytes += chunk.size;

          // Set error state
          this.status = "error";
          this.error = `Upload failed: ${err.message}`;

          // Stop processing queue on error
          break;
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.queueProcessingPromise = null;
    }
  }

  async waitForPendingUploads() {
    // Temporarily unpause to ensure all chunks are processed
    const wasPaused = this.isPaused;
    if (wasPaused) {
      this.isPaused = false;
    }

    while (
      this.chunkQueue.length > 0 ||
      this.isProcessingQueue ||
      this.pendingUploads.length > 0
    ) {
      if (this.stalled && this.lastProgressAt) {
        const diff = Date.now() - this.lastProgressAt;
        if (diff > this.HEARTBEAT_LAG_MS * 2) {
          break;
        }
      }
      if (this.chunkQueue.length && !this.isProcessingQueue) {
        await this.processQueue();
      }
      if (this.queueProcessingPromise) {
        await this.queueProcessingPromise;
      }
      if (this.pendingUploads.length) {
        await Promise.all(this.pendingUploads);
      }
      // Small delay to catch any race conditions
      await new Promise((r) => setTimeout(r, 100));
    }

    // Restore pause state if it was paused
    if (wasPaused) {
      this.isPaused = true;
    }
  }

  async finalize() {
    if (this.isFinalizing) throw new Error("Already finalizing");
    this.isFinalizing = true;
    await this.waitForPendingUploads();
    await this.checkAuthExpiration();

    // Re-validate offset with server to avoid partial finalization
    let serverOffset = null;
    try {
      const headRes = await fetch(this.uploadUrl, {
        method: "HEAD",
        headers: {
          "Tus-Resumable": "1.0.0",
          AuthorizationSignature: this.signature,
          AuthorizationExpire: String(this.expires),
          LibraryId: String(this.libraryId),
          VideoId: this.videoId,
        },
      });

      if (headRes.ok) {
        serverOffset = parseInt(
          headRes.headers.get("Upload-Offset") || "0",
          10
        );
        this.offset = serverOffset;
      }
    } catch (err) {
      console.warn("⚠️ Failed HEAD before finalize:", err);
    }

    // If server didn't receive everything, don't "finalize" into a ghost upload.
    if (serverOffset === null) {
      throw new Error("Finalize failed: could not verify server offset.");
    }

    if (serverOffset === 0) {
      this.status = "error";
      this.error = "server-offset-0";
      throw new Error("Finalize failed: server has 0 bytes.");
    }

    if (serverOffset < this.totalBytes) {
      this.status = "error";
      this.error = `incomplete-upload server=${serverOffset} expected=${this.totalBytes}`;
      throw new Error(
        `Finalize blocked: upload incomplete (server ${serverOffset} / expected ${this.totalBytes}).`
      );
    }

    if (serverOffset > this.totalBytes) {
      this.status = "error";
      this.error = `invalid-length server=${serverOffset} expected=${this.totalBytes}`;
      throw new Error(
        `Finalize blocked: serverOffset (${serverOffset}) exceeds expected totalBytes (${this.totalBytes}).`
      );
    }

    // Now we can safely complete the tus upload by declaring the final length
    const res = await fetch(this.uploadUrl, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": String(serverOffset),
        "Upload-Length": String(this.totalBytes),
        AuthorizationSignature: this.signature,
        AuthorizationExpire: String(this.expires),
        LibraryId: String(this.libraryId),
        VideoId: this.videoId,
      },
    });

    if (!res.ok && res.status !== 204) throw new Error("Finalization failed");
    this.status = "completed";
    this.stopHeartbeat();
  }

  getMeta() {
    return {
      videoId: this.videoId,
      mediaId: this.mediaId,
      offset: this.offset,
      status: this.status,
      error: this.error,
      isPaused: this.isPaused,
      isFinalizing: this.isFinalizing,
      metadata: this.metadata,
      expiresAt: this.expires ? new Date(this.expires * 1000) : null,
      queueLength: this.chunkQueue.length,
      queuedBytes: this.queuedBytes,
      width: this.metaWidth || null,
      height: this.metaHeight || null,
      thumbnail: this.metaThumbnail || null,
      sceneId: this.sceneId || null,
      lastProgressAt: this.lastProgressAt,
      stalled: this.stalled,
    };
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      if (!this.isProcessingQueue && this.chunkQueue.length > 0) {
        this.queueProcessingPromise = this.processQueue();
      }
    }
  }

  async abort() {
    this.pause();
    this.status = "aborted";
    this.uploadUrl = null;
    this.chunkQueue = [];
    this.queuedBytes = 0;
    this.totalBytes = 0;
    this.pendingUploads = [];
    this.stopHeartbeat();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.lastProgressAt = Date.now();
    this.stalled = false;
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const diff = now - this.lastProgressAt;
      if (diff > this.HEARTBEAT_LAG_MS) {
        this.stalled = true;
        if (typeof this.onStall === "function") {
          this.onStall({
            mediaId: this.mediaId,
            videoId: this.videoId,
            offset: this.offset,
            diff,
          });
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  recordProgress(bytes) {
    this.lastProgressAt = Date.now();
    this.stalled = false;
    if (typeof this.onProgress === "function") {
      try {
        this.onProgress({
          bytes,
          offset: this.offset,
          videoId: this.videoId,
          mediaId: this.mediaId,
          at: this.lastProgressAt,
        });
      } catch (err) {
        console.warn("Progress callback failed:", err);
      }
    }

    // Journal offsets locally to aid recovery
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const key = `uploadJournal-${this.mediaId}`;
      chrome.storage.local.set({
        [key]: {
          offset: this.offset,
          updatedAt: this.lastProgressAt,
          videoId: this.videoId,
          mediaId: this.mediaId,
          stalled: this.stalled,
        },
      });
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BunnyTusUploader;
} else {
  window.BunnyTusUploader = BunnyTusUploader;
}
