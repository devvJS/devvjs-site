import { describe, it, expect, afterEach, vi } from 'vitest'
import { createWorld, stepWorld } from '../../../src/game/world/index.js'
import { createRng } from '../../../src/game/engine/rng.js'
import { STEP_MS } from '../../../src/game/constants.js'
import { draw, strip } from '../helpers/s1-world.js'

const ALL = { echo: true, sudo: true, rmrf: true }

const BUSY = draw(40, 12, [
  [2, 9, 'P'], [6, 9, 't'], [8, 9, 't'], [10, 9, 'b'], [14, 9, 'm'], [18, 9, 'f'], [24, 9, 'i'],
  [30, 3, 'x'], [26, 2, 'a'], [20, 9, 'C'], [36, 9, 'E'], [12, 9, '^'],
])
const BOSS_ROWS = draw(30, 12, [[3, 9, 'P'], [14, 8, 'B']])

const BUSY_DEF = { id: 'busy', name: 'Busy', theme: 'ci', rows: BUSY, power: 'echo', tokenKinds: ['a', 'b'], tokensRequired: 2 }
const BOSS_DEF = { id: 'boss', name: 'Boss', theme: 'boss', rows: BOSS_ROWS, power: null, tokenKinds: [], tokensRequired: 0 }

// A reproducible input script: the same seed always gives the same frames.
function script(seed, n) {
  const r = createRng(seed)
  return Array.from({ length: n }, (_, i) => {
    const held = new Set()
    const pressed = new Set()
    const roll = r.next()
    if (roll < 0.6) held.add('right')
    else if (roll < 0.8) held.add('left')
    if (r.next() < 0.08) { held.add('jump'); pressed.add('jump') }
    if (i === 0 || r.next() < 0.05) { held.add('echo'); pressed.add('echo') }
    if (r.next() < 0.01) { held.add('sudo'); pressed.add('sudo') }
    if (r.next() < 0.01) { held.add('rmrf'); pressed.add('rmrf') }
    return { held, pressed }
  })
}

function play(def, seed, inputSeed, n) {
  const world = createWorld(def, { seed, powers: { ...ALL } })
  const events = []
  const thrown = new Set()
  for (const frame of script(inputSeed, n)) {
    events.push(stepWorld(world, frame, STEP_MS))
    for (const e of world.entities) if (e.kind === 'bossProjectile') thrown.add(e.id)
  }
  return { world, events, thrown }
}

afterEach(() => vi.restoreAllMocks())

describe('determinism', () => {
  it('the same seed and input script give identical worlds and event streams (busy level)', () => {
    const a = play(BUSY_DEF, 5, 99, 900)
    const b = play(BUSY_DEF, 5, 99, 900)
    expect(strip(a.world)).toEqual(strip(b.world))
    expect(a.events).toEqual(b.events)
    expect(a.world.time).toBeCloseTo(900 * STEP_MS, 6)
    // The run did something: the player moved and powers were used.
    expect(a.events.flat().some((e) => e.type === 'power-used')).toBe(true)
    expect(a.world.player.x).not.toBe(createWorld(BUSY_DEF, { seed: 5 }).player.x)
  })

  it('the same seed and input script give identical worlds and event streams (boss level)', () => {
    const a = play(BOSS_DEF, 11, 7, 1800)
    const b = play(BOSS_DEF, 11, 7, 1800)
    expect(strip(a.world)).toEqual(strip(b.world))
    expect(a.events).toEqual(b.events)
    expect(a.events.flat().some((e) => e.type === 'power-used')).toBe(true)
    // 30 s of boss time: he threw several projectiles.
    expect(a.thrown.size).toBeGreaterThanOrEqual(3)
  })

  it('simulates without reading Math.random() or Date.now()', () => {
    const random = vi.spyOn(Math, 'random')
    const now = vi.spyOn(Date, 'now')
    play(BUSY_DEF, 3, 1, 300)
    play(BOSS_DEF, 3, 2, 600)
    expect(random).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })
})
