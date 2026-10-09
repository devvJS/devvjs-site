// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { createRecordingContext, textsOf } from '../helpers/s3-recording-ctx.js'
import { createFakeAudio } from '../helpers/s3-fake-audio.js'
import { createFrameClock } from '../helpers/frame-clock.js'
import { loadSrc, makeState, makeWorld, makeScriptedGame } from '../helpers/s3-fixtures.js'
import { STEP_MS } from '../../../src/game/constants.js'

// Pinned: makeGame() returns the game itself ({ state, update }). The component uses
// canvas.getContext('2d'), window innerWidth/innerHeight for the scale, document.visibilityState
// for the hidden check, and updates the Hud from game.state once per frame.
let ctx
let clock
let audio
let game

beforeEach(() => {
  vi.useFakeTimers()
  ctx = createRecordingContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx)
  window.innerWidth = 1024
  window.innerHeight = 768
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete document.visibilityState
  delete document.hidden
})

async function mount({ state, withAudio = true, makeGameFn } = {}) {
  const { default: GameView } = await loadSrc('game/ui/GameView.jsx')
  clock = createFrameClock()
  audio = createFakeAudio()
  game = makeScriptedGame(state ?? makeState('title'))
  const view = render(
    <GameView
      makeGame={makeGameFn ?? (() => game)}
      AudioContextCtor={withAudio ? audio.Ctor : undefined}
      now={clock.now}
      requestFrame={clock.requestFrame}
      cancelFrame={clock.cancelFrame}
    />,
  )
  return view
}
// Each call moves time by n steps plus a hair, so exactly n steps run.
const frame = async (n = 1) => {
  await act(async () => {
    clock.advance(STEP_MS * n + 0.01)
  })
}
const hide = (hidden) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  fireEvent(document, new Event('visibilitychange'))
}

