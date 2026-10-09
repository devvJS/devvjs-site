// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { createRecordingContext } from '../helpers/s3-recording-ctx.js'
import { createFakeAudio } from '../helpers/s3-fake-audio.js'
import { createFrameClock } from '../helpers/frame-clock.js'
import { loadSrc, makeState, makeScriptedGame } from '../helpers/s3-fixtures.js'
import { STEP_MS } from '../../../src/game/constants.js'

// Revision 1: keyboard users on the view's own controls, and tapping the canvas while paused.
let clock
let game

beforeEach(() => {
  vi.useFakeTimers()
  const ctx = createRecordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
  window.innerWidth = 1024
  window.innerHeight = 768
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function mount(state) {
  const { default: GameView } = await loadSrc('game/ui/GameView.jsx')
  clock = createFrameClock()
  game = makeScriptedGame(state)
  const audio = createFakeAudio()
  return render(
    <GameView makeGame={() => game} AudioContextCtor={audio.Ctor} now={clock.now}
      requestFrame={clock.requestFrame} cancelFrame={clock.cancelFrame} />,
  )
}
const frame = async () => { await act(async () => { clock.advance(STEP_MS + 0.01) }) }

describe('keys on the view\'s own controls', () => {
  const targets = {
    'back link': () => screen.getByText('<- Back to devvjs.dev'),
    'sound toggle': () => screen.getByRole('button', { name: 'Toggle sound' }),
  }
  for (const [name, get] of Object.entries(targets)) {
    for (const code of ['Enter', 'Space']) {
      it(`${code} on the ${name} is not taken by the game`, async () => {
        await mount(makeState('title'))
        const notPrevented = fireEvent.keyDown(get(), { code, key: code === 'Space' ? ' ' : 'Enter' })
        expect(notPrevented).toBe(true)
        await frame()
        expect(game.calls[0].pressed.has('start')).toBe(false)
        expect(game.calls[0].pressed.has('jump')).toBe(false)
        expect(game.calls[0].held.has('start')).toBe(false)
        expect(game.calls[0].held.has('jump')).toBe(false)
      })
    }
  }

  it('Enter or Space on any button, link or input inside the view is left alone', async () => {
    const { container } = await mount(makeState('title'))
    const extra = document.createElement('input')
    container.querySelector('[data-testid="terminal-chaos"]').appendChild(extra)
    const els = [...container.querySelectorAll('a, button, input')]
    expect(els.length).toBeGreaterThanOrEqual(3)
    for (const el of els) {
      for (const code of ['Enter', 'Space']) expect(fireEvent.keyDown(el, { code }), `${el.tagName} ${code}`).toBe(true)
    }
    await frame()
    expect(game.calls[0].pressed.size).toBe(0)
  })

  it('keys on the window or the body still reach the game', async () => {
    await mount(makeState('title'))
    expect(fireEvent.keyDown(document.body, { code: 'Enter' })).toBe(false)
    fireEvent.keyDown(window, { code: 'Space' })
    await frame()
    expect([...game.calls[0].pressed].sort()).toEqual(['jump', 'start'])
  })

  it('arrow keys on a button are also left to the page? No: the game keeps the arrows', async () => {
    await mount(makeState('playing'))
    fireEvent.keyDown(document.body, { code: 'ArrowRight' })
    await frame()
    expect(game.calls[0].held.has('right')).toBe(true)
  })
})

describe('tapping the canvas', () => {
  it('while paused presses pause (resume)', async () => {
    const { container } = await mount(makeState('paused'))
    fireEvent.pointerDown(container.querySelector('canvas'))
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(true)
  })

  it('while playing does not press pause', async () => {
    const { container } = await mount(makeState('playing'))
    fireEvent.pointerDown(container.querySelector('canvas'))
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(false)
  })

  it('on the title still starts', async () => {
    const { container } = await mount(makeState('title'))
    fireEvent.pointerDown(container.querySelector('canvas'))
    await frame()
    expect(game.calls[0].pressed.has('start')).toBe(true)
  })
})
