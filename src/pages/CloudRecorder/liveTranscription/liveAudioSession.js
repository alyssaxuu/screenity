// Segment sizing; must match what the server expects.
const SEGMENT_CHUNKS = 15
const MIN_CHUNKS_TO_START = 60
const devLog = () => {}

// Sidecar to the mic recorder: sends its 2 s chunks in 30 s segments so
// transcription can start before the take ends. The whole-file mic flow stays
// the source of truth, so nothing here may ever hurt the recording: public
// methods catch, and any problem ends in `degraded` (server falls back to the file).

// States: buffering -> creating -> streaming -> degraded | sealed | cancelled
const BACKOFF_MS = [1000, 3000, 8000, 20000]
const ATTEMPTS = BACKOFF_MS.length + 1
// About 7 MB at 15 KB/s of Opus. Past this the connection is not keeping up.
const MAX_PENDING_SEGMENTS = 16
// Browser online but server unwell: 'online' never fires.
const OFFLINE_RECHECK_MS = 60000
const DRAIN_TIMEOUT_MS = 120000
// A create that gets no answer would hold the session in `creating` until the
// buffer cap; each attempt gets this long before it counts as failed.
const CREATE_TIMEOUT_MS = 15000

// Rejected for the request itself: retrying the same bytes cannot change it.
const TERMINAL_STATUS = new Set([400, 401, 403, 404, 409, 410, 413])
// Session closed server-side: nothing to seal.
const SESSION_CLOSED_STATUS = new Set([404, 409, 410])

const hex = (buf) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')

export class LiveAudioSession {
  constructor(opts = {}) {
    this.videoId = opts.videoId
    this.sceneId = opts.sceneId
    this.mime = opts.mime
    this.recorderSessionId = opts.recorderSessionId || null
    this._baseUrl = (opts.baseUrl || '').replace(/\/+$/, '')
    this._getToken = opts.getToken || null
    this._fetch = opts.fetch || null
    this._crypto = opts.crypto || null
    this._timers = { set: opts.setTimeout || null, clear: opts.clearTimeout || null }
    this._onlineTarget =
      opts.onlineTarget ?? (typeof window !== 'undefined' ? window : null)
    this._drainTimeoutMs = opts.drainTimeoutMs ?? DRAIN_TIMEOUT_MS
    this._createTimeoutMs = opts.createTimeoutMs ?? CREATE_TIMEOUT_MS
    this._log = opts.devLog || devLog

    this._state = 'buffering'
    this._id = null
    this._degradedReason = null
    this._serverClosed = false

    this._current = []
    this._chunkCount = 0
    this._cutChunks = 0
    this._totalBytes = 0
    this._nextSeq = 0
    this._queue = [] // cut but not yet acknowledged
    this._uploading = false
    this._idleWaiters = []
    this._abort = null
    this._waitTimer = null
    this._waitResolve = null
    this._stopPromise = null
    this._createPromise = null
    this._onlineHandler = null
  }

  get id() {
    return this._id
  }

  get state() {
    return this._state
  }

  push(blob) {
    try {
      if (!blob || blob.size === 0) return
      if (this._stopPromise || this._state === 'cancelled' || this._state === 'sealed') return
      this._chunkCount += 1
      this._totalBytes += blob.size
      if (this._state === 'degraded') return
      this._current.push(blob)
      if (this._current.length >= SEGMENT_CHUNKS) this._cut()
      if (this._state === 'buffering' && this._chunkCount >= MIN_CHUNKS_TO_START) {
        this._begin()
      }
    } catch (err) {
      this._degrade('push-error', err)
    }
  }

  /**
   * Flush, drain, seal. Idempotent: every call returns the same promise.
   * Resolves { liveSessionId } (null when live never ran or the server closed
   * the session). The work outlives the caller's wait, so a late seal still lands.
   */
  stop() {
    if (!this._stopPromise) {
      this._stopPromise = this._stop().catch((err) => {
        this._log('[live-audio] stop failed:', err)
        return { liveSessionId: null }
      })
    }
    return this._stopPromise
  }

  cancel() {
    try {
      if (this._state === 'cancelled') return
      const wasCreated = !!this._id
      this._state = 'cancelled'
      this._shutdown()
      this._releaseIdleWaiters()
      if (wasCreated) this._sendCancel(this._id)
      else if (this._createPromise) {
        // The create request may still land: cancel whatever id it returns.
        this._createPromise.then((id) => id && this._sendCancel(id)).catch(() => {})
      }
    } catch (err) {
      this._log('[live-audio] cancel failed:', err)
    }
  }

