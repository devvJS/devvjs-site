import { useCallback, useEffect, useState } from 'react'
import useActiveSection from '../hooks/useActiveSection'

const NAV_LINKS = [
  { href: '#about', id: 'about', label: 'About' },
  { href: '#skills', id: 'skills', label: 'Skills' },
  { href: '#projects', id: 'projects', label: 'Projects' },
  { href: '#contact', id: 'contact', label: 'Contact' },
]

const SECTION_IDS = ['hero', ...NAV_LINKS.map((l) => l.id)]

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const activeId = useActiveSection(SECTION_IDS)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const handleAnchorClick = useCallback((e, href) => {
    const id = href.slice(1)
    const el = document.getElementById(id)
    if (!el) return
    e.preventDefault()
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (history.replaceState) history.replaceState(null, '', href)
    setMenuOpen(false)
  }, [])

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-charcoal/80 backdrop-blur border-b border-text-secondary/30">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <a
          href="#top"
          onClick={(e) => handleAnchorClick(e, '#top')}
          className="font-mono text-accent-green text-lg tracking-tight hover:text-accent-cyan transition-colors"
          aria-label="Home"
        >
          &gt; devvjs_<span className="animate-pulse">█</span>
        </a>

        <ul className="hidden sm:flex items-center gap-4 sm:gap-6">
          {NAV_LINKS.map((link) => {
            const isActive = activeId === link.id
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
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
            {NAV_LINKS.map((link) => {
              const isActive = activeId === link.id
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
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
          </ul>
        </div>
      )}
    </header>
  )
}

export default Navbar