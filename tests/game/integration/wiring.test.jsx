// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { createRecordingContext } from '../helpers/s3-recording-ctx.js'
import { createFakeAudio } from '../helpers/s3-fake-audio.js'

const pages = import.meta.glob('../../../src/pages/TerminalChaos.jsx')
const loadPage = () => {
  const load = Object.values(pages)[0]
  if (!load) throw new Error('src/pages/TerminalChaos.jsx does not exist')
  return load()
}

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
  window.history.replaceState(null, '', '/')
})

describe('TerminalChaos page wiring', () => {
  it('sets the document title while mounted and restores it on unmount', async () => {
    document.title = 'devvJS'
    const { default: TerminalChaos } = await loadPage()
    const { unmount } = render(<TerminalChaos />)
    expect(document.title).toBe("Devv's Terminal Chaos · devvJS")
    unmount()
    expect(document.title).toBe('devvJS')
  })

  it('wires window.AudioContext: one construction on the first key, none before', async () => {
    const audio = createFakeAudio()
    vi.stubGlobal('AudioContext', audio.Ctor)
    window.AudioContext = audio.Ctor
    const { default: TerminalChaos } = await loadPage()
    render(<TerminalChaos />)
    expect(audio.instances.length).toBe(0)
    fireEvent.keyDown(window, { code: 'Enter', key: 'Enter' })
    expect(audio.instances.length).toBe(1)
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(audio.instances.length).toBe(1)
  })

  it('persists the mute choice through the real storage adapter (tc:muted)', async () => {
    const { default: TerminalChaos } = await loadPage()
    render(<TerminalChaos />)
    expect(window.localStorage.getItem('tc:muted')).toBeNull()
    fireEvent.keyDown(window, { code: 'KeyM', key: 'm' })
    fireEvent.keyUp(window, { code: 'KeyM', key: 'm' })
    await waitFor(() => expect(window.localStorage.getItem('tc:muted')).toBe('false'))
    expect(screen.getByRole('button', { name: 'Toggle sound' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('starts unmuted when tc:muted is already "false" in storage', async () => {
    window.localStorage.setItem('tc:muted', 'false')
    const { default: TerminalChaos } = await loadPage()
    render(<TerminalChaos />)
    expect(screen.getByRole('button', { name: 'Toggle sound' }).getAttribute('aria-pressed')).toBe('true')
  })
})

// --- Early-key replay (App.jsx). The recorder arms when App's module is first evaluated on
// /terminal-chaos, so every test builds a fresh module graph (React, RTL, router and App
// together) after pointing jsdom's location at the game.
async function freshApp({ strict = false } = {}) {
  window.history.replaceState(null, '', '/terminal-chaos')
  vi.resetModules()
  const React = await import('react')
  const rtl = await import('@testing-library/react')
  const { MemoryRouter } = await import('react-router-dom')
  const { default: App } = await import('../../../src/App.jsx')
  const mount = (path = '/terminal-chaos') => {
    const tree = (
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    )
    return rtl.render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree)
  }
  return { rtl, mount }
}

const key = (type, code, key_, extra = {}) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, key: key_, bubbles: true, cancelable: true, ...extra }))
const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms))

function logReplay() {
  const seen = []
  const on = (e) => seen.push(`${e.type}:${e.code}`)
  window.addEventListener('keydown', on)
  window.addEventListener('keyup', on)
  return { seen, stop: () => { window.removeEventListener('keydown', on); window.removeEventListener('keyup', on) } }
}

describe('early keys typed before the game chunk mounts', () => {
  it('an Enter typed while loading starts Level 1', async () => {
    const { rtl, mount } = await freshApp()
    key('keydown', 'Enter', 'Enter')
    key('keyup', 'Enter', 'Enter')
    mount()
    await rtl.waitFor(() => expect(rtl.screen.getByTestId('tc-status').textContent).toContain('Level 1: The Editor'))
    rtl.cleanup()
  })

  it('under StrictMode the Enter is replayed exactly once', async () => {
    const { rtl, mount } = await freshApp({ strict: true })
    key('keydown', 'Enter', 'Enter')
    key('keyup', 'Enter', 'Enter')
    const log = logReplay()
    mount()
    await rtl.waitFor(() => expect(rtl.screen.getByTestId('tc-status').textContent).toContain('Level 1: The Editor'))
    await settle()
    log.stop()
    expect(log.seen).toEqual(['keydown:Enter', 'keyup:Enter'])
    rtl.cleanup()
  })

  it('a Ctrl+L chord typed while loading is not replayed as a plain L', async () => {
    const { rtl, mount } = await freshApp()
    key('keydown', 'ControlLeft', 'Control', { ctrlKey: true })
    key('keydown', 'KeyL', 'l', { ctrlKey: true })
    key('keyup', 'KeyL', 'l', { ctrlKey: true })
    key('keyup', 'ControlLeft', 'Control')
    key('keydown', 'Enter', 'Enter')
    key('keyup', 'Enter', 'Enter')
    const log = logReplay()
    mount()
    await rtl.waitFor(() => expect(rtl.screen.getByTestId('tc-status').textContent).toContain('Level 1: The Editor'))
    await settle()
    log.stop()
    expect(log.seen.filter((s) => s.endsWith(':KeyL'))).toEqual([])
    expect(log.seen).toContain('keydown:Enter')
    rtl.cleanup()
  })

  it('a first page on the game that then shows a site route retires the recorder', async () => {
    const adds = []
    const removes = []
    const add = window.addEventListener.bind(window)
    const remove = window.removeEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation((t, fn, o) => { adds.push([t, fn, o]); return add(t, fn, o) })
    vi.spyOn(window, 'removeEventListener').mockImplementation((t, fn, o) => { removes.push([t, fn, o]); return remove(t, fn, o) })
    const { rtl, mount } = await freshApp()
    const armed = () =>
      adds.filter(([t, fn, o]) => (t === 'keydown' || t === 'keyup') && (o === true || o?.capture === true) &&
        !removes.some(([rt, rfn]) => rt === t && rfn === fn))
    expect(armed().length).toBeGreaterThan(0) // the recorder is armed on /terminal-chaos
    mount('/nope') // the app shows the Site, not the game
    await rtl.waitFor(() => expect(rtl.screen.getByTestId('not-found')).toBeTruthy())
    await settle()
    expect(armed()).toEqual([])
    rtl.cleanup()
  })

  it('keys pressed while a site route showed are not replayed into a later game visit', async () => {
    const { rtl, mount } = await freshApp()
    mount('/nope')
    await rtl.waitFor(() => expect(rtl.screen.getByTestId('not-found')).toBeTruthy())
    await settle()
    key('keydown', 'Enter', 'Enter')
    key('keyup', 'Enter', 'Enter')
    rtl.cleanup()
    mount('/terminal-chaos')
    await rtl.screen.findByTestId('terminal-chaos')
    await settle(100)
    expect(rtl.screen.getByTestId('tc-status').textContent).toContain('Press Enter / Tap to start')
    rtl.cleanup()
  })
})