  _cut() {
    const n = this._current.length
    if (n === 0) return
    const seg = {
      seq: this._nextSeq++,
      chunkFrom: this._cutChunks,
      chunkTo: this._cutChunks + n - 1,
      blob: new Blob(this._current),
      sha256: null,
    }
    this._cutChunks += n
    this._current = []
    this._queue.push(seg)
    if (this._queue.length > MAX_PENDING_SEGMENTS) {
      this._degrade('buffer-cap')
      return
    }
    this._pump()
  }

  _begin() {
    this._state = 'creating'
    this._createPromise = this._create()
      .then((id) => {
        if (this._state === 'cancelled') return id
        if (this._state !== 'creating') {
          // Degraded while the create was in flight: it must not come back to
          // streaming with its first segments missing.
          if (id) this._sendCancel(id)
          return null
        }
        if (!id) {
          this._degrade(this._degradedReason || 'create-failed')
          return null
        }
        this._id = id
        this._state = 'streaming'
        this._pump()
        return id
      })
      .catch((err) => {
        this._degrade('create-error', err)
        return null
      })
  }

  async _create() {
    for (let attempt = 1; attempt <= 3; attempt++) {
      // Cancelled, or degraded while this was still retrying (a hung create
      // reaches the buffer cap): do not try again.
      if (this._state !== 'creating') return null
      let res
      try {
        res = await this._request('/live-audio/sessions/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId: this.videoId,
            sceneId: this.sceneId,
            mime: this.mime,
            recorderSessionId: this.recorderSessionId,
          }),
        }, this._createTimeoutMs)
      } catch {
        res = null
      }
      if (res?.ok) {
        const body = await res.json().catch(() => null)
        if (body?.live && typeof body.liveSessionId === 'string') return body.liveSessionId
        // live:false is the server declining (capacity, mime): not a failure.
        this._degradedReason = `declined-${body?.reason || 'unknown'}`
        return null
      }
      if (res && TERMINAL_STATUS.has(res.status)) {
        this._degradedReason = `create-${res.status}`
        return null
      }
      if (attempt < 3) await this._sleep(BACKOFF_MS[attempt - 1])
    }
    this._degradedReason = 'create-unreachable'
    return null
  }

  _pump() {
    if (this._state !== 'streaming' || this._uploading || this._queue.length === 0) {
      this._maybeIdle()
      return
    }
    this._uploading = true
    this._uploadHead()
      .catch((err) => this._degrade('upload-error', err))
      .finally(() => {
        this._uploading = false
        this._pump()
      })
  }

  async _uploadHead() {
    const seg = this._queue[0]
    if (!seg.sha256) seg.sha256 = await this._sha256(seg.blob)
    for (let attempt = 1; ; attempt++) {
      if (this._state !== 'streaming') return
      let status = 0
      try {
        const res = await this._request(
          `/live-audio/segment/?session=${encodeURIComponent(this._id)}&seq=${seg.seq}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/octet-stream',
              'x-live-sha256': seg.sha256,
              'x-live-chunks': `${seg.chunkFrom}-${seg.chunkTo}`,
            },
            body: seg.blob,
          }
        )
        status = res.status
        if (res.ok) {
          this._queue.shift()
          return
        }
      } catch {
        status = 0
      }
      if (this._state !== 'streaming') return
      if (TERMINAL_STATUS.has(status)) {
        if (SESSION_CLOSED_STATUS.has(status)) this._serverClosed = true
        this._degrade(`segment-${status}`)
        return
      }
      if (attempt % ATTEMPTS === 0) await this._waitForOnline()
      else await this._sleep(BACKOFF_MS[(attempt - 1) % BACKOFF_MS.length])
    }
  }

  async _authHeaders() {
    const token = this._getToken ? await this._getToken() : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async _request(path, init, timeoutMs) {
    const f = this._fetch || globalThis.fetch
    this._abort = this._abort || new AbortController()
    const headers = { ...(init.headers || {}), ...(await this._authHeaders()) }
    const url = this._baseUrl + path
    if (!timeoutMs) return f(url, { ...init, headers, signal: this._abort.signal })
    return this._withTimeout(timeoutMs, (signal) => f(url, { ...init, headers, signal }))
  }

  // Aborts one request after `ms`, or with the session. The timer stops once
  // headers arrive, so a body being read is not cut short.
  async _withTimeout(ms, run) {
    const local = new AbortController()
    const session = this._abort.signal
    const onAbort = () => local.abort()
    session.addEventListener('abort', onAbort, { once: true })
    const t = this._setTimer(onAbort, ms)
    try {
      return await run(local.signal)
    } finally {
      this._clearTimer(t)
      session.removeEventListener('abort', onAbort)
    }
  }

  async _sha256(blob) {
    const subtle = (this._crypto || globalThis.crypto).subtle
    return hex(await subtle.digest('SHA-256', await blob.arrayBuffer()))
  }

  async _stop() {
    if (this._state === 'cancelled') return { liveSessionId: null }
    if (this._state === 'buffering') {
      // Under MIN_CHUNKS_TO_START: nothing was sent.
      this._state = 'sealed'
      this._shutdown()
      return { liveSessionId: null }
    }
    if (this._state !== 'degraded') this._cut()
    if (this._state === 'creating') await this._createPromise
    if (this._state === 'streaming') await this._drain()
    if (this._state === 'cancelled' || this._serverClosed || !this._id) {
      this._shutdown()
      return { liveSessionId: null }
    }
    const degraded = this._state === 'degraded' || this._queue.length > 0
    const reason = degraded ? this._degradedReason || 'incomplete' : null
    if (this._state === 'streaming' && degraded) this._state = 'degraded'
    await this._seal(degraded, reason)
    const id = this._id
    if (!this._serverClosed) this._state = this._state === 'degraded' ? 'degraded' : 'sealed'
    this._shutdown()
    return { liveSessionId: this._serverClosed ? null : id }
  }

  _drain() {
    return new Promise((resolve) => {
      const done = () => resolve()
      this._idleWaiters.push(done)
      const t = this._setTimer(() => resolve(), this._drainTimeoutMs)
      this._idleWaiters.push(() => this._clearTimer(t))
      this._maybeIdle()
    })
  }

  _maybeIdle() {
    const settled =
      this._state !== 'streaming' || (this._queue.length === 0 && !this._uploading)
    if (settled) this._releaseIdleWaiters()
  }

  _releaseIdleWaiters() {
    const waiters = this._idleWaiters
    this._idleWaiters = []
    waiters.forEach((w) => w())
  }

  async _seal(degraded, degradedReason) {
    const body = JSON.stringify({
      lastSeq: this._nextSeq - 1,
      totalBytes: this._totalBytes,
      chunkCount: this._chunkCount,
      degraded,
      ...(degradedReason ? { degradedReason } : {}),
    })
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await this._request(`/live-audio/${encodeURIComponent(this._id)}/seal/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        if (res.ok) return true
        if (SESSION_CLOSED_STATUS.has(res.status)) {
          this._serverClosed = true
          return false
        }
        if (TERMINAL_STATUS.has(res.status)) return false
      } catch {}
      if (this._state === 'cancelled') return false
      if (attempt < 3) await this._sleep(BACKOFF_MS[attempt - 1])
    }
    return false
  }

  _degrade(reason, err) {
    if (this._state === 'degraded' || this._state === 'cancelled' || this._state === 'sealed') return
    this._log(`[live-audio] degraded (${reason})`, err || '')
    this._state = 'degraded'
    this._degradedReason = reason
    this._queue = []
    this._current = []
    this._abortInFlight()
    this._clearWait()
    this._releaseIdleWaiters()
  }

  _sendCancel(id) {
    try {
      const f = this._fetch || globalThis.fetch
      Promise.resolve(this._authHeaders())
        .then((auth) =>
          f(`${this._baseUrl}/live-audio/${encodeURIComponent(id)}/cancel/`, {
            method: 'POST',
            headers: auth,
            keepalive: true,
          })
        )
        .catch(() => {})
    } catch {
      // best effort: the sweeper deletes an abandoned session
    }
  }

  _abortInFlight() {
    try {
      this._abort?.abort()
    } catch {}
    this._abort = null
  }

  _shutdown() {
    this._queue = []
    this._current = []
    this._abortInFlight()
    this._clearWait()
  }

  _setTimer(fn, ms) {
    return (this._timers.set || globalThis.setTimeout)(fn, ms)
  }

  _clearTimer(t) {
    ;(this._timers.clear || globalThis.clearTimeout)(t)
  }

  _sleep(ms) {
    return new Promise((resolve) => {
      this._waitResolve = resolve
      this._waitTimer = this._setTimer(resolve, ms)
    })
  }

  _waitForOnline() {
    return new Promise((resolve) => {
      const target = this._onlineTarget
      const finish = () => {
        this._clearWait()
        resolve()
      }
      this._waitResolve = resolve
      this._waitTimer = this._setTimer(finish, OFFLINE_RECHECK_MS)
      if (target?.addEventListener) {
        this._onlineHandler = finish
        target.addEventListener('online', finish, { once: true })
      }
    })
  }

  // Also wakes the upload loop, which then sees the state changed and ends.
  _clearWait() {
    if (this._waitTimer) this._clearTimer(this._waitTimer)
    this._waitTimer = null
    const wake = this._waitResolve
    this._waitResolve = null
    wake?.()
    if (this._onlineHandler && this._onlineTarget?.removeEventListener) {
      this._onlineTarget.removeEventListener('online', this._onlineHandler)
    }
    this._onlineHandler = null
  }
}
