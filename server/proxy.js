import http from 'node:http'
import https from 'node:https'
import { createProxyMiddleware } from 'http-proxy-middleware'

// Reverse proxy for /job-tracker and /job-tracker/* to the tracker service.
//
// - Path and query are forwarded exactly as received (req.url).
// - Nothing reads the body before the proxy, so it streams byte-exact.
// - Response status, body, Set-Cookie, Location, Cache-Control and the rest
//   pass back unrewritten.
// - Hop-by-hop headers are dropped in both directions. Upstream connections
//   are kept alive with a shared agent, and the client's connection follows
//   the client's own Connection header, not the tracker's.
// - Tracker unreachable: 502 {"error":"tracker_unavailable"}. Tracker silent
//   for timeoutMs before the response headers arrive: 504
//   {"error":"tracker_timeout"}.

export const DEFAULT_PROXY_TIMEOUT_MS = 30_000

const TIMEOUT_CODE = 'ETRACKERTIMEOUT'
const CLIENT_WANTS_CLOSE = Symbol('clientWantsClose')
const JSON_TYPE = 'application/json; charset=utf-8'

// RFC 9110 section 7.6.1, plus the legacy Proxy-Connection. Expect is dropped
// too: Node's server has already answered 100-continue to the client.
const REQUEST_HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'upgrade',
  'expect',
]
const RESPONSE_HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-connection', 'trailer', 'upgrade']
// Message framing and routing. A Connection header naming one of these must
// not make the proxy drop it: losing Content-Length on a GET with a body
// would forward an unframed body.
const NEVER_NOMINATED = new Set(['content-length', 'transfer-encoding', 'host'])

export function isTrackerPath(pathname) {
  return pathname === '/job-tracker' || pathname.startsWith('/job-tracker/')
}

function pathOnly(url) {
  const i = url.search(/[?#]/)
  return i === -1 ? url : url.slice(0, i)
}

function connectionTokens(value) {
  if (value === undefined) return []
  const list = Array.isArray(value) ? value.join(',') : String(value)
  return list
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

function stripHopByHop(headers, names) {
  for (const token of connectionTokens(headers.connection)) {
    if (!NEVER_NOMINATED.has(token)) delete headers[token]
  }
  for (const name of names) delete headers[name]
}

function logLine(kind, err, req) {
  console.error(`tracker proxy ${kind}: ${err?.code ?? err?.message ?? 'unknown'} ${req.method} ${pathOnly(req.url)}`)
}

export function createTrackerProxy({ trackerUrl, timeoutMs = DEFAULT_PROXY_TIMEOUT_MS }) {
  const target = new URL(trackerUrl)
  const Agent = target.protocol === 'https:' ? https.Agent : http.Agent
  const agent = new Agent({ keepAlive: true })

  const proxy = createProxyMiddleware({
    target: trackerUrl,
    agent,
    xfwd: true,
    on: {
      proxyReq(proxyReq) {
        if (!(timeoutMs > 0)) return
        proxyReq.setTimeout(timeoutMs, () => {
          const err = new Error('tracker did not respond in time')
          err.code = TIMEOUT_CODE
          proxyReq.destroy(err)
        })
        // Bound the wait for the response headers only, so a long-lived
        // response body is not cut off.
        proxyReq.once('response', () => proxyReq.setTimeout(0))
      },
      proxyRes(proxyRes, req) {
        stripHopByHop(proxyRes.headers, RESPONSE_HOP_BY_HOP)
        // http-proxy then fills Connection from the client's request header
        // (stripped above, so "keep-alive" on HTTP/1.1); keep a client's close.
        if (req[CLIENT_WANTS_CLOSE]) proxyRes.headers.connection = 'close'
      },
      error(err, req, res) {
        const timedOut = err?.code === TIMEOUT_CODE
        logLine(timedOut ? 'timeout' : 'error', err, req)
        if (typeof res?.writeHead !== 'function') {
          res?.destroy?.()
          return
        }
        if (res.headersSent) {
          res.destroy()
          return
        }
        res.writeHead(timedOut ? 504 : 502, { 'Content-Type': JSON_TYPE })
        res.end(JSON.stringify({ error: timedOut ? 'tracker_timeout' : 'tracker_unavailable' }))
      },
    },
  })

  // The single gate for what is proxied: the raw request path, before any
  // normalisation. Hop-by-hop headers are removed from req.headers here,
  // because http-proxy copies req.headers into the upstream request.
  return function trackerProxy(req, res, next) {
    if (!isTrackerPath(pathOnly(req.url))) return next()
    req[CLIENT_WANTS_CLOSE] = connectionTokens(req.headers.connection).includes('close')
    stripHopByHop(req.headers, REQUEST_HOP_BY_HOP)
    return proxy(req, res, next)
  }
}
