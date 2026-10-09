import { describe, it, expect, vi } from 'vitest'
import { createLoop } from '../../../src/game/engine/loop.js'
import { STEP_MS } from '../../../src/game/constants.js'
import { createFrameClock } from '../helpers/frame-clock.js'

function build(step, render) {
  const clock = createFrameClock(1000)
  const loop = createLoop({
    step,
    render,
    now: clock.now,
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
  })
  return { clock, loop }
}

describe('createLoop: pause() from inside step()', () => {
  it('runs no further steps, renders alpha in [0,1) while paused, and resumes with one step', () => {
    let loop
    const step = vi.fn(() => loop.pause())
    const render = vi.fn()
    const built = build(step, render)
    loop = built.loop
    const { clock } = built
    loop.start()

    // Three steps are due, but the first one pauses the loop.
    clock.advance(STEP_MS * 3)
    expect(step).toHaveBeenCalledTimes(1)
    expect(loop.isPaused()).toBe(true)

    clock.advance(STEP_MS * 2)
    clock.advance(STEP_MS * 2)
    expect(step).toHaveBeenCalledTimes(1)

    expect(render.mock.calls.length).toBeGreaterThanOrEqual(3)
    for (const [alpha] of render.mock.calls) {
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThan(1)
    }

    loop.resume()
    step.mockClear()
    render.mockClear()
    step.mockImplementation(() => {})
    clock.advance(STEP_MS * 1.5)
    expect(step).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBeCloseTo(0.5, 5)
  })
})

describe('createLoop: a throwing callback stops the loop', () => {
  it('step() throwing propagates, leaves no frame pending, and start() runs again', () => {
    const step = vi.fn(() => {
      throw new Error('boom-step')
    })
    const render = vi.fn()
    const { clock, loop } = build(step, render)
    loop.start()
    expect(() => clock.advance(STEP_MS * 1.5)).toThrow('boom-step')
    expect(step).toHaveBeenCalledTimes(1)
    expect(render).not.toHaveBeenCalled()
    expect(clock.hasPending()).toBe(false)

    step.mockImplementation(() => {})
    loop.start()
    expect(clock.hasPending()).toBe(true)
    clock.advance(STEP_MS * 1.5)
    expect(step).toHaveBeenCalledTimes(2)
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBeCloseTo(0.5, 5)
    expect(clock.hasPending()).toBe(true)
  })

  it('render() throwing propagates, leaves no frame pending, and start() runs again', () => {
    const step = vi.fn()
    const render = vi.fn(() => {
      throw new Error('boom-render')
    })
    const { clock, loop } = build(step, render)
    loop.start()
    expect(() => clock.advance(STEP_MS * 1.5)).toThrow('boom-render')
    expect(step).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledTimes(1)
    expect(clock.hasPending()).toBe(false)

    render.mockImplementation(() => {})
    loop.start()
    expect(clock.hasPending()).toBe(true)
    clock.advance(STEP_MS * 1.5)
    expect(step).toHaveBeenCalledTimes(2)
    expect(render).toHaveBeenCalledTimes(2)
    expect(clock.hasPending()).toBe(true)
  })
})