describe('GameView structure', () => {
  it('renders the root, a 320x180 canvas, the Hud and the touch controls', async () => {
    const { container } = await mount()
    expect(screen.getByTestId('terminal-chaos')).toBeTruthy()
    const canvas = container.querySelector('canvas')
    expect(canvas.width).toBe(320)
    expect(canvas.height).toBe(180)
    expect(screen.getByTestId('tc-status')).toBeTruthy()
    for (const name of ['Left', 'Right', 'Jump', 'echo', 'sudo', 'rm -rf', 'Pause', 'Mute']) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('has the canvas inside the root', async () => {
    await mount()
    expect(screen.getByTestId('terminal-chaos').querySelector('canvas')).toBeTruthy()
  })

  it('styles the canvas pixelated at a whole-number scale (1024x768 gives 3x)', async () => {
    const { container } = await mount()
    const c = container.querySelector('canvas')
    expect(c.style.imageRendering).toBe('pixelated')
    expect(c.style.width).toBe('960px')
    expect(c.style.height).toBe('540px')
  })

  it('uses the largest whole scale that fits and follows resizes', async () => {
    window.innerWidth = 1300
    window.innerHeight = 400
    const { container } = await mount()
    const c = container.querySelector('canvas')
    expect(c.style.width).toBe('640px')
    expect(c.style.height).toBe('360px')
    window.innerWidth = 1700
    window.innerHeight = 1000
    await act(async () => { fireEvent(window, new Event('resize')) })
    expect(c.style.width).toBe('1600px')
    expect(c.style.height).toBe('900px')
  })

  it('never goes below 1x', async () => {
    window.innerWidth = 200
    window.innerHeight = 100
    const { container } = await mount()
    const c = container.querySelector('canvas')
    expect(c.style.width).toBe('320px')
    expect(c.style.height).toBe('180px')
  })

  it('works without an AudioContext constructor', async () => {
    await mount({ withAudio: false })
    expect(() => fireEvent.keyDown(window, { code: 'Enter' })).not.toThrow()
    await frame()
    expect(game.calls.length).toBe(1)
  })
})

describe('GameView drawing', () => {
  it('turns smoothing off and draws the title through the real renderer', async () => {
    await mount()
    expect(ctx.imageSmoothingEnabled).toBe(false)
    await frame()
    expect(textsOf(ctx.records).join('\n')).toContain('TERMINAL CHAOS')
  })

  it('draws once per frame', async () => {
    await mount()
    await frame()
    const once = ctx.records.length
    expect(once).toBeGreaterThan(0)
    ctx.reset()
    await frame()
    expect(ctx.records.length).toBe(once)
  })

  it('draws the new screen after the state changes', async () => {
    await mount()
    await frame()
    game.state = makeState('paused')
    ctx.reset()
    await frame()
    expect(textsOf(ctx.records).join('\n')).toContain('PAUSED')
  })
})

describe('GameView loop and input', () => {
  it('requests a frame on mount and calls update(input.frame(), STEP_MS) once per step', async () => {
    await mount()
    expect(clock.hasPending()).toBe(true)
    expect(game.update).not.toHaveBeenCalled()
    await frame(1)
    expect(game.update).toHaveBeenCalledTimes(1)
    const [fi, dt] = game.update.mock.calls[0]
    expect(dt).toBeCloseTo(STEP_MS, 6)
    expect(fi.held).toBeInstanceOf(Set)
    expect(fi.pressed).toBeInstanceOf(Set)
    await frame(3)
    expect(game.update).toHaveBeenCalledTimes(4)
  })

  it('goes through the engine loop: a long gap runs at most 5 steps', async () => {
    await mount()
    await frame(100)
    expect(game.update).toHaveBeenCalledTimes(5)
  })

  it('keeps asking for frames', async () => {
    await mount()
    await frame()
    expect(clock.hasPending()).toBe(true)
    await frame()
    expect(clock.hasPending()).toBe(true)
  })

  it('sends window keyboard input to the game', async () => {
    await mount()
    fireEvent.keyDown(window, { code: 'ArrowRight' })
    await frame()
    expect(game.calls[0].held.has('right')).toBe(true)
    expect(game.calls[0].pressed.has('right')).toBe(true)
    await frame()
    expect(game.calls[1].held.has('right')).toBe(true)
    expect(game.calls[1].pressed.has('right')).toBe(false)
    fireEvent.keyUp(window, { code: 'ArrowRight' })
    await frame()
    expect(game.calls[2].held.has('right')).toBe(false)
  })

  it('maps other keys too', async () => {
    await mount()
    fireEvent.keyDown(window, { code: 'KeyJ' })
    fireEvent.keyDown(window, { code: 'Enter' })
    await frame()
    expect([...game.calls[0].pressed].sort()).toEqual(['echo', 'start'])
  })

  it('sends touch buttons to the same input', async () => {
    await mount()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Jump' }))
    await frame()
    expect(game.calls[0].held.has('jump')).toBe(true)
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Jump' }))
    await frame()
    expect(game.calls[1].held.has('jump')).toBe(false)
  })

  it('updates the Hud from game.state after a frame', async () => {
    await mount()
    expect(screen.getByTestId('tc-status').textContent).toContain('Press Enter')
    game.state = makeState('playing', { score: 120, world: makeWorld() })
    await frame()
    expect(screen.getByTestId('tc-status').textContent.trim()).toBe('Level 1: The Editor · Coffee 3/3 · Score 120')
  })
})

describe('GameView audio', () => {
  it('constructs no AudioContext before a gesture', async () => {
    await mount()
    await frame(3)
    expect(audio.instances.length).toBe(0)
  })

  it('unlocks once on the first keydown', async () => {
    await mount()
    fireEvent.keyDown(window, { code: 'KeyZ' })
    expect(audio.instances.length).toBe(1)
    fireEvent.keyDown(window, { code: 'Enter' })
    fireEvent.pointerDown(document.body)
    expect(audio.instances.length).toBe(1)
  })

  it('unlocks once on the first pointerdown', async () => {
    const { container } = await mount()
    fireEvent.pointerDown(container.querySelector('canvas'))
    expect(audio.instances.length).toBe(1)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Jump' }))
    fireEvent.keyDown(window, { code: 'Enter' })
    expect(audio.instances.length).toBe(1)
  })

  it('stays silent while muted: sfx events make no nodes', async () => {
    await mount()
    fireEvent.keyDown(window, { code: 'KeyZ' })
    const before = audio.nodeCount()
    game.queue([{ type: 'sfx', name: 'jump' }])
    await frame()
    expect(audio.nodeCount()).toBe(before)
  })

  it('plays an sfx event after a mute event turns sound on', async () => {
    await mount()
    fireEvent.keyDown(window, { code: 'KeyZ' })
    game.queue([{ type: 'mute', muted: false }])
    await frame()
    const before = audio.startedSources().length
    game.queue([{ type: 'sfx', name: 'jump' }])
    await frame()
    expect(audio.startedSources().length).toBeGreaterThan(before)
  })

  it('goes quiet on a mute event with muted:true', async () => {
    await mount()
    fireEvent.keyDown(window, { code: 'KeyZ' })
    game.queue([{ type: 'mute', muted: false }])
    await frame()
    game.queue([{ type: 'mute', muted: true }])
    await frame()
    const before = audio.nodeCount()
    game.queue([{ type: 'sfx', name: 'hurt' }])
    await frame()
    expect(audio.nodeCount()).toBe(before)
  })

  it('applies a remembered unmuted state from game.state at start', async () => {
    await mount({ state: makeState('title', { muted: false }) })
    fireEvent.keyDown(window, { code: 'KeyZ' })
    game.queue([{ type: 'sfx', name: 'jump' }])
    await frame()
    expect(audio.startedSources().length).toBeGreaterThan(0)
  })

  it('plays every sfx event in a frame', async () => {
    await mount({ state: makeState('title', { muted: false }) })
    fireEvent.keyDown(window, { code: 'KeyZ' })
    game.queue([{ type: 'sfx', name: 'jump' }, { type: 'sfx', name: 'collect' }])
    await frame()
    expect(audio.startedSources().length).toBeGreaterThanOrEqual(2)
  })

  it('ignores events it does not know', async () => {
    await mount({ state: makeState('title', { muted: false }) })
    fireEvent.keyDown(window, { code: 'KeyZ' })
    const before = audio.nodeCount()
    game.queue([{ type: 'kill', kind: 'bug', score: 10 }, { type: 'checkpoint' }])
    await frame()
    expect(audio.nodeCount()).toBe(before)
  })

  it('starts the level music on a playing screen event and stops it on the title', async () => {
    await mount({ state: makeState('title', { muted: false }) })
    fireEvent.keyDown(window, { code: 'KeyZ' })
    game.state = makeState('playing', { muted: false, world: makeWorld({ theme: 'ci' }) })
    game.queue([{ type: 'screen', screen: 'playing' }])
    await frame()
    const started = audio.startedSources()
    expect(started.length).toBeGreaterThan(0)
    game.state = makeState('title', { muted: false })
    game.queue([{ type: 'screen', screen: 'title' }])
    await frame()
    const t = audio.ctx.currentTime
    for (const s of started) expect(s.disconnects > 0 || (s.stops.length > 0 && s.stops.at(-1) <= t + 0.05)).toBe(true)
  })
})

describe('GameView auto pause', () => {
  it('presses pause when the tab is hidden while playing', async () => {
    await mount({ state: makeState('playing') })
    hide(true)
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(true)
  })

  it('presses pause when the window loses focus while playing', async () => {
    await mount({ state: makeState('playing') })
    fireEvent.blur(window)
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(true)
  })

  it('does not pause when the tab becomes visible again', async () => {
    await mount({ state: makeState('playing') })
    hide(false)
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(false)
  })

  it.each(['title', 'paused', 'level-complete', 'victory'])('does not press pause on blur or hide in the %s screen', async (screenName) => {
    await mount({ state: makeState(screenName) })
    hide(true)
    fireEvent.blur(window)
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(false)
  })

  it('checks the screen at the time of the event', async () => {
    await mount({ state: makeState('title') })
    game.state = makeState('playing')
    fireEvent.blur(window)
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(true)
  })

  it('presses pause once for a blur and a hide in the same frame', async () => {
    await mount({ state: makeState('playing') })
    fireEvent.blur(window)
    hide(true)
    await frame()
    expect(game.calls[0].pressed.has('pause')).toBe(true)
    await frame()
    expect(game.calls[1].pressed.has('pause')).toBe(false)
  })
})

describe('GameView unmount', () => {
  it('cancels the pending frame and stops updating', async () => {
    const { unmount } = await mount()
    await frame()
    const id = clock.pendingId()
    expect(id).not.toBeNull()
    unmount()
    expect(clock.cancelled).toContain(id)
    expect(clock.hasPending()).toBe(false)
    const n = game.update.mock.calls.length
    clock.advance(STEP_MS * 3)
    expect(game.update.mock.calls.length).toBe(n)
  })

  it('stops hearing the keyboard', async () => {
    const { unmount } = await mount()
    unmount()
    fireEvent.keyDown(window, { code: 'Enter' })
    expect(audio.instances.length).toBe(0)
  })

  it('removes every window and document listener it added', async () => {
    const adds = []
    const removes = []
    const cap = (o) => (typeof o === 'boolean' ? o : !!(o && o.capture))
    const names = new Map([[window, 'window'], [document, 'document']])
    for (const target of [window, document]) {
      const add = target.addEventListener.bind(target)
      const rem = target.removeEventListener.bind(target)
      vi.spyOn(target, 'addEventListener').mockImplementation((type, fn, o) => {
        adds.push({ t: names.get(target), type, fn, capture: cap(o) })
        return add(type, fn, o)
      })
      vi.spyOn(target, 'removeEventListener').mockImplementation((type, fn, o) => {
        removes.push({ t: names.get(target), type, fn, capture: cap(o) })
        return rem(type, fn, o)
      })
    }
    const { unmount } = await mount()
    fireEvent.keyDown(window, { code: 'KeyZ' }) // an unlock listener may be added or removed here
    unmount()

    const own = adds.filter((a) => !(a.t === 'document' && a.type === 'selectionchange'))
    const seen = (t, type) => own.some((a) => a.t === t && a.type === type)
    // Not vacuous: the game listens for these.
    expect(seen('window', 'keydown')).toBe(true)
    expect(seen('window', 'keyup')).toBe(true)
    expect(seen('window', 'blur')).toBe(true)
    expect(seen('document', 'visibilitychange')).toBe(true)

    const left = [...own]
    for (const r of removes) {
      const i = left.findIndex((a) => a.t === r.t && a.type === r.type && a.fn === r.fn && a.capture === r.capture)
      if (i >= 0) left.splice(i, 1)
    }
    expect(left.map((a) => `${a.t}:${a.type}`)).toEqual([])
  })

  it('stops the music on unmount', async () => {
    const { unmount } = await mount({ state: makeState('title', { muted: false }) })
    fireEvent.keyDown(window, { code: 'KeyZ' })
    game.state = makeState('playing', { muted: false, world: makeWorld({ theme: 'editor' }) })
    game.queue([{ type: 'screen', screen: 'playing' }])
    await frame()
    expect(audio.startedSources().length).toBeGreaterThan(0)
    unmount()
    const nodes = audio.nodeCount()
    const t = audio.ctx.currentTime
    for (const s of audio.startedSources()) expect(s.disconnects > 0 || (s.stops.length > 0 && s.stops.at(-1) <= t + 0.05)).toBe(true)
    audio.advance(10)
    vi.advanceTimersByTime(10000)
    expect(audio.nodeCount()).toBe(nodes)
  })
})
