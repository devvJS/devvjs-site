// Redirects www.<canonicalHost> to https://<canonicalHost>, keeping the path
// and query byte-exact. The Location host always comes from configuration,
// never from the request, so this cannot become an open redirect.

// A bare DNS hostname: dot-separated labels of letters, digits and inner
// hyphens, at most 63 characters each. No scheme, path, port, userinfo,
// trailing dot or IP literal brackets.
const LABEL = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
const HOSTNAME = new RegExp(`^${LABEL}(?:\\.${LABEL})*$`)

// Returns the normalized (lowercased) hostname, or undefined when unset.
// Throws on anything that is not a bare hostname, so a typo in the env fails
// the deploy instead of producing a redirect loop or a broken Location.
export function parseCanonicalHost(value) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new TypeError(`Invalid canonical host: expected a string, got ${typeof value}`)
  }
  const host = value.toLowerCase()
  if (host.length > 253 || !HOSTNAME.test(host)) {
    throw new Error(
      `Invalid canonical host ${JSON.stringify(value)}: expected a bare hostname such as "devvjs.dev" (no scheme, path or port)`,
    )
  }
  // www.<host> redirects to <host>, so the canonical host itself must not be
  // a www host: that would redirect the apex's own www.www. name, never www.
  if (host.startsWith('www.')) {
    throw new Error(
      `Invalid canonical host ${JSON.stringify(value)}: it must not start with "www." (use the apex, such as "devvjs.dev")`,
    )
  }
  return host
}

// The Host header's hostname, lowercased, with any :port and then one
// trailing dot (the fully qualified form, www.devvjs.dev.) removed.
function requestHostname(req) {
  const raw = req.headers.host
  if (typeof raw !== 'string') return ''
  return raw.toLowerCase().replace(/:\d*$/, '').replace(/\.$/, '')
}

// Express middleware. With no canonical host it passes every request through.
export function canonicalRedirect(canonicalHost) {
  const host = parseCanonicalHost(canonicalHost)
  if (host === undefined) return (req, res, next) => next()
  const wwwHost = `www.${host}`

  return (req, res, next) => {
    // Only origin-form targets ("/path?query"). Absolute-form
    // ("GET http://x/p") and asterisk-form ("OPTIONS *") are left to the
    // rest of the app, so they never become "https://<host>http://x/p".
    if (!req.originalUrl.startsWith('/')) return next()
    if (requestHostname(req) !== wwwHost) return next()
    const status = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308
    // Set Location directly: res.redirect()/res.location() would re-encode
    // the URL, and it must reach the client exactly as it was requested.
    res.statusCode = status
    res.setHeader('Location', `https://${host}${req.originalUrl}`)
    res.end()
  }
}
