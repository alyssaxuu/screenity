const API_BASE = process.env.SCREENITY_API_BASE_URL;

// Guard so uploaders in the same page session don't sweep concurrently.
let _journalSweepDone = false;

// Sweep TTL is generous (14d) vs the 24h resume-validity check: the only cost
// of not sweeping is quota buildup, so leave multi-day uploads room to resume.
const JOURNAL_SWEEP_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Orphan uploadJournal-<mediaId> entries accumulate against the storage.local
// 5MB cap when an uploader dies before finalize/abort. Sweep once per session.
async function sweepStaleUploadJournals() {
  if (_journalSweepDone) return;
  _journalSweepDone = true;
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  try {
    const all = await chrome.storage.local.get(null);
    const cutoff = Date.now() - JOURNAL_SWEEP_TTL_MS;
    const stale = [];
    for (const [key, value] of Object.entries(all || {})) {
      if (!key.startsWith("uploadJournal-")) continue;
      const updatedAt = Number(value?.updatedAt) || 0;
      if (updatedAt > 0 && updatedAt < cutoff) stale.push(key);
    }
    if (stale.length > 0) {
      console.log(
        `[bunnyTusUploader] sweeping ${stale.length} stale journal entries (>${JOURNAL_SWEEP_TTL_MS / (24 * 60 * 60 * 1000)}d)`,
      );
      await chrome.storage.local.remove(stale);
    }
  } catch (err) {
    // Non-fatal: a future sweep catches the leftover quota.
    console.warn("[bunnyTusUploader] journal sweep failed", err);
  }
}

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
        0.8,
      );
    };
  });
}

export default class BunnyTusUploader {
  constructor(options = {}) {
    this.CHUNK_SIZE = options.chunkSize || 512 * 1024;
    this.MAX_RETRIES = options.maxRetries || 5;
    this.RETRY_DELAY = options.retryDelay || 1000;
    this.UPLOAD_TIMEOUT_MS = options.uploadTimeoutMs || 20000;
    this.HEARTBEAT_INTERVAL_MS = options.heartbeatIntervalMs || 10000;
    this.HEARTBEAT_LAG_MS = options.heartbeatLagMs || 30000;
    this.TOKEN_REFRESH_THRESHOLD = options.tokenRefreshThreshold || 300;
    this.MAX_QUEUE_SIZE = options.maxQueueSize || 100;
    this.onProgress = options.onProgress || null;
    this.onStall = options.onStall || null;
    this.onTelemetry = options.onTelemetry || null;
    this.onStateChange = options.onStateChange || null;
    this.trackType = options.trackType || null;
    // Container declared in TUS Upload-Metadata. Defaults to webm for
    // back-compat with pre-WebCodecs callers; cloud's WebCodecs path
    // overrides to "video/mp4" for screen + camera tracks. Audio always
    // stays on webm.
    this.container = options.container || "video/webm";
    this.codec = options.codec || null;
    this.encoderKind = options.encoderKind || null;

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
    this._hasExtractedMeta = true;
    this.sessionId = options.sessionId || null;
    this.journalKey = null;
    this.journalLookupKey = null;
    this.fingerprint = null;
    this.metaWidth = null;
    this.metaHeight = null;
    this.lastJournalPersistAt = 0;
    this.journalPersistTimer = null;
    this.JOURNAL_WRITE_INTERVAL_MS = options.journalWriteIntervalMs || 4000;
    this.PROGRESS_EVENT_INTERVAL_MS =
      options.progressEventIntervalMs || 5000;
    this.createdAt = null;
    this.readyAt = null;
    this.firstByteAt = null;
    this.lastChunkQueuedAt = null;
    this.lastErrorAt = null;
    this.lastErrorCode = null;
    this.finalizeStartedAt = null;
    this.finalizedAt = null;
    this.resumeCount = 0;
    this.lastServerOffset = 0;
    this.hasEmittedClientStarted = false;
    this.hasEmittedFirstByte = false;
    this.lastProgressEventAt = 0;
    this.initializedFromResume = false;
    // Bytes from write() calls that arrived after finalize() locked us
    // out. Tracked so finalize() can refuse to mark the upload completed
    // instead of silently truncating; the throw inside write() is
    // unobserved because MediaRecorder.ondataavailable is fire-and-forget.
    this.bytesLostAfterFinalize = 0;
  }

  debugLog(message, payload = null) {
    if (!this.debug) return;
    if (payload) {
      console.info(`[BunnyTusUploader] ${message}`, payload);
      return;
    }
    console.info(`[BunnyTusUploader] ${message}`);
  }

  getUploaderType() {
    return this.trackType || this.metadata?.type || null;
  }

  emitTelemetry(event, payload = {}) {
    if (typeof this.onTelemetry !== "function") return;
    try {
      const body = {
        projectId: this.projectId || null,
        sceneId: this.sceneId || null,
        recordingSessionId: this.sessionId || null,
        mediaId: this.mediaId || null,
        bunnyVideoId: this.videoId || null,
        trackType: this.getUploaderType(),
        uploaderType: "bunny_tus",
        status: this.status,
        offset: this.offset || 0,
        totalBytes: this.totalBytes || 0,
        queuedBytes: this.queuedBytes || 0,
        codec: this.codec || null,
        container: this.container || null,
        encoderKind: this.encoderKind || null,
        ...payload,
      };
      this.onTelemetry(event, body);
    } catch (err) {
      console.warn("Upload telemetry callback failed:", err);
    }
  }

  // The encoder's emitted codec can differ from what was requested at
  // construction (HW encoders re-derive profile/level from the SPS).
  // Call after the first chunk so telemetry and /bunny/save-upload-meta
  // carry the actual values.
  updateEncoderInfo({ codec, container, encoderKind } = {}) {
    if (typeof codec === "string" && codec) this.codec = codec;
    if (typeof container === "string" && container) this.container = container;
    if (typeof encoderKind === "string" && encoderKind) this.encoderKind = encoderKind;
  }

  notifyStateChange(reason = null, extra = {}) {
    if (typeof this.onStateChange !== "function") return;
    try {
      this.onStateChange({
        reason: reason || null,
        ...this.getResumeState(),
        ...extra,
      });
    } catch (err) {
      console.warn("Upload state callback failed:", err);
    }
  }

  setUploaderError(errorCode, err = null, extra = null) {
    this.status = "error";
    this.error = errorCode || err?.message || "upload-error";
    this.lastErrorAt = Date.now();
    this.lastErrorCode = errorCode || null;
    // resume() restarts.
    this.stopHeartbeat();
    this.emitTelemetry("upload_error", {
      errorCode: errorCode || null,
      message: err?.message || this.error || "upload-error",
      ...(extra && typeof extra === "object" ? extra : {}),
    });
    this.scheduleJournalPersist({ force: true });
  }

