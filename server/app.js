import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import githubStats from '../api/github-stats.js'
import projects from '../api/projects.js'
import { cached } from './cache.js'
import { canonicalRedirect } from './canonical.js'
import { createTrackerProxy, DEFAULT_PROXY_TIMEOUT_MS } from './proxy.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULT_DIST_DIR = path.join(repoRoot, 'dist')
export const DEFAULT_TRACKER_URL = 'http://job-tracker.railway.internal:8080'
export const API_TTL_MS = 10 * 60 * 1000

const IMMUTABLE = 'public, max-age=31536000, immutable'
const NO_CACHE = 'no-cache'
// Vite output: assets/<name>-<hash>.<ext>, the hash being exactly 8
// base64url characters without a hyphen after the last "-".
const HASHED_ASSET = /^assets\/(?:.+\/)?[^/]+-[A-Za-z0-9_]{8}\.[A-Za-z0-9]+$/

function sendError(res, status, code) {
  res.status(status).json({ error: code })
}

export function createApp({
  distDir = DEFAULT_DIST_DIR,
  trackerUrl = DEFAULT_TRACKER_URL,
  now = () => Date.now(),
  handlers = {},
  proxyTimeoutMs = DEFAULT_PROXY_TIMEOUT_MS,
  canonicalHost,
} = {}) {
  const { githubStats: ghHandler = githubStats, projects: prHandler = projects } = handlers
  const indexFile = path.join(distDir, 'index.html')

  const app = express()
  app.disable('x-powered-by')

  // First of all: www.<canonicalHost> redirects to the canonical host, before
  // the health check, the proxy and everything else. A no-op when unset.
  app.use(canonicalRedirect(canonicalHost))

  app.get('/healthz', (req, res) => {
    res.json({ ok: true })
  })

  // The tracker proxy runs before anything that reads the body, so the
  // request streams through untouched. Path and query are forwarded as-is.
  app.use(createTrackerProxy({ trackerUrl, timeoutMs: proxyTimeoutMs }))

  app.get('/api/github-stats', cached(ghHandler, { ttlMs: API_TTL_MS, now }))
  app.get('/api/projects', cached(prHandler, { ttlMs: API_TTL_MS, now }))
  app.use('/api', (req, res) => sendError(res, 404, 'not_found'))

  app.use(
    express.static(distDir, {
      index: 'index.html',
      redirect: false,
      setHeaders(res, filePath) {
        const rel = path.relative(distDir, filePath).split(path.sep).join('/')
        if (HASHED_ASSET.test(rel)) res.setHeader('Cache-Control', IMMUTABLE)
        else if (rel === 'index.html') res.setHeader('Cache-Control', NO_CACHE)
      },
    }),
  )

  // SPA fallback, the same rule as vercel.json: no /api/, no /job-tracker,
  // and no dot in the last path segment.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const pathname = req.path
    if (pathname.startsWith('/api/') || pathname.startsWith('/job-tracker')) return next()
    const last = pathname.slice(pathname.lastIndexOf('/') + 1)
    if (last.includes('.')) return next()
    res.setHeader('Cache-Control', NO_CACHE)
    res.sendFile(indexFile, { cacheControl: false }, (err) => {
      if (err) next(err)
    })
  })

  app.use((req, res) => sendError(res, 404, 'not_found'))

  // Errors are one JSON line, never a stack trace.
  // eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
  app.use((err, req, res, next) => {
    const status = err?.status ?? err?.statusCode
    if (res.headersSent) {
      res.destroy()
      return
    }
    if (status === 404) return sendError(res, 404, 'not_found')
    if (Number.isInteger(status) && status >= 400 && status < 500) return sendError(res, status, 'bad_request')
    console.error(`request failed: ${req.method} ${req.path}: ${err?.message ?? err}`)
    sendError(res, 500, 'internal')
  })

  return app
}
