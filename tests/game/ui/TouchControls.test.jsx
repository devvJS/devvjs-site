// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { loadSrc } from '../helpers/s3-fixtures.js'

// Pinned: default export, prop `input` ({ press, release }).
const MAP = [
  ['Left', 'left'], ['Right', 'right'], ['Jump', 'jump'], ['echo', 'echo'],
  ['sudo', 'sudo'], ['rm -rf', 'rmrf'], ['Pause', 'pause'], ['Mute', 'mute'],
]

afterEach(cleanup)

async function setup() {
  const { default: TouchControls } = await loadSrc('game/ui/TouchControls.jsx')
  const input = { press: vi.fn(), release: vi.fn() }
  render(<TouchControls input={input} />)
  return input
}

describe('TouchControls', () => {
  it('has exactly the eight buttons', async () => {
    await setup()
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names).toEqual(expect.arrayContaining(MAP.map(([l]) => l)))
    expect(names.length).toBe(8)
  })

  it.each(MAP)('%s presses %s on pointerdown', async (label, action) => {
    const input = await setup()
    fireEvent.pointerDown(screen.getByRole('button', { name: label }))
    expect(input.press.mock.calls).toEqual([[action]])
    expect(input.release).not.toHaveBeenCalled()
  })

  it.each(MAP)('%s releases %s on pointerup', async (label, action) => {
    const input = await setup()
    const b = screen.getByRole('button', { name: label })
    fireEvent.pointerDown(b)
    fireEvent.pointerUp(b)
    expect(input.release.mock.calls).toEqual([[action]])
  })

  it.each(MAP)('%s releases %s on pointercancel', async (label, action) => {
    const input = await setup()
    const b = screen.getByRole('button', { name: label })
    fireEvent.pointerDown(b)
    fireEvent.pointerCancel(b)
    expect(input.release.mock.calls).toEqual([[action]])
  })

  it.each(MAP)('%s releases %s on pointerleave', async (label, action) => {
    const input = await setup()
    const b = screen.getByRole('button', { name: label })
    fireEvent.pointerDown(b)
    fireEvent.pointerLeave(b)
    expect(input.release.mock.calls).toEqual([[action]])
  })

  it('presses only the touched button', async () => {
    const input = await setup()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Jump' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Right' }))
    expect(input.press.mock.calls).toEqual([['jump'], ['right']])
  })

  it('does not release on pointerup alone before any press of that button', async () => {
    const input = await setup()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Left' }))
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Right' }))
    expect(input.release.mock.calls.filter(([a]) => a === 'left')).toEqual([])
  })
})