  async setSessionId(sessionId) {
    this.sessionId = sessionId || null;
    await this.persistUploadJournal({ force: true });
    this.notifyStateChange("session-updated");
  }

  getResumeState() {
    return {
      projectId: this.projectId || null,
      sceneId: this.sceneId || null,
      type: this.metadata?.type || null,
      trackType: this.getUploaderType(),
      sessionId: this.sessionId || null,
      videoId: this.videoId || null,
      mediaId: this.mediaId || null,
      uploadUrl: this.uploadUrl || null,
      offset: this.offset || 0,
      totalBytes: this.totalBytes || 0,
      status: this.status,
      error: this.error || null,
      stalled: this.stalled,
      queueLength: this.chunkQueue.length,
      queuedBytes: this.queuedBytes,
      lastProgressAt: this.lastProgressAt || null,
      journalKey: this.journalKey || null,
      journalLookupKey: this.journalLookupKey || null,
      resumeCount: this.resumeCount || 0,
      firstByteAt: this.firstByteAt || null,
      readyAt: this.readyAt || null,
      createdAt: this.createdAt || null,
      finalizedAt: this.finalizedAt || null,
      lastErrorAt: this.lastErrorAt || null,
      lastErrorCode: this.lastErrorCode || null,
      updatedAt: Date.now(),
    };
  }

  scheduleJournalPersist({ force = false } = {}) {
    if (force) {
      if (this.journalPersistTimer) {
        clearTimeout(this.journalPersistTimer);
        this.journalPersistTimer = null;
      }
      void this.persistUploadJournal({ force: true });
      return;
    }

    const sinceLastPersist = Date.now() - this.lastJournalPersistAt;
    if (sinceLastPersist >= this.JOURNAL_WRITE_INTERVAL_MS) {
      void this.persistUploadJournal({ force: false });
      return;
    }

    if (this.journalPersistTimer) return;
    const waitMs = this.JOURNAL_WRITE_INTERVAL_MS - sinceLastPersist;
    this.journalPersistTimer = setTimeout(() => {
      this.journalPersistTimer = null;
      void this.persistUploadJournal({ force: false });
    }, Math.max(250, waitMs));
  }

  getJournalKey(mediaId) {
    return mediaId ? `uploadJournal-${mediaId}` : null;
  }

  getJournalLookupKey(projectId, sceneId, type) {
    return `uploadJournalLookup-${projectId}-${sceneId || "none"}-${type}`;
  }

  getVideoMapKey(projectId, sceneId, type) {
    return `bunnyVideoMap-${projectId}-${sceneId || "none"}-${type || "none"}`;
  }

