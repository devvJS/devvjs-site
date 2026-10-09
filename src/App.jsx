import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import LoadingScreen from './components/LoadingScreen'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Resume from './pages/Resume'
import NotFound from './pages/NotFound'
import { ROUTES } from './routes'

// The game is a separate chunk, fetched only when /terminal-chaos is visited.
const loadGame = () => import('./pages/TerminalChaos.jsx')
const TerminalChaos = lazy(loadGame)

// When the game is the first page loaded, start fetching it as soon as this module runs,
// and keep the keys pressed while it loads (Enter to start, say): the game only listens
// once its chunk has arrived and mounted, a few hundred ms after the page's load event.
const early = { events: [], stop: null }
const firstPath = typeof window === 'undefined' ? '' : window.location.pathname
if (firstPath === ROUTES.game || firstPath === `${ROUTES.game}/`) {
  loadGame()
  const record = (e) => {
    // Chords (Ctrl+L, Cmd+R...) belong to the browser, as bindKeyboard treats them.
    if (e.ctrlKey || e.altKey || e.metaKey) return
    early.events.push({ type: e.type, code: e.code, key: e.key })
  }
  window.addEventListener('keydown', record, true)
  window.addEventListener('keyup', record, true)
  early.stop = () => {
    window.removeEventListener('keydown', record, true)
    window.removeEventListener('keyup', record, true)
    early.stop = null
  }
}

// Rendered after the game inside the same Suspense boundary, so its effect runs once the
// game is listening. It replays the keys pressed during loading, in order, then retires.
// The replay waits a tick so StrictMode's mount-unmount-mount replays into the live game.
function ReplayEarlyKeys() {
  useEffect(() => {
    if (!early.stop) return undefined
    const id = setTimeout(() => {
      early.stop()
      for (const { type, code, key } of early.events.splice(0)) {
        window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }))
      }
    }, 0)
    return () => clearTimeout(id)
  }, [])
  return null
}

// Everything except the game: the loading screen, Navbar and Footer around the pages.
function Site({ loading, onLoaded }) {
  // The first page was the game but a site page is showing now: retire the recorder
  // and drop what it caught, so nothing lingers or replays into a later game visit.
  useEffect(() => {
    early.stop?.()
    early.events.length = 0
  }, [])

  return (
    <div id="top" className="min-h-screen text-text-primary font-sans overflow-x-hidden">
      {loading && <LoadingScreen onComplete={onLoaded} />}
      <Navbar />
      <main className="pt-14">
        <Routes>
          <Route path={ROUTES.home} element={<Home />} />
          <Route path={ROUTES.resume} element={<Resume />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

function App() {
  const [loading, setLoading] = useState(true)

  return (
    <Routes>
      {/* Full screen, without the site chrome or the loading screen. */}
      <Route
        path={ROUTES.game}
        element={
          <Suspense fallback={<div className="fixed inset-0 bg-charcoal" aria-busy="true" />}>
            <TerminalChaos />
            <ReplayEarlyKeys />
          </Suspense>
        }
      />
      <Route path="*" element={<Site loading={loading} onLoaded={() => setLoading(false)} />} />
    </Routes>
  )
}

export default App
