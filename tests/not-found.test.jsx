// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'

// Browser APIs jsdom lacks or that would hit the network. App's routing is real.
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  Element.prototype.scrollIntoView = () => {}
  window.scrollTo = () => {}
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function renderAt(path) {
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  // Let the LoadingScreen finish (typing + hold + fade).
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000)
  })
  return utils
}

describe('404 page inside App', () => {
  it('renders the not-found root at an unknown route', async () => {
    await renderAt('/definitely-not-here')
    expect(screen.getByTestId('not-found')).toBeTruthy()
  })

  it('shows the heading and the message', async () => {
    await renderAt('/definitely-not-here')
    const root = screen.getByTestId('not-found')
    const h1 = root.querySelector('h1')
    expect(h1.textContent).toBe('404 Not Found')
    expect(screen.getByRole('heading', { level: 1, name: '404 Not Found' })).toBe(h1)
    const p = root.querySelector('p')
    expect(p.textContent).toBe('This is not the page you are looking for')
  })

  it('has the Go back link to / and the Waste time link to /terminal-chaos', async () => {
    await renderAt('/definitely-not-here')
    const back = screen.getByRole('link', { name: '<- Go back' })
    const waste = screen.getByRole('link', { name: 'Waste time ->' })
    expect(back.getAttribute('href')).toBe('/')
    expect(waste.getAttribute('href')).toBe('/terminal-chaos')
    expect(screen.getByTestId('not-found').contains(back)).toBe(true)
    expect(screen.getByTestId('not-found').contains(waste)).toBe(true)
  })

  it('keeps the Navbar and Footer', async () => {
    const { container } = await renderAt('/definitely-not-here')
    expect(container.querySelector('header nav')).not.toBeNull()
    expect(container.querySelector('footer')).not.toBeNull()
  })

  it('is not shown at a known route (and the page module exists)', async () => {
    const mod = await import('../src/pages/NotFound.jsx')
    expect(typeof mod.default).toBe('function')
    await renderAt('/')
    expect(screen.queryByTestId('not-found')).toBeNull()
    expect(screen.queryByText('404 Not Found')).toBeNull()
  })

  it('is not shown at /resume', async () => {
    const mod = await import('../src/pages/NotFound.jsx')
    expect(typeof mod.default).toBe('function')
    await renderAt('/resume')
    expect(screen.queryByTestId('not-found')).toBeNull()
  })
})
