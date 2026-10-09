// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { createRecordingContext } from '../helpers/s3-recording-ctx.js'
import { createFakeAudio } from '../helpers/s3-fake-audio.js'
import { createFrameClock } from '../helpers/frame-clock.js'
import { loadSrc, makeState, makeScriptedGame } from '../helpers/s3-fixtures.js'
import { STEP_MS } from '../../../src/game/constants.js'

// Revision 2: only Enter and Space belong to a focused control; the other game keys still
// reach the game from it, and a key released on a control never sticks.
let clock
let game

beforeEach(() => {
  vi.useFakeTimers()
  const ctx = createRecordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
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
  render(
    <GameView makeGame={() => game} AudioContextCtor={audio.Ctor} now={clock.now}
      requestFrame={clock.requestFrame} cancelFrame={clock.cancelFrame} />,
  )
}
const frame = async () => { await act(async () => { clock.advance(STEP_MS + 0.01) }) }
const toggle = () => screen.getByRole('button', { name: 'Toggle sound' })

describe('game keys on a focused control', () => {
  it('ArrowRight on the sound toggle reaches the game and is preventDefaulted', async () => {
    await mount(makeState('playing'))
    expect(fireEvent.keyDown(toggle(), { code: 'ArrowRight' })).toBe(false)
    await frame()
    expect(game.calls[0].held.has('right')).toBe(true)
    expect(game.calls[0].pressed.has('right')).toBe(true)
  })

  it('KeyJ on the sound toggle fires echo and is preventDefaulted', async () => {
    await mount(makeState('playing'))
    expect(fireEvent.keyDown(toggle(), { code: 'KeyJ' })).toBe(false)
    await frame()
    expect(game.calls[0].pressed.has('echo')).toBe(true)
  })

  it('a key held from the body and released on a control is released next frame', async () => {
    await mount(makeState('playing'))
    fireEvent.keyDown(document.body, { code: 'ArrowRight' })
    await frame()
    expect(game.calls[0].held.has('right')).toBe(true)
    toggle().focus()
    fireEvent.keyUp(toggle(), { code: 'ArrowRight' })
    await frame()
    expect(game.calls[1].held.has('right')).toBe(false)
  })

  it('Enter and Space released on a control also release', async () => {
    await mount(makeState('playing'))
    fireEvent.keyDown(document.body, { code: 'Space' })
    await frame()
    expect(game.calls[0].held.has('jump')).toBe(true)
    fireEvent.keyUp(toggle(), { code: 'Space' })
    await frame()
    expect(game.calls[1].held.has('jump')).toBe(false)
  })
})
