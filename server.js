// Railway entry point: serves dist/, the cached /api/* handlers and the
// /job-tracker proxy. Env: PORT (default 3000), TRACKER_URL, GITHUB_TOKEN,
// CANONICAL_HOST (production only: redirects www.<host> to https://<host>).
import http from 'node:http'
import process from 'node:process'
import { createApp, DEFAULT_TRACKER_URL } from './server/app.js'
import { parseCanonicalHost } from './server/canonical.js'

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const rawPort = process.env.PORT ?? '3000'
const port = Number(rawPort)
if (!/^\d+$/.test(rawPort) || port > 65535) fail(`Invalid PORT "${rawPort}": expected an integer from 0 to 65535`)

const trackerUrl = process.env.TRACKER_URL || DEFAULT_TRACKER_URL
// Empty means unset; anything else must be a bare hostname or startup fails.
const rawCanonicalHost = process.env.CANONICAL_HOST || undefined
let canonicalHost
let app
try {
  canonicalHost = parseCanonicalHost(rawCanonicalHost)
  app = createApp({ trackerUrl, canonicalHost })
} catch (err) {
  fail(`Could not start: ${err?.message ?? err}`)
}

// Log only the origin, never any credentials embedded in the URL.
function originOf(url) {
  try {
    return new URL(url).origin
  } catch {
    return '(invalid URL)'
  }
}

const server = http.createServer(app)

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') fail(`Port ${port} is already in use`)
  if (err.code === 'EACCES') fail(`No permission to listen on port ${port}`)
  fail(`Could not listen on port ${port}: ${err.code ?? err.message}`)
})

server.listen(port, () => {
  const token = process.env.GITHUB_TOKEN ? 'set' : 'not set'
  const canonical = canonicalHost ? `, canonical host ${canonicalHost}` : ''
  console.log(`devvjs-site listening on port ${port} (tracker: ${originOf(trackerUrl)}, GITHUB_TOKEN ${token}${canonical})`)
})

function shutdown(signal) {
  console.log(`${signal} received, shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
