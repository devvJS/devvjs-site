import { Buffer } from 'node:buffer'

// In-memory cache for Express-style handlers (the api/*.js functions).
//
// One cached() wrapper holds one entry, so mounting a wrapper per route keys
// the cache by route (the query string is ignored on purpose: the handlers
// don't read it, and it can't be used to bypass the cache and burn the GitHub
// rate limit).
//
// - Only a 200 is stored. A stored 200 is replayed with X-Cache: HIT while
//   now() - storedAt < ttlMs.
// - On a miss the handler runs once; concurrent misses share that one run.
// - If the run doesn't produce a 200 and a stale 200 exists, the stale copy is
//   served with X-Cache: STALE. Otherwise the run's own response is sent.

const DEFAULT_TIMEOUT_MS = 30_000

export function cached(handler, { ttlMs, now = () => Date.now(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof handler !== 'function') throw new TypeError('cached(): handler must be a function')
  if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new TypeError('cached(): ttlMs must be a non-negative number')

  let entry = null // { storedAt, result }
  let inflight = null // Promise<result>

  function refresh(req) {
    if (!inflight) {
      inflight = capture(handler, req, timeoutMs)
        .then((result) => {
          if (result.status === 200) entry = { storedAt: now(), result }
          return result
        })
        .finally(() => {
          inflight = null
        })
    }
    return inflight
  }

  return async function cachedHandler(req, res) {
    if (entry && now() - entry.storedAt < ttlMs) {
      replay(res, entry.result, 'HIT')
      return
    }
    const result = await refresh(req)
    if (result.status !== 200 && entry) replay(res, entry.result, 'STALE')
    else replay(res, result, 'MISS')
  }
}

function replay(res, result, tag) {
  for (const [name, value] of result.headers) res.setHeader(name, value)
  res.setHeader('X-Cache', tag)
  res.status(result.status).send(result.body)
}

const JSON_TYPE = 'application/json; charset=utf-8'

// Runs the handler against a response recorder and resolves (never rejects)
// with { status, headers: [[name, value]], body: Buffer }.
function capture(handler, req, timeoutMs) {
  return new Promise((resolve) => {
    const headers = new Map() // lower-cased name -> [name, value]
    let settled = false
    let timer = null

    const settle = (status, body) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      headers.delete('content-length')
      resolve({ status, headers: [...headers.values()], body })
    }
    const fail = (status, code) => {
      if (settled) return
      headers.clear()
      headers.set('content-type', ['Content-Type', JSON_TYPE])
      settle(status, Buffer.from(JSON.stringify({ error: code })))
    }

    const rec = {
      statusCode: 200,
      get headersSent() {
        return settled
      },
      status(code) {
        rec.statusCode = code
        return rec
      },
      setHeader(name, value) {
        headers.set(String(name).toLowerCase(), [name, value])
        return rec
      },
      getHeader(name) {
        return headers.get(String(name).toLowerCase())?.[1]
      },
      removeHeader(name) {
        headers.delete(String(name).toLowerCase())
      },
      set(name, value) {
        if (typeof name === 'object' && name !== null) {
          for (const [k, v] of Object.entries(name)) rec.setHeader(k, v)
        } else {
          rec.setHeader(name, value)
        }
        return rec
      },
      header(name, value) {
        return rec.set(name, value)
      },
      json(value) {
        if (!headers.has('content-type')) rec.setHeader('Content-Type', JSON_TYPE)
        const text = JSON.stringify(value)
        settle(rec.statusCode, Buffer.from(text === undefined ? '' : text))
        return rec
      },
      send(body) {
        if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) return rec.json(body)
        if (typeof body === 'string' && !headers.has('content-type')) {
          rec.setHeader('Content-Type', 'text/html; charset=utf-8')
        }
        settle(rec.statusCode, toBuffer(body))
        return rec
      },
      end(chunk) {
        settle(rec.statusCode, toBuffer(chunk))
        return rec
      },
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => fail(504, 'upstream_timeout'), timeoutMs)
      timer.unref?.()
    }

    Promise.resolve()
      .then(() => handler(req, rec))
      .then(
        () => fail(500, 'no_response'),
        (err) => {
          if (!settled) console.error(`api handler failed: ${err?.message ?? err}`)
          fail(500, 'internal')
        },
      )
  })
}

function toBuffer(chunk) {
  if (chunk === undefined || chunk === null) return Buffer.alloc(0)
  if (Buffer.isBuffer(chunk)) return chunk
  if (chunk instanceof Uint8Array) return Buffer.from(chunk)
  return Buffer.from(String(chunk))
}
