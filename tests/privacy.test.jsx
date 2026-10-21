// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each(['/privacy', '/privacy/'])('renders the privacy page at %s with site navigation', (path) => {
  vi.stubGlobal('scrollTo', vi.fn())
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)

  const main = screen.getByRole('main')
  expect(within(main).getByRole('heading', { level: 1, name: 'Privacy' })).toBeTruthy()
  expect(within(main).getByText('The House is a personal tool used only by its owner. Google data is not shared with anyone.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/')
  expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
})
