import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useActiveSection from '../hooks/useActiveSection'

const SECTION_LINKS = [
  { hash: '#about', id: 'about', label: 'About' },
  { hash: '#skills', id: 'skills', label: 'Skills' },
  { hash: '#projects', id: 'projects', label: 'Projects' },
  { hash: '#contact', id: 'contact', label: 'Contact' },
]

const SECTION_IDS = ['hero', ...SECTION_LINKS.map((l) => l.id)]

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onHome = location.pathname === '/'
  const activeId = useActiveSection(onHome ? SECTION_IDS : [])
  const onResume = location.pathname === '/resume'

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const handleSectionClick = useCallback(
    (e, hash) => {
      const id = hash.slice(1)
      setMenuOpen(false)
      if (!onHome) {
        navigate(`/${hash}`)
        return
      }
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (history.replaceState) history.replaceState(null, '', hash)
    },
    [onHome, navigate],
  )

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-charcoal/80 backdrop-blur border-b border-text-secondary/30">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className="font-mono text-accent-green text-lg tracking-tight hover:text-accent-cyan transition-colors"
          aria-label="Home"
        >
          &gt; devvjs_<span className="animate-pulse">█</span>
        </Link>

        <ul className="hidden sm:flex items-center gap-4 sm:gap-6">
          {SECTION_LINKS.map((link) => {
            const isActive = onHome && activeId === link.id
            return (
              <li key={link.hash}>
                <a
                  href={onHome ? link.hash : `/${link.hash}`}
                  onClick={(e) => handleSectionClick(e, link.hash)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`font-mono text-sm transition-colors border-b ${
                    isActive
                      ? 'text-accent-green border-accent-green'
                      : 'text-text-primary border-transparent hover:text-accent-green'
                  }`}
                >
                  {link.label}
                </a>
              </li>
            )
          })}
          <li>
            <Link
              to="/resume"
              aria-current={onResume ? 'true' : undefined}
              className={`font-mono text-sm transition-colors border-b ${
                onResume
                  ? 'text-accent-green border-accent-green'
                  : 'text-text-primary border-transparent hover:text-accent-green'
              }`}
            >
              Resume
            </Link>
          </li>
        </ul>

        <button
          type="button"
          className="sm:hidden inline-flex items-center justify-center h-9 w-9 rounded border border-text-secondary/40 text-text-primary hover:text-accent-green hover:border-accent-green transition-colors"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="font-mono text-base leading-none" aria-hidden="true">
            {menuOpen ? '✕' : '≡'}
          </span>
        </button>
      </nav>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="sm:hidden border-t border-text-secondary/30 bg-charcoal/95 backdrop-blur"
        >
          <ul className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1">
            {SECTION_LINKS.map((link) => {
              const isActive = onHome && activeId === link.id
              return (
                <li key={link.hash}>
                  <a
                    href={onHome ? link.hash : `/${link.hash}`}
                    onClick={(e) => handleSectionClick(e, link.hash)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`block font-mono text-sm py-2 px-2 rounded transition-colors ${
                      isActive
                        ? 'text-accent-green bg-accent-green/10'
                        : 'text-text-primary hover:text-accent-green hover:bg-accent-green/5'
                    }`}
                  >
                    <span className="text-text-secondary mr-2">$</span>
                    {link.label}
                  </a>
                </li>
              )
            })}
            <li>
              <Link
                to="/resume"
                onClick={() => setMenuOpen(false)}
                aria-current={onResume ? 'true' : undefined}
                className={`block font-mono text-sm py-2 px-2 rounded transition-colors ${
                  onResume
                    ? 'text-accent-green bg-accent-green/10'
                    : 'text-text-primary hover:text-accent-green hover:bg-accent-green/5'
                }`}
              >
                <span className="text-text-secondary mr-2">$</span>
                Resume
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}

export default Navbar
