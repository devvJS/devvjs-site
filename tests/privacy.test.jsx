// @vitest-environment jsdom
import { it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it.each(['/privacy', '/privacy/'])('renders the privacy statement with site navigation at %s', (path) => {
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  window.scrollTo = () => {}
  const { container } = render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeTruthy()
  expect(screen.getByText('The House is a personal tool used only by its owner. Google data is not shared with anyone.')).toBeTruthy()
  expect(container.querySelector('header nav')).not.toBeNull()
  const footer = container.querySelector('footer')
  const link = within(footer).getByRole('link', { name: 'Privacy' })
  expect(link.getAttribute('href')).toBe('/privacy')
})

it('opens privacy from the footer', () => {
  window.scrollTo = () => {}
  const { container } = render(<MemoryRouter initialEntries={['/missing']}><App /></MemoryRouter>)
  fireEvent.click(within(container.querySelector('footer')).getByRole('link', { name: 'Privacy' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeTruthy()
  expect(screen.queryByTestId('not-found')).toBeNull()
})
