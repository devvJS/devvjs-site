import { describe, it, expect, vi } from 'vitest'
import { createLoop } from '../../../src/game/engine/loop.js'
import { STEP_MS } from '../../../src/game/constants.js'
import { createFrameClock } from '../helpers/frame-clock.js'

function setup() {
  const clock = createFrameClock(1000)
  const step = vi.fn()
  const render = vi.fn()
  const loop = createLoop({
    step,
    render,
    now: clock.now,
    requestFrame: clock.requestFrame,
    cancelFrame: clock.cancelFrame,
  })
  return { clock, step, render, loop }
}

describe('createLoop', () => {
  it('start() requests a frame and does nothing else yet', () => {
    const { clock, step, render, loop } = setup()
    expect(loop.isPaused()).toBe(false)
    loop.start()
    expect(clock.requested).toHaveLength(1)
    expect(step).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('runs whole fixed steps from the accumulator and renders once with the remainder as alpha', () => {
    const { clock, step, render, loop } = setup()
    loop.start()
    clock.advance(STEP_MS * 2.5)
    expect(step).toHaveBeenCalledTimes(2)
    for (const call of step.mock.calls) expect(call).toEqual([STEP_MS])
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBeCloseTo(0.5, 5)
  })

  it('carries the remainder over to the next frame', () => {
    const { clock, step, render, loop } = setup()
    loop.start()
    clock.advance(STEP_MS * 2.5)
    clock.advance(STEP_MS * 0.6)
    expect(step).toHaveBeenCalledTimes(3)
    expect(render).toHaveBeenCalledTimes(2)
    expect(render.mock.calls[1][0]).toBeCloseTo(0.1, 5)
  })

  it('a frame shorter than one step renders but does not step', () => {
    const { clock, step, render, loop } = setup()
    loop.start()
    clock.advance(STEP_MS * 0.4)
    expect(step).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
    expect(render.mock.calls[0][0]).toBeCloseTo(0.4, 5)
  })

  it('requests the next frame after every frame', () => {
    const { clock, loop } = setup()
    loop.start()
    clock.advance(STEP_MS)
    clock.advance(STEP_MS)
    expect(clock.requested).toHaveLength(3)
    expect(clock.hasPending()).toBe(true)
  })

  it('caps a huge gap at 5 steps per frame and drops the rest', () => {
    const { clock, step, render, loop } = setup()
    loop.start()
    clock.advance(10000)
    expect(step).toHaveBeenCalledTimes(5)
    expect(render).toHaveBeenCalledTimes(1)
    const alpha = render.mock.calls[0][0]
    expect(alpha).toBeGreaterThanOrEqual(0)
    expect(alpha).toBeLessThan(1)
    // The dropped time is gone: a short frame afterwards makes no catch-up steps.
    clock.advance(STEP_MS * 0.3)
    expect(step).toHaveBeenCalledTimes(5)
    const alpha2 = render.mock.calls[1][0]
    expect(alpha2).toBeGreaterThanOrEqual(0)
    expect(alpha2).toBeLessThan(1)
  })

  it('exactly 5 steps worth of time runs 5 steps', () => {
    const { clock, step, loop } = setup()
    loop.start()
    clock.advance(STEP_MS * 5.5)
    expect(step).toHaveBeenCalledTimes(5)
  })

  it('pause() stops stepping but keeps rendering, and the accumulator stays empty', () => {
    const { clock, step, render, loop } = setup()
    loop.start()
    loop.pause()
    expect(loop.isPaused()).toBe(true)
    clock.advance(STEP_MS * 10)
    clock.advance(STEP_MS * 10)
    expect(step).not.toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(2)
    for (const [alpha] of render.mock.calls) {
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThan(1)
    }
    loop.resume()
    expect(loop.isPaused()).toBe(false)
    // No burst of catch-up steps for the paused time: 1.5 steps of new time is 1 step.
    clock.advance(STEP_MS * 1.5)
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('stop() cancels the pending frame and nothing runs afterwards', () => {
    const { clock, step, render, loop } = setup()
    loop.start()
    clock.advance(STEP_MS)
    const pendingId = clock.pendingId()
    const stale = clock.capturePending()
    loop.stop()
    expect(clock.cancelled).toEqual([pendingId])
    expect(clock.hasPending()).toBe(false)
    const stepsBefore = step.mock.calls.length
    const rendersBefore = render.mock.calls.length
    // Even a stale callback that was already queued must not run the game.
    stale.cb(clock.time() + STEP_MS * 3)
    expect(step).toHaveBeenCalledTimes(stepsBefore)
    expect(render).toHaveBeenCalledTimes(rendersBefore)
    expect(clock.hasPending()).toBe(false)
  })
})