  async getVideoMap(projectId, sceneId, type) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
    const key = this.getVideoMapKey(projectId, sceneId, type);
    const result = await chrome.storage.local.get([key]);
    const entry = result?.[key];
    if (!entry || !entry.videoId || !entry.mediaId) return null;
    return { ...entry, key };
  }

  async persistVideoMap({
    projectId,
    sceneId,
    type,
    videoId,
    mediaId,
    sessionId,
  }) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    if (!projectId || !videoId || !mediaId) return;
    const key = this.getVideoMapKey(projectId, sceneId, type);
    await chrome.storage.local.set({
      [key]: {
        projectId,
        sceneId: sceneId || null,
        type: type || null,
        trackType: this.getUploaderType(),
        videoId,
        mediaId,
        sessionId: sessionId || null,
        updatedAt: Date.now(),
      },
    });
  }

  buildFingerprint({ projectId, sceneId, type, width, height, fingerprint }) {
    if (fingerprint) return fingerprint;
    return `${projectId || "none"}:${sceneId || "none"}:${type || "none"}:${
      width || "na"
    }x${height || "na"}`;
  }

  async clearUploadJournal(journal = null) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    const keysToRemove = [];
    const mediaId = journal?.mediaId || this.mediaId || null;
    const journalKey = journal?.key || this.getJournalKey(mediaId);
    const lookupKey = journal?.lookupKey || this.journalLookupKey;

    if (journalKey) keysToRemove.push(journalKey);
    if (lookupKey) keysToRemove.push(lookupKey);
    if (!keysToRemove.length) return;

    try {
      await chrome.storage.local.remove(keysToRemove);
      this.debugLog("Cleared upload journal", {
        keys: keysToRemove,
      });
      if (!journal || !journal.key || journal.key === this.journalKey) {
        this.journalKey = null;
      }
      this.notifyStateChange("journal-cleared");
    } catch (err) {
      this.debugLog("Failed to clear upload journal", {
        error: err?.message || err,
        keys: keysToRemove,
      });
    }
  }

  async persistUploadJournal({ force = false } = {}) {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage?.local ||
      !this.mediaId
    )
      return;
    if (this.journalPersistTimer && force) {
      clearTimeout(this.journalPersistTimer);
      this.journalPersistTimer = null;
    }

    if (
      !force &&
      Date.now() - this.lastJournalPersistAt < this.JOURNAL_WRITE_INTERVAL_MS
    ) {
      return;
    }

    const journalKey = this.journalKey || this.getJournalKey(this.mediaId);
    this.journalKey = journalKey;

    const inferredLookupKey =
      this.projectId && this.metadata?.type
        ? this.getJournalLookupKey(
            this.projectId,
            this.sceneId,
            this.metadata.type,
          )
        : null;
    const lookupKey = this.journalLookupKey || inferredLookupKey;
    this.journalLookupKey = lookupKey;

    const updatedAt = Date.now();
    const payload = {
      journalVersion: 2,
      key: journalKey,
      projectId: this.projectId || null,
      sceneId: this.sceneId || null,
      type: this.metadata.type || null,
      trackType: this.getUploaderType(),
      width: this.metaWidth || null,
      height: this.metaHeight || null,
      fingerprint: this.fingerprint || null,
      sessionId: this.sessionId || null,
      uploadUrl: this.uploadUrl || null,
      signature: this.signature || null,
      expires: this.expires || null,
      libraryId: this.libraryId || null,
      offset: this.offset,
      totalBytes: this.totalBytes,
      updatedAt,
      videoId: this.videoId,
      mediaId: this.mediaId,
      stalled: this.stalled,
      status: this.status,
      error: this.error || null,
      queueLength: this.chunkQueue.length,
      queuedBytes: this.queuedBytes,
      lastProgressAt: this.lastProgressAt || null,
      createdAt: this.createdAt || null,
      readyAt: this.readyAt || null,
      firstByteAt: this.firstByteAt || null,
      lastChunkQueuedAt: this.lastChunkQueuedAt || null,
      finalizeStartedAt: this.finalizeStartedAt || null,
      finalizedAt: this.finalizedAt || null,
      lastErrorAt: this.lastErrorAt || null,
      lastErrorCode: this.lastErrorCode || null,
      lastServerOffset: this.lastServerOffset || 0,
      resumeCount: this.resumeCount || 0,
    };

    const toStore = {
      [journalKey]: payload,
    };
    if (lookupKey) {
      toStore[lookupKey] = {
        mediaId: this.mediaId,
        key: journalKey,
        updatedAt: payload.updatedAt,
      };
    }
    try {
      await chrome.storage.local.set(toStore);
      this.lastJournalPersistAt = updatedAt;
      this.notifyStateChange("journal-persisted");
    } catch (err) {
      this.debugLog("Failed to persist upload journal", {
        error: err?.message || err,
        mediaId: this.mediaId,
      });
      // Journal write failure (quota, transient I/O). Halt the uploader so
      // a crash+resume doesn't replay bytes from the stale on-disk offset.
      this.stalled = true;
      this.lastErrorAt = Date.now();
      this.lastErrorCode = "JOURNAL_PERSIST_FAILED";
      this.error = String(err?.message || err).slice(0, 200);
      try {
        this.notifyStateChange("journal-persist-failed");
      } catch {
        // notifyStateChange itself shouldn't fail, but if it does the
        // stalled flag above is the load-bearing signal.
      }
    }
  }

  isResumeJournalStale(updatedAt) {
    if (!updatedAt) return true;
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    return Date.now() - updatedAt > MAX_AGE_MS;
  }

  validateResumeJournal(
    journal,
    { projectId, sceneId, type, fingerprint, allowSceneMismatch = false },
  ) {
    if (
      !journal ||
      !journal.mediaId ||
      !journal.videoId ||
      !journal.uploadUrl
    ) {
      return { valid: false, reason: "missing-required-fields" };
    }
    if (journal.projectId !== projectId) {
      return { valid: false, reason: "project-mismatch" };
    }
    if (journal.type !== type) {
      return { valid: false, reason: "type-mismatch" };
    }
    if (
      !allowSceneMismatch &&
      sceneId &&
      journal.sceneId &&
      journal.sceneId !== sceneId
    ) {
      return { valid: false, reason: "scene-mismatch" };
    }
    if (
      fingerprint &&
      journal.fingerprint &&
      journal.fingerprint !== fingerprint
    ) {
      return { valid: false, reason: "fingerprint-mismatch" };
    }
    if (this.isResumeJournalStale(journal.updatedAt)) {
      return { valid: false, reason: "stale-journal" };
    }
    return { valid: true, reason: "ok" };
  }

  async getResumeJournal({
    projectId,
    sceneId,
    type,
    fingerprint,
    reuse = null,
  }) {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
    const lookupKey = this.getJournalLookupKey(projectId, sceneId, type);
    const candidates = [];

    if (reuse?.mediaId) {
      const reuseKey = this.getJournalKey(reuse.mediaId);
      const reuseResult = await chrome.storage.local.get([reuseKey]);
      if (reuseResult[reuseKey]) {
        candidates.push({
          journal: reuseResult[reuseKey],
          key: reuseKey,
          lookupKey,
          allowSceneMismatch: true,
        });
      }
    }

    const lookupResult = await chrome.storage.local.get([lookupKey]);
    const mappedMediaId = lookupResult?.[lookupKey]?.mediaId || null;
    if (mappedMediaId) {
      const mappedKey = this.getJournalKey(mappedMediaId);
      const mappedResult = await chrome.storage.local.get([mappedKey]);
      if (mappedResult[mappedKey]) {
        candidates.push({
          journal: mappedResult[mappedKey],
          key: mappedKey,
          lookupKey,
          allowSceneMismatch: false,
        });
      }
    }

    if (!candidates.length) return null;

    for (const candidate of candidates) {
      const validation = this.validateResumeJournal(candidate.journal, {
        projectId,
        sceneId,
        type,
        fingerprint,
        allowSceneMismatch: candidate.allowSceneMismatch,
      });
      if (validation.valid) {
        this.debugLog("Found valid upload journal for resume", {
          mediaId: candidate.journal.mediaId,
          projectId,
          sceneId,
          type,
          offset: candidate.journal.offset || 0,
        });
        return {
          ...candidate.journal,
          key: candidate.key,
          lookupKey: candidate.lookupKey,
        };
      }

      this.debugLog("Discarding invalid upload journal", {
        reason: validation.reason,
        mediaId: candidate.journal?.mediaId || null,
        projectId,
        sceneId,
        type,
      });
      await this.clearUploadJournal({
        key: candidate.key,
        lookupKey: candidate.lookupKey,
        mediaId: candidate.journal?.mediaId || null,
      });
    }

    return null;
  }

  async getServerOffset() {
    if (!this.uploadUrl) return null;
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

      if (!headRes.ok) {
        this.debugLog("HEAD offset check failed", {
          status: headRes.status,
        });
        return null;
      }

      const serverOffset = parseInt(
        headRes.headers.get("Upload-Offset") || "0",
        10,
      );
      return Number.isFinite(serverOffset) ? serverOffset : null;
    } catch (err) {
      this.debugLog("HEAD offset check threw", {
        error: err?.message || err,
      });
      return null;
    }
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
      sessionId = null,
    },
  ) {
    if (this.status !== "idle" && this.status !== "error") {
      throw new Error("Uploader has already been initialized");
    }

    // Fire-and-forget orphan-journal cleanup; doesn't block the hot path.
    void sweepStaleUploadJournals();

    try {
      this.projectId = projectId;
      this.metadata = { title, type, linkedMediaId, sceneId };
      this.trackType = this.trackType || type || null;
      this.sceneId = sceneId;
      this.metaWidth = width;
      this.metaHeight = height;
      this.sessionId = sessionId || this.sessionId || null;
      this.journalLookupKey = this.getJournalLookupKey(projectId, sceneId, type);
      this.createdAt = this.createdAt || Date.now();

      this.status = "initializing";
      this.error = null;
      this.offset = 0;
      this.totalBytes = 0;
      this.lastErrorAt = null;
      this.lastErrorCode = null;
      this.initializedFromResume = false;

      const fingerprint = this.buildFingerprint({
        projectId,
        sceneId,
        type,
        width,
        height,
      });
      this.fingerprint = fingerprint;

      const resumeJournal = await this.getResumeJournal({
        projectId,
        sceneId,
        type,
        fingerprint,
        reuse,
      });

      if (reuse) {
        if (!reuse.videoId || !reuse.mediaId) {
          throw new Error(
            "Invalid reuse object: must have both videoId and mediaId",
          );
        }
        this.videoId = reuse.videoId;
        this.mediaId = reuse.mediaId;
      } else if (resumeJournal?.videoId && resumeJournal?.mediaId) {
        this.initializedFromResume = true;
        this.videoId = resumeJournal.videoId;
        this.mediaId = resumeJournal.mediaId;
        this.uploadUrl = resumeJournal.uploadUrl || null;
        this.offset = resumeJournal.offset || 0;
        this.totalBytes = resumeJournal.totalBytes || 0;
        this.journalKey =
          resumeJournal.key || this.journalKey || this.getJournalKey(this.mediaId);
        this.journalLookupKey = resumeJournal.lookupKey || this.journalLookupKey;
        if (!this.sessionId && resumeJournal.sessionId) {
          this.sessionId = resumeJournal.sessionId;
        }
        this.resumeCount = (resumeJournal.resumeCount || 0) + 1;
        this.debugLog("Resuming upload from journal candidate", {
          projectId,
          sceneId,
          type,
          mediaId: this.mediaId,
          offset: this.offset,
        });
        await this.persistVideoMap({
          projectId,
          sceneId,
          type,
          videoId: this.videoId,
          mediaId: this.mediaId,
          sessionId: this.sessionId,
        });
      } else {
        const existingMap = await this.getVideoMap(projectId, sceneId, type);
        if (existingMap?.videoId && existingMap?.mediaId) {
          this.videoId = existingMap.videoId;
          this.mediaId = existingMap.mediaId;
          this.journalKey = this.getJournalKey(this.mediaId);
          this.debugLog("Reusing Bunny video from map", {
            projectId,
            sceneId,
            type,
            mediaId: this.mediaId,
          });
        }
      }

      if (!this.videoId || !this.mediaId) {
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

        // Retry transient failures so a backend blip doesn't abort the
        // recording. A 4xx is a real rejection, so don't retry it.
        let res = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
          try {
            res = await fetch(`${API_BASE}/bunny/videos`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${screenityToken}`,
              },
              body: JSON.stringify({
                title,
                projectId,
                type,
                linkedMediaId,
                sceneId,
                recordingSessionId: this.sessionId || null,
              }),
            });
          } catch (err) {
            // Network failure; retry.
            res = null;
            continue;
          }
          if (res.ok) break;
          const transient = res.status >= 500 || res.status === 429;
          if (!transient) break;
        }

        if (!res || !res.ok) throw new Error("Failed to create Bunny video");
        const data = await res.json();
        this.videoId = data.videoId;
        this.mediaId = data.mediaId;
        // The server now inlines the TUS upload signature in this
        // response (data.tusAuth). When present, stash it so the
        // immediate-next refreshTusAuth() can skip its GET round-trip.
        // Saves ~300-1000ms per uploader in dev. Falls back to the
        // GET path when tusAuth is missing (older server / resume).
        if (data?.tusAuth?.signature && data.tusAuth.expires && data.tusAuth.libraryId) {
          this._inlinedTusAuth = {
            signature: data.tusAuth.signature,
            expires: data.tusAuth.expires,
            libraryId: data.tusAuth.libraryId,
          };
        }
        await this.persistVideoMap({
          projectId,
          sceneId,
          type,
          videoId: this.videoId,
          mediaId: this.mediaId,
          sessionId: this.sessionId,
        });
      } else {
        await this.persistVideoMap({
          projectId,
          sceneId,
          type,
          videoId: this.videoId,
          mediaId: this.mediaId,
          sessionId: this.sessionId,
        });
      }

      this.journalKey = this.journalKey || this.getJournalKey(this.mediaId);
      try {
        await this.refreshTusAuth();
      } catch (refreshErr) {
        // 404 from tus-auth means the Bunny video is gone (orphan
        // reaper, manual cleanup) but local resume state lingered.
        // Clear it so the retry creates a fresh video instead of
        // looping on identical 404s.
        if (refreshErr?.status === 404) {
          this.debugLog("Clearing stale resume state after tus-auth 404", {
            mediaId: String(this.mediaId || ""),
            videoId: String(this.videoId || ""),
          });
          try {
            await this.clearUploadJournal();
          } catch {}
          try {
            const mapKey = this.getVideoMapKey(
              this.projectId,
              this.sceneId,
              this.metadata?.type,
            );
            if (mapKey) {
              await chrome.storage.local.remove([mapKey]);
            }
          } catch {}
        }
        throw refreshErr;
      }

      if (this.uploadUrl) {
        const serverOffset = await this.getServerOffset();
        if (Number.isFinite(serverOffset) && serverOffset >= 0) {
          this.lastServerOffset = serverOffset;
          this.offset = serverOffset;
          this.totalBytes = Math.max(this.totalBytes || 0, serverOffset);
          if (this.initializedFromResume || serverOffset > 0) {
            this.emitTelemetry("upload_resumed", {
              resumedOffset: serverOffset,
              resumeCount: this.resumeCount || 1,
            });
          }
        } else {
          this.setUploaderError("resume-offset-unverified");
          throw new Error("Could not verify server offset during resume.");
        }
      } else {
        await this.initTusUpload();
      }

      await this.persistUploadJournal({ force: true });
      this.startHeartbeat();
      this.status = "ready";
      this.readyAt = Date.now();
      this.emitTelemetry("upload_started", {
        resumed: this.initializedFromResume,
        resumeCount: this.resumeCount || 0,
      });
      this.scheduleJournalPersist({ force: true });
      return { videoId: this.videoId, mediaId: this.mediaId };
    } catch (err) {
      if (this.status !== "error") {
        this.setUploaderError("initialize-failed", err);
      } else {
        this.scheduleJournalPersist({ force: true });
      }
      throw err;
    }
  }

  async refreshTusAuth() {
    // Fast path: /api/bunny/videos inlines the TUS signature on the
    // create response. Use it once to skip a round-trip; subsequent
    // calls (expiry, journal resume) fall through to the GET.
    if (this._inlinedTusAuth) {
      const { signature, expires, libraryId } = this._inlinedTusAuth;
      this._inlinedTusAuth = null;
      // Only use it if it's still well within its validity window.
      // generateBunnyUploadSignature returns `expires` as a unix
      // seconds timestamp; require at least 30s of headroom.
      const nowSec = Math.floor(Date.now() / 1000);
      if (typeof expires === "number" && expires - nowSec > 30) {
        this.signature = signature;
        this.expires = expires;
        this.libraryId = libraryId;
        this.scheduleJournalPersist();
        return;
      }
    }

    const token = this.userToken || (await chrome.storage.local.get(["screenityToken"]).then(r => r.screenityToken));
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const url = `${API_BASE}/bunny/videos/tus-auth?videoId=${this.videoId}`;

    // Internal retry absorbs short backend blips (5xx/408/429/network) so they
    // don't burn the outer uploadChunk retry budget. Fatal auth errors
    // (400/401/403) are surfaced immediately, no recovery possible.
    const MAX_ATTEMPTS = 4;
    let lastStatus = null;
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let res = null;
      try {
        res = await fetch(url, { headers });
      } catch (err) {
        lastErr = err;
        this.emitTelemetry("upload_auth_refresh_failed", {
          attempt: attempt + 1,
          status: null,
          reason: "network",
          errMsg: String(err?.message || err),
        });
        if (attempt === MAX_ATTEMPTS - 1) break;
        await this._sleepWithJitter(500 * Math.pow(2, attempt));
        continue;
      }

      if (res.ok) {
        const { signature, expires, libraryId } = await res.json();
        this.signature = signature;
        this.expires = expires;
        this.libraryId = libraryId;
        this.scheduleJournalPersist();
        return;
      }

      lastStatus = res.status;
      const isFatalAuth = res.status === 400 || res.status === 401 || res.status === 403;
      const isTransient = res.status >= 500 || res.status === 408 || res.status === 429;
      this.emitTelemetry("upload_auth_refresh_failed", {
        attempt: attempt + 1,
        status: res.status,
        reason: isFatalAuth ? "unauthorized" : isTransient ? "network" : "other",
      });
      if (isFatalAuth || !isTransient || attempt === MAX_ATTEMPTS - 1) break;
      await this._sleepWithJitter(500 * Math.pow(2, attempt));
    }

    // Classify so the outer retry loop's /network/i regex matches
    // 5xx (transient) but not 401/403 (auth) or 404 (missing). 404
    // means the backing video is gone; retrying never recovers it.
    const classification =
      lastStatus === 400 || lastStatus === 401 || lastStatus === 403
        ? "unauthorized"
        : lastStatus === 404
          ? "missing"
          : "network";
    const err = new Error(
      `Failed to refresh TUS auth (${classification} ${lastStatus ?? "offline"})`,
    );
    err.status = lastStatus;
    err.cause = lastErr || undefined;
    throw err;
  }

  _sleepWithJitter(baseMs) {
    const jitter = Math.random() * 250;
    return new Promise((r) => setTimeout(r, baseMs + jitter));
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
        "Upload-Metadata": `filetype ${btoa(this.container || "video/webm")},title ${btoa(
          this.metadata.title,
        )}`,
      },
    });

    if (!res.ok) throw new Error("Failed to start TUS upload session");
    const location = res.headers.get("location");
    const resolved = location.startsWith("/")
      ? `https://video.bunnycdn.com${location}`
      : location;
    // Defense-in-depth: TUS Location header must stay on Bunny's host. Without
    // this, a redirect to attacker.com would receive subsequent PATCHes
    // carrying recording chunks plus the AuthorizationSignature header.
    try {
      const parsed = new URL(resolved);
      if (parsed.host !== "video.bunnycdn.com") {
        throw new Error(`Untrusted TUS location host: ${parsed.host}`);
      }
    } catch (err) {
      throw new Error(`Invalid TUS location: ${err?.message || err}`);
    }
    this.uploadUrl = resolved;

    // Persist BEFORE save-upload-meta: the local journal is the only recovery
    // path if the extension crashes before the backend records the URL.
    await this.persistUploadJournal({ force: true });

    if (this.userToken) {
      fetch(`${API_BASE}/bunny/videos/save-upload-meta`, {
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
          projectId: this.projectId,
          sceneId: this.sceneId || null,
          recordingSessionId: this.sessionId || null,
          type: this.metadata?.type || null,
        }),
      }).catch((err) =>
        this.debugLog("save-upload-meta failed (non-blocking)", { error: String(err) }),
      );
    } else {
      this.debugLog("Skipping save-upload-meta because user token is missing", {
        mediaId: this.mediaId,
        uploadUrl: this.uploadUrl,
        signature: this.signature,
        expires: this.expires,
      });
    }
  }

  async write(chunk) {
    if (this.isFinalizing) {
      this.bytesLostAfterFinalize += chunk?.size || 0;
      this.setUploaderError("write-after-finalize");
      throw new Error("Cannot write during finalization");
    }
    if (this.isPaused) throw new Error("Uploader paused");
    if (!this.uploadUrl) throw new Error("Uploader not initialized");

    if (this.status === "error") {
      throw new Error(`Uploader in error state: ${this.error}`);
    }

    await this.checkAuthExpiration();
    this.status = "uploading";
    if (!this.hasEmittedClientStarted) {
      this.hasEmittedClientStarted = true;
      this.emitTelemetry("upload_client_started");
    }

    for (let i = 0; i < chunk.size; i += this.CHUNK_SIZE) {
      const subChunk = chunk.slice(i, i + this.CHUNK_SIZE);
      this.chunkQueue.push(subChunk);
      this.queuedBytes += subChunk.size;
      this.totalBytes += subChunk.size;
    }
    this.lastChunkQueuedAt = Date.now();
    this.scheduleJournalPersist();

    if (!this.isProcessingQueue) {
      this.queueProcessingPromise = this.processQueue();
    }

    if (this.queuedBytes > 10 * 1024 * 1024) {
      await this.waitForPendingUploads();
    }

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
    let data = new Uint8Array(await chunk.arrayBuffer());
    const chunkStartOffset = this.offset;
    // One-shot 401 refresh per chunk. Re-armed each chunk so a token
    // expiring across many chunks keeps recovering.
    let didAuth401Refresh = false;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      // Hoisted so the catch can read signal.reason (wake-jump/stall-recovery/
      // upload-timeout) for telemetry; in-try it would be out of scope.
      let controller = null;
      try {
        // AuthorizationSignature has ~20min TTL; refresh before every PATCH.
        await this.checkAuthExpiration();

        const currentOffset = this.offset;

        controller = new AbortController();
        // Exposed so the heartbeat can abort a stalled PATCH.
        this.currentPatchAbort = controller;
        const timeout = setTimeout(
          () => controller.abort("upload-timeout"),
          this.UPLOAD_TIMEOUT_MS,
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
        this.currentPatchAbort = null;

        if (res.ok || res.status === 204) {
          const serverOffsetHeader = res.headers.get("Upload-Offset");
          let nextOffset;
          if (serverOffsetHeader) {
            const parsed = parseInt(serverOffsetHeader, 10);
            // Validate the parsed offset. parseInt("0x100", 10) returns 0,
            // which would silently reset the upload. Require a finite value
            // at least equal to what was sent.
            const expectedMin = currentOffset + data.length;
            if (
              !Number.isFinite(parsed) ||
              parsed < currentOffset ||
              parsed > expectedMin
            ) {
              this.setUploaderError("invalid-server-offset", {
                serverOffsetHeader,
                parsed,
                currentOffset,
                expectedMin,
              });
              throw new Error(
                `Invalid Upload-Offset from server: "${serverOffsetHeader}"`,
              );
            }
            nextOffset = parsed;
          } else {
            nextOffset = currentOffset + data.length;
          }
          this.offset = nextOffset;
          this.lastServerOffset = this.offset;

          this.recordProgress(data.length);
          return;
        } else {
          const errorText = await res.text();

          // 401 mid-flight: token expired between checkAuthExpiration
          // and the server's check. Refresh once and retry; a second
          // 401 falls through as non-transient.
          if (res.status === 401 && !didAuth401Refresh) {
            didAuth401Refresh = true;
            console.warn(
              "[bunnyTusUploader] 401 mid-PATCH; refreshing TUS auth + retrying once",
            );
            this.emitTelemetry("upload_auth_refresh_after_401", {
              attempt,
            });
            try {
              await this.refreshTusAuth();
              continue;
            } catch (refreshErr) {
              console.error(
                "[bunnyTusUploader] refreshTusAuth after 401 failed:",
                refreshErr,
              );
              // Fall through to the generic error throw.
            }
          }

          // Session invalidated; fatal so callers can fall back.
          if (res.status === 404) {
            this.status = "error";
            this.error = "tus-session-missing";
            this.stalled = true;
            this.lastErrorAt = Date.now();
            this.lastErrorCode = "tus-session-missing";
            this.emitTelemetry("upload_error", {
              errorCode: "tus-session-missing",
              httpStatus: 404,
            });
            this.scheduleJournalPersist({ force: true });
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

          if (
            res.status === 409 ||
            errorText.toLowerCase().includes("offset")
          ) {
            console.warn(
              `⚠️ Offset conflict detected (status ${res.status}), fetching current offset from server`,
            );

            // Query server offset via HEAD. If it fails or returns garbage,
            // mark fatal: retrying with a stale offset loops on 409.
            try {
              const serverOffset = await this.getServerOffset();
              if (Number.isFinite(serverOffset) && serverOffset >= 0) {
                // Server offset must not be lower than what was sent;
                // if it is, server state is corrupted. Fail loudly.
                const priorOffset = this.offset;
                if (serverOffset < priorOffset - data.length) {
                  this.setUploaderError("server-offset-regressed", {
                    serverOffset,
                    priorOffset,
                  });
                  throw new Error(
                    `Server offset regressed (${serverOffset} < ${priorOffset})`,
                  );
                }
                this.lastServerOffset = serverOffset;
                this.offset = serverOffset;
                this.emitTelemetry("upload_resumed", {
                  resumedOffset: serverOffset,
                  reason: "offset-conflict",
                });
                this.scheduleJournalPersist({ force: true });

                const chunkEnd = chunkStartOffset + data.length;
                if (serverOffset >= chunkEnd) {
                  this.emitTelemetry("upload_chunk_skipped_after_resync", {
                    chunkStartOffset,
                    chunkLength: data.length,
                    serverOffset,
                  });
                  this.recordProgress(0);
                  return;
                }
                if (serverOffset > chunkStartOffset) {
                  const trimmedBytes = serverOffset - chunkStartOffset;
                  data = data.subarray(trimmedBytes);
                  this.emitTelemetry("upload_chunk_trimmed_after_resync", {
                    chunkStartOffset,
                    chunkLength: data.length + trimmedBytes,
                    trimmedBytes,
                    serverOffset,
                  });
                }

                continue;
              }
              // serverOffset null/NaN: HEAD response unparseable.
              this.setUploaderError("offset-conflict-head-unparseable", {
                priorOffset: this.offset,
              });
              throw new Error(
                "409 offset conflict but HEAD returned unparseable offset",
              );
            } catch (headErr) {
              console.error(
                "Failed to fetch server offset during 409 recovery:",
                headErr,
              );
              this.setUploaderError("offset-conflict-head-failed", headErr);
              throw headErr;
            }
          }

          throw new Error(`Upload failed (${res.status}): ${errorText}`);
        }
      } catch (err) {
        // err.name collapses every abort to AbortError; signal.reason keeps the
        // real trigger (wake-jump/stall-recovery/upload-timeout) for telemetry.
        const abortReason =
          controller?.signal?.aborted && typeof controller.signal.reason === "string"
            ? controller.signal.reason
            : null;
        this.currentPatchAbort = null;
        // Transient errors (network/timeout/stall-abort/5xx/408/429) retry forever with capped backoff.
        const isExplicitAbort =
          this.status === "aborted" || this.isPaused === true;
        if (isExplicitAbort) {
          throw err;
        }
        const msg = String(err?.message || "");
        const status = typeof err?.status === "number" ? err.status : null;
        const isTransient =
          err?.name === "AbortError" ||
          err?.name === "TypeError" ||
          (status !== null && (status >= 500 || status === 408 || status === 429)) ||
          /Upload failed \((?:5\d\d|408|429)\b/.test(msg) ||
          /network|Failed to fetch|timeout/i.test(msg);
        if (err?.name === "AbortError") {
          console.warn(
            "⚠️ Upload chunk aborted",
            abortReason ? `(${abortReason})` : "(reason unknown)",
          );
        }
        if (!isTransient && attempt === this.MAX_RETRIES) {
          console.error(
            `❌ Non-transient failure after ${this.MAX_RETRIES} retries:`,
            err,
          );
          this.setUploaderError("chunk-upload-retries-exhausted", err, {
            abortReason,
          });
          throw err;
        }
        const attemptLabel = isTransient
          ? `transient retry #${attempt + 1}`
          : `attempt ${attempt + 1}/${this.MAX_RETRIES + 1}`;
        console.warn(`⚠️ Upload ${attemptLabel} failed, retrying...`, err.message);
        // Wait for online event before retrying so we don't burn retries
        // during the offline window. 5min cap ensures permanently
        // disconnected machines still surface a stall.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          this.emitTelemetry("upload_offline_wait", {
            attempt,
            errorCode: msg.slice(0, 100),
          });
          await new Promise((resolve) => {
            const ONLINE_WAIT_CAP_MS = 5 * 60 * 1000;
            const onOnline = () => {
              cleanup();
              resolve();
            };
            const cap = setTimeout(() => {
              cleanup();
              resolve();
            }, ONLINE_WAIT_CAP_MS);
            const cleanup = () => {
              clearTimeout(cap);
              try {
                window.removeEventListener("online", onOnline);
              } catch {}
            };
            try {
              window.addEventListener("online", onOnline, { once: true });
            } catch {
              // Worker context: fall through to backoff.
              cleanup();
              resolve();
            }
          });
          if (typeof navigator !== "undefined" && navigator.onLine) {
            this.emitTelemetry("upload_back_online", { attempt });
          }
        }
        const jitter = Math.random() * 300;
        // 60s cap so offline→online reconnects retry within a minute.
        const baseDelay = Math.min(
          this.RETRY_DELAY * Math.pow(2, Math.min(attempt, 7)),
          60_000,
        );
        await new Promise((r) => setTimeout(r, baseDelay + jitter));
        // Never let transient errors trip the permanent-failure branch.
        if (isTransient && attempt >= this.MAX_RETRIES) {
          attempt = this.MAX_RETRIES - 1;
        }
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

        try {
          await this.uploadChunk(chunk);
        } catch (err) {
          console.error("❌ Chunk upload failed in queue:", err);

          this.chunkQueue.unshift(chunk);
          this.queuedBytes += chunk.size;

          // Don't clobber a non-recoverable code that uploadChunk already
          // set (e.g. "offset-conflict-head-failed", "invalid-server-offset"),
          // otherwise resume() sees the recoverable "queue-upload-failed"
          // and loops forever.
          const nonRecoverableInner =
            this.lastErrorCode &&
            this.lastErrorCode !== "queue-upload-failed" &&
            this.lastErrorCode !== "chunk-upload-retries-exhausted";
          if (!nonRecoverableInner) {
            this.setUploaderError("queue-upload-failed", err);
          }

          break;
        }
      }
    } finally {
      this.isProcessingQueue = false;
      this.queueProcessingPromise = null;
    }
  }

  async waitForPendingUploads() {
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
      await new Promise((r) => setTimeout(r, 100));
    }

    if (wasPaused) {
      this.isPaused = true;
    }
  }

  async finalize() {
    if (this.isFinalizing) throw new Error("Already finalizing");
    this.isFinalizing = true;
    this.status = "finalizing";
    this.finalizeStartedAt = Date.now();
    this.emitTelemetry("upload_finalize_started");
    this.scheduleJournalPersist({ force: true });
    try {
      await this.waitForPendingUploads();

      if (this.bytesLostAfterFinalize > 0) {
        this.status = "error";
        this.error = `bytes-lost-during-finalize=${this.bytesLostAfterFinalize}`;
        this.lastErrorAt = Date.now();
        this.lastErrorCode = "finalize-bytes-lost";
        this.emitTelemetry("upload_error", {
          errorCode: "finalize-bytes-lost",
          bytesLost: this.bytesLostAfterFinalize,
          totalBytes: this.totalBytes,
        });
        this.scheduleJournalPersist({ force: true });
        throw new Error(
          `Finalize blocked: ${this.bytesLostAfterFinalize} bytes lost after finalize started.`,
        );
      }

      await this.checkAuthExpiration();

      // Re-validate offset to avoid partial finalization.
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
            10,
          );
          this.offset = serverOffset;
        }
      } catch (err) {
        console.warn("⚠️ Failed HEAD before finalize:", err);
      }

      // Don't finalize into a ghost upload if the server is short.
      if (serverOffset === null) {
        this.setUploaderError("finalize-offset-unverified");
        throw new Error("Finalize failed: could not verify server offset.");
      }

      if (serverOffset === 0) {
        this.status = "error";
        this.error = "server-offset-0";
        this.lastErrorAt = Date.now();
        this.lastErrorCode = "server-offset-0";
        this.emitTelemetry("upload_error", {
          errorCode: "server-offset-0",
        });
        this.scheduleJournalPersist({ force: true });
        throw new Error("Finalize failed: server has 0 bytes.");
      }

      if (serverOffset < this.totalBytes) {
        this.status = "error";
        this.error = `incomplete-upload server=${serverOffset} expected=${this.totalBytes}`;
        this.lastErrorAt = Date.now();
        this.lastErrorCode = "finalize-incomplete-upload";
        this.emitTelemetry("upload_error", {
          errorCode: "finalize-incomplete-upload",
          serverOffset,
          expectedBytes: this.totalBytes,
        });
        this.scheduleJournalPersist({ force: true });
        throw new Error(
          `Finalize blocked: upload incomplete (server ${serverOffset} / expected ${this.totalBytes}).`,
        );
      }

      if (serverOffset > this.totalBytes) {
        this.status = "error";
        this.error = `invalid-length server=${serverOffset} expected=${this.totalBytes}`;
        this.lastErrorAt = Date.now();
        this.lastErrorCode = "finalize-invalid-length";
        this.emitTelemetry("upload_error", {
          errorCode: "finalize-invalid-length",
          serverOffset,
          expectedBytes: this.totalBytes,
        });
        this.scheduleJournalPersist({ force: true });
        throw new Error(
          `Finalize blocked: serverOffset (${serverOffset}) exceeds expected totalBytes (${this.totalBytes}).`,
        );
      }

      // Complete the tus upload by declaring final length.
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

      // 410 = Bunny reports the upload is already finalized. Treat as
      // success; server is the truth, retrying would just loop.
      const alreadyFinalized = res.status === 410;
      if (!res.ok && res.status !== 204 && !alreadyFinalized) {
        this.setUploaderError("finalize-patch-failed");
        throw new Error("Finalization failed");
      }
      this.status = "completed";
      this.finalizedAt = Date.now();
      this.emitTelemetry("upload_finalize_completed", {
        finalizedBytes: this.totalBytes,
        alreadyFinalized: alreadyFinalized || undefined,
      });
      this.emitTelemetry("upload_complete_client", {
        finalizedBytes: this.totalBytes,
      });
      this.stopHeartbeat();
      await this.clearUploadJournal();
      this.notifyStateChange("finalize-completed");
    } catch (err) {
      // Reset the lock so retries can attempt finalize again. Without
      // this, every retry immediately throws "Already finalizing".
      this.isFinalizing = false;
      console.warn("[BunnyTusUploader] finalize failed, isFinalizing reset for retry", {
        trackType: this.trackType,
        error: err?.message || String(err),
        offset: this.offset,
        totalBytes: this.totalBytes,
      });
      throw err;
    }
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
    if (this.status !== "completed" && this.status !== "error") {
      this.status = "paused";
    }
    this.scheduleJournalPersist();
  }

  resume() {
    // Excludes codes that need re-init (tus-session-missing, finalize-*,
    // server-offset-0); those don't recover from a plain resume.
    const RECOVERABLE_ERROR_CODES = new Set([
      "queue-upload-failed",
      "chunk-upload-retries-exhausted",
    ]);
    const canRecoverFromError =
      this.status === "error" &&
      RECOVERABLE_ERROR_CODES.has(this.lastErrorCode);
    if (!this.isPaused && !canRecoverFromError) return;

    if (canRecoverFromError) {
      this.error = null;
      this.stalled = false;
      // Restart heartbeat (stopped by setUploaderError); idempotent.
      this.startHeartbeat();
    }
    this.isPaused = false;
    // Don't mask a non-recoverable error when isPaused + status="error" coexist.
    if (
      this.status !== "completed" &&
      this.status !== "finalizing" &&
      (this.status !== "error" || canRecoverFromError)
    ) {
      this.status = "uploading";
    }
    if (!this.isProcessingQueue && this.chunkQueue.length > 0) {
      this.queueProcessingPromise = this.processQueue();
    }
    this.emitTelemetry("upload_resumed", {
      reason: canRecoverFromError ? "error-recovery" : "client-resume",
    });
    this.scheduleJournalPersist();
  }

  async abort(reason = null) {
    this.pause();
    this.status = "aborted";
    this.uploadUrl = null;
    this.chunkQueue = [];
    this.queuedBytes = 0;
    this.totalBytes = 0;
    this.pendingUploads = [];
    this.stopHeartbeat();
    this.emitTelemetry("upload_cancelled", {
      reason: reason || "uploader-abort",
    });
    if (this.journalPersistTimer) {
      clearTimeout(this.journalPersistTimer);
      this.journalPersistTimer = null;
    }
    await this.clearUploadJournal();
    this.notifyStateChange("aborted");
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.lastProgressAt = Date.now();
    this.lastHeartbeatTickAt = Date.now();
    this.stalled = false;
    this.stallRecoveryInFlight = false;
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      // Skip wake-burst ticks: an 8hr sleep stacks ~2880 missed ticks and
      // each would run stall recovery, flooding the network on wake.
      const sinceLastTick = now - (this.lastHeartbeatTickAt || 0);
      this.lastHeartbeatTickAt = now;
      if (sinceLastTick < Math.floor(this.HEARTBEAT_INTERVAL_MS * 0.5)) {
        return;
      }
      // Wake-jump: if tick-to-tick gap is dramatically larger than
      // expected, abort any in-flight PATCH hanging on a dead connection.
      // Without this, PATCH stays pending until UPLOAD_TIMEOUT_MS, delaying
      // recovery.
      if (
        sinceLastTick >
        Math.max(this.HEARTBEAT_INTERVAL_MS * 6, 60_000)
      ) {
        try {
          this.emitTelemetry("upload_wake_detected", {
            sinceLastTickMs: sinceLastTick,
          });
        } catch {}
        if (this.currentPatchAbort) {
          try {
            this.currentPatchAbort.abort("wake-jump");
          } catch {}
          this.currentPatchAbort = null;
        }
      }

      const diff = now - this.lastProgressAt;
      if (diff > this.HEARTBEAT_LAG_MS) {
        this.stalled = true;
        this.emitTelemetry("upload_stalled", {
          stallMs: diff,
        });
        this.scheduleJournalPersist({ force: true });
        if (typeof this.onStall === "function") {
          this.onStall({
            mediaId: this.mediaId,
            videoId: this.videoId,
            offset: this.offset,
            diff,
          });
        }
        this.attemptStallRecovery(diff).catch((err) => {
          console.warn("[bunnyTusUploader] stall recovery failed:", err);
        });
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  async attemptStallRecovery(stallMs) {
    if (this.stallRecoveryInFlight) return;
    this.stallRecoveryInFlight = true;
    try {
      if (this.currentPatchAbort) {
        try {
          this.currentPatchAbort.abort("stall-recovery");
        } catch {}
        this.currentPatchAbort = null;
      }
      // Resync via HEAD so a partially-applied PATCH doesn't dup bytes.
      try {
        const res = await fetch(this.uploadUrl, {
          method: "HEAD",
          headers: {
            "Tus-Resumable": "1.0.0",
            AuthorizationSignature: this.signature,
            AuthorizationExpire: String(this.expires),
            LibraryId: String(this.libraryId),
            VideoId: this.videoId,
          },
        });
        if (res.ok || res.status === 204) {
          const serverOffsetHeader = res.headers.get("Upload-Offset");
          if (serverOffsetHeader != null) {
            const serverOffset = parseInt(serverOffsetHeader, 10);
            if (Number.isFinite(serverOffset)) {
              this.offset = serverOffset;
              this.lastServerOffset = serverOffset;
              this.emitTelemetry("upload_stall_recovered", {
                stallMs,
                serverOffset,
              });
              this.maybeAutoFinalize();
            }
          }
        }
      } catch (err) {
        console.warn("[bunnyTusUploader] HEAD offset resync failed:", err);
      }
    } finally {
      this.stallRecoveryInFlight = false;
    }
  }

  maybeAutoFinalize() {
    if (this.isFinalizing) return;
    if (this.status === "completed" || this.status === "aborted") return;
    if (this.totalBytes <= 0) return;
    // Trigger when offset >= totalBytes (used to be strict equality,
    // which deadlocked when 409 resync set offset past totalBytes from
    // a prior session's unjournaled bytes).
    if (this.offset < this.totalBytes) return;
    if (this.chunkQueue.length > 0) return;
    if (this.pendingUploads.length > 0) return;
    const sinceLastWrite = Date.now() - (this.lastChunkQueuedAt || 0);
    if (this.lastChunkQueuedAt && sinceLastWrite < this.HEARTBEAT_LAG_MS) return;
    this.emitTelemetry("upload_auto_finalize_triggered", {
      sinceLastWriteMs: sinceLastWrite,
      offset: this.offset,
      totalBytes: this.totalBytes,
    });
    this.finalize().catch((err) => {
      console.warn("[bunnyTusUploader] auto-finalize failed:", err?.message || err);
    });
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  recordProgress(bytes) {
    this.lastProgressAt = Date.now();
    this.stalled = false;
    if (!this.firstByteAt) {
      this.firstByteAt = this.lastProgressAt;
    }
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
    if (!this.hasEmittedFirstByte) {
      this.hasEmittedFirstByte = true;
      this.emitTelemetry("upload_first_byte", {
        bytes,
      });
    }
    if (
      this.lastProgressEventAt === 0 ||
      this.lastProgressAt - this.lastProgressEventAt >=
        this.PROGRESS_EVENT_INTERVAL_MS
    ) {
      this.lastProgressEventAt = this.lastProgressAt;
      this.emitTelemetry("upload_progress", {
        bytes,
      });
    }
    this.scheduleJournalPersist();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BunnyTusUploader;
} else {
  window.BunnyTusUploader = BunnyTusUploader;
}
