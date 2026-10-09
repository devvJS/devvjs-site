import { describe, it, expect, vi } from 'vitest'
import { stepBody, groundTileUnder } from '../../../src/game/engine/physics.js'
import { createLoop } from '../../../src/game/engine/loop.js'
import { createInput, bindKeyboard } from '../../../src/game/engine/input.js'
import { STEP_MS, RUN_SPEED } from '../../../src/game/constants.js'
import { mapOf, bodyAt, rep } from '../helpers/maps.js'

// Push into an obstacle with vx re-set EVERY step, for 120 steps.
function pushFor(body, map, vx) {
  const xs = []
  for (let i = 0; i < 120; i++) {
    body.vx = vx
    stepBody(body, map, STEP_MS)
    xs.push(body.x)
  }
  return xs
}

describe('pushing into walls every step stays flush', () => {
  const floor = '##########'
  it('right interior wall', () => {
    const map = mapOf(['P.........', '..........', '..........', '.....#....', '.....#....', floor])
    const b = bodyAt(40, 66)
    const xs = pushFor(b, map, RUN_SPEED)
    expect(Math.max(...xs)).toBeLessThanOrEqual(80 - b.w + 1e-6)
    expect(xs.at(-1)).toBeCloseTo(68, 5)
    expect(xs.slice(-30).every((x) => Math.abs(x - 68) < 1e-6)).toBe(true)
  })

  it('right map edge', () => {
    const map = mapOf(['P.........', ...rep('..........', 4), floor])
    const b = bodyAt(100, 66)
    const xs = pushFor(b, map, RUN_SPEED)
    expect(Math.max(...xs)).toBeLessThanOrEqual(160 - b.w + 1e-6)
    expect(xs.at(-1)).toBeCloseTo(148, 5)
  })

  it('left interior wall', () => {
    const map = mapOf(['P.........', '..........', '..........', '..#.......', '..#.......', floor])
    const b = bodyAt(100, 66)
    const xs = pushFor(b, map, -RUN_SPEED)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(48 - 1e-6)
    expect(xs.at(-1)).toBeCloseTo(48, 5)
    expect(xs.slice(-30).every((x) => Math.abs(x - 48) < 1e-6)).toBe(true)
  })

  it('left map edge', () => {
    const map = mapOf(['P.........', ...rep('..........', 4), floor])
    const b = bodyAt(60, 66)
    const xs = pushFor(b, map, -RUN_SPEED)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1e-6)
    expect(xs.at(-1)).toBeCloseTo(0, 5)
  })
})

describe('loop resume after a pause with no frames (hidden tab)', () => {
  it('runs exactly one step for a 1.2-step frame after resume', () => {
    let t = 1000
    let pending = null
    const step = vi.fn()
    const render = vi.fn()
    const loop = createLoop({
      step,
      render,
      now: () => t,
      requestFrame: (cb) => { pending = cb; return 1 },
      cancelFrame: () => { pending = null },
    })
    const fire = () => { const cb = pending; pending = null; cb(t) }
    loop.start()
    t += STEP_MS * 1.5
    fire()
    expect(step).toHaveBeenCalledTimes(1)
    loop.pause()
    t += 2000 // hidden tab: the clock moves but no frame fires
    loop.resume()
    t += STEP_MS * 1.2
    fire()
    expect(step).toHaveBeenCalledTimes(2)
  })
})

describe('bindKeyboard with modifier keys', () => {
  const key = (type, code, extra = {}) => {
    const e = new Event(type, { cancelable: true })
    e.code = code
    e.repeat = false
    return Object.assign(e, extra)
  }

  it.each(['ctrlKey', 'altKey', 'metaKey'])('ignores a mapped keydown with %s', (mod) => {
    const target = new EventTarget()
    const input = createInput()
    bindKeyboard(target, input)
    const down = key('keydown', 'KeyA', { [mod]: true })
    target.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    const f = input.frame()
    expect([...f.pressed]).toEqual([])
    expect([...f.held]).toEqual([])
  })

  it.each(['ctrlKey', 'altKey', 'metaKey'])('a keyup with %s still releases', (mod) => {
    const target = new EventTarget()
    const input = createInput()
    bindKeyboard(target, input)
    target.dispatchEvent(key('keydown', 'KeyA'))
    expect([...input.frame().held]).toEqual(['left'])
    target.dispatchEvent(key('keyup', 'KeyA', { [mod]: true }))
    expect([...input.frame().held]).toEqual([])
  })
})

describe('groundTileUnder with one foot on a tile', () => {
  it('finds a SOLID tile under the left foot when the middle column is EMPTY', () => {
    const map = mapOf(['P.', '..', '#.'])
    expect(groundTileUnder(bodyAt(10, 32 - 14), map)).toBe(1)
  })

  it('finds a SOLID tile under the right foot when the middle column is EMPTY', () => {
    const map = mapOf(['P.', '..', '.#'])
    expect(groundTileUnder(bodyAt(6, 32 - 14), map)).toBe(1)
  })
})
