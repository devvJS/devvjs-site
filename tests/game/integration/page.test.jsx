// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import appSource from '../../../src/App.jsx?raw'
import { createRecordingContext } from '../helpers/s3-recording-ctx.js'
import App from '../../../src/App.jsx'

beforeEach(() => {
  const ctx = createRecordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  Element.prototype.scrollIntoView = () => {}
  window.scrollTo = () => {}
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const pages = import.meta.glob('../../../src/pages/TerminalChaos.jsx')
const loadPage = () => {
  const load = Object.values(pages)[0]
  if (!load) throw new Error('src/pages/TerminalChaos.jsx does not exist')
  return load()
}

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('TerminalChaos page', () => {
  it('renders the game root, a canvas and the status live region on the title screen', async () => {
    const { default: TerminalChaos } = await loadPage()
    const { container } = render(<TerminalChaos />)
    const root = screen.getByTestId('terminal-chaos')
    expect(root.querySelector('canvas')).not.toBeNull()
    expect(container.querySelectorAll('canvas').length).toBe(1)
    const status = screen.getByTestId('tc-status')
    expect(status.textContent).toBe("Devv's Terminal Chaos · Press Enter / Tap to start")
  })
})

describe('App routing for the game', () => {
  it('/terminal-chaos lazily renders the game, not NotFound', async () => {
    const { container } = renderAt('/terminal-chaos')
    expect(await screen.findByTestId('terminal-chaos')).toBeTruthy()
    expect(screen.queryByTestId('not-found')).toBeNull()
    expect(screen.queryByText('404 Not Found')).toBeNull()
    expect(screen.getByTestId('tc-status').textContent).toContain('Terminal Chaos')
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('/terminal-chaos has no Navbar, Footer or LoadingScreen overlay, before or after the chunk resolves', async () => {
    // A fresh module graph (React, RTL, router and App all re-imported together), so the lazy
    // chunk is NOT already resolved by an earlier test: otherwise no Suspense fallback is ever
    // rendered here and a LoadingScreen fallback would go unnoticed.
    vi.resetModules()
    const rtl = await import('@testing-library/react')
    const { MemoryRouter: FreshRouter } = await import('react-router-dom')
    const { default: FreshApp } = await import('../../../src/App.jsx')
    const { container } = rtl.render(
      <FreshRouter initialEntries={['/terminal-chaos']}>
        <FreshApp />
      </FreshRouter>,
    )
    const overlay = () => container.querySelector('.z-\\[100\\]')
    expect(screen.queryByTestId('terminal-chaos')).toBeNull() // still suspended
    expect(overlay()).toBeNull()
    expect(container.textContent).not.toContain('█')
    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
    await rtl.screen.findByTestId('terminal-chaos')
    expect(overlay()).toBeNull()
    expect(container.textContent).not.toContain('█')
    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('nav')).toBeNull()
    expect(container.querySelector('footer')).toBeNull()
    rtl.cleanup()
  })

  it('/terminal-chaos/ (trailing slash) also renders the game', async () => {
    renderAt('/terminal-chaos/')
    expect(await screen.findByTestId('terminal-chaos')).toBeTruthy()
    expect(screen.queryByTestId('not-found')).toBeNull()
  })

  it('/ still renders the home page with the Navbar', () => {
    const { container } = renderAt('/')
    expect(container.querySelector('header nav')).not.toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
    expect(container.querySelector('#hero')).not.toBeNull()
    expect(screen.queryByTestId('terminal-chaos')).toBeNull()
    expect(screen.queryByTestId('not-found')).toBeNull()
  })

  it('/nope still renders NotFound with the Navbar and Footer', () => {
    const { container } = renderAt('/nope')
    expect(screen.getByTestId('not-found')).toBeTruthy()
    expect(container.querySelector('header nav')).not.toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
    expect(screen.queryByTestId('terminal-chaos')).toBeNull()
  })

  it('App.jsx imports the game lazily, never statically', () => {
    const src = appSource
    expect(src).not.toMatch(/import\s[^;]*from\s*['"]\.\/pages\/TerminalChaos/)
    expect(src).not.toMatch(/^\s*import\s*['"]\.\/pages\/TerminalChaos/m)
    expect(src).toMatch(/lazy\(/)
    expect(src).toMatch(/import\(\s*['"]\.\/pages\/TerminalChaos(\.jsx)?['"]\s*\)/)
    expect(src).toMatch(/Suspense/)
  })
})
