const API_BASE = process.env.SCREENITY_API_BASE_URL;

export async function getThumbnailFromBlob(blob, seekTo = 0.1) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";

    const url = URL.createObjectURL(blob);
    video.src = url;

    video.onloadedmetadata = () => {
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
          URL.revokeObjectURL(url);
          if (thumbnailBlob) {
            resolve(thumbnailBlob);
          } else {
            reject(new Error("Failed to create thumbnail blob"));
          }
        },
        "image/jpeg",
        0.8
      );
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for thumbnail"));
    };
  });
}

export default class BunnyTusUploader {
  constructor(options = {}) {
    this.CHUNK_SIZE = options.chunkSize || 512 * 1024; // 512KB default
    this.MAX_RETRIES = options.maxRetries || 5;
    this.RETRY_DELAY = options.retryDelay || 1000;
    this.TOKEN_REFRESH_THRESHOLD = options.tokenRefreshThreshold || 300;
    this.MAX_QUEUE_SIZE = options.maxQueueSize || 100;

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

    this.chunkQueue = [];
    this.isProcessingQueue = false;
    this.queueProcessingPromise = null;
    this.queuedBytes = 0;
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
    }

    // Always ensure queue is processing
    if (!this.isProcessingQueue) {
      this.queueProcessingPromise = this.processQueue();
    }

    // Wait for current queue to finish processing these chunks
    if (this.queueProcessingPromise) {
      await this.queueProcessingPromise;
    }

    if (!this._hasExtractedMeta && chunk.size > 128 * 1024) {
      try {
        const blob = new Blob([chunk], { type: "video/webm" });

        if (this.metadata.type === "screen") {
          this.metaThumbnail = await getThumbnailFromBlob(blob);
        }

        this._hasExtractedMeta = true;
      } catch (err) {
        console.warn("⚠️ Failed to extract metadata from chunk:", err);
      }
    }
  }

  async checkAuthExpiration() {
    if (!this.expires) return;
    const now = Math.floor(Date.now() / 1000);
    if (this.expires - now < this.TOKEN_REFRESH_THRESHOLD) {
      await this.refreshTusAuth();
    }
  }

  async uploadChunk(chunk) {
    const data = new Uint8Array(await chunk.arrayBuffer());

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        // Use current offset atomically to prevent race conditions
        const currentOffset = this.offset;

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
        });

        if (res.ok || res.status === 204) {
          // Verify server offset matches our expectation
          const serverOffset = res.headers.get("Upload-Offset");
          const expectedOffset = currentOffset + data.length;

          if (serverOffset) {
            const actualOffset = parseInt(serverOffset);
            if (actualOffset !== expectedOffset) {
              console.warn(
                `⚠️ Offset mismatch! Expected: ${expectedOffset}, Server: ${actualOffset}`
              );
              this.offset = actualOffset;
            } else {
              this.offset = expectedOffset;
            }
          } else {
            this.offset = expectedOffset;
          }

          return;
        } else {
          const errorText = await res.text();

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
                console.log(
                  `📊 Server offset: ${serverOffset}, Local offset was: ${this.offset}`
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
        await new Promise((r) =>
          setTimeout(r, this.RETRY_DELAY * Math.pow(2, attempt))
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

    // Validate that we actually uploaded data
    if (this.offset === 0) {
      this.status = "error";
      this.error = "No data uploaded - offset is 0";
      throw new Error(
        "Cannot finalize upload with zero bytes. No chunks were successfully uploaded."
      );
    }

    const res = await fetch(this.uploadUrl, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": String(this.offset),
        "Upload-Length": String(this.offset),
        AuthorizationSignature: this.signature,
        AuthorizationExpire: String(this.expires),
        LibraryId: String(this.libraryId),
        VideoId: this.videoId,
      },
    });

    if (!res.ok && res.status !== 204) throw new Error("Finalization failed");
    this.status = "completed";
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
    this.pendingUploads = [];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BunnyTusUploader;
} else {
  window.BunnyTusUploader = BunnyTusUploader;
}
