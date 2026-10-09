// The site's routes, shared by the React router (src/App.jsx) and the server's
// SPA fallback (server/app.js). A path not listed here is a 404.
export const ROUTES = Object.freeze({
  home: '/',
  resume: '/resume',
  game: '/terminal-chaos',
})

const KNOWN = new Set(Object.values(ROUTES))

// True for each route, with or without one trailing slash. Matching is exact and
// case-sensitive, so '/Resume' and '/resume/x' are unknown.
export function isKnownRoute(pathname) {
  if (typeof pathname !== 'string') return false
  if (KNOWN.has(pathname)) return true
  if (!pathname.endsWith('/')) return false
  const bare = pathname.slice(0, -1)
  return bare !== ROUTES.home && KNOWN.has(bare)
}
