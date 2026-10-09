import { describe, it, expect } from 'vitest'
import {
  createWorld, stepWorld, INVULN_MS, RESPAWN_MS, FLAKY_MS,
} from '../../../src/game/world/index.js'
import { STEP_MS, TILE, MAX_COFFEE } from '../../../src/game/constants.js'
import {
  makeKit, draw, hold, tap, ofType, nonSfx, sfxNames, alive, byKind, isAlive, place, onto,
} from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })

const SPIKE = draw(30, 12, [[3, 9, 'P'], [10, 9, '^']])
const onSpike = (w) => place(w, 10 * TILE + 2, 9 * TILE + 2)

describe('taking damage', () => {
  it('spikes cost one coffee, emit hurt and sfx hurt, start invulnerability and a camera shake', () => {
    const w = kit.make(SPIKE)
    onSpike(w)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: MAX_COFFEE - 1 }])
    expect(sfxNames(ev)).toContain('hurt')
    expect(w.player.coffee).toBe(2)
    expect(w.player.invulnMs).toBeGreaterThan(INVULN_MS - 2 * STEP_MS)
    expect(w.player.invulnMs).toBeLessThanOrEqual(INVULN_MS)
    expect(w.player.anim).toBe('hurt')
    expect(w.shake).toBeGreaterThan(0)
    expect(w.shake).toBeLessThanOrEqual(1)
    kit.run(w, 130)
    expect(w.shake).toBe(0)
  })

  it('does not hurt again while invulnerable, then hurts again once it runs out', () => {
    const w = kit.make(SPIKE)
    onSpike(w)
    kit.step(w)
    const during = kit.run(w, 50)
    expect(ofType(during, 'hurt')).toEqual([])
    expect(w.player.coffee).toBe(2)
    const after = kit.run(w, 20) // well past 1000 ms in total
    expect(ofType(after, 'hurt')).toEqual([{ type: 'hurt', coffee: 1 }])
    expect(w.player.coffee).toBe(1)
  })

  it('counts invulnMs down by dt per step', () => {
    const w = kit.make(SPIKE)
    w.player.invulnMs = 500
    kit.run(w, 6)
    expect(w.player.invulnMs).toBeCloseTo(500 - 6 * STEP_MS, 3)
  })

  it('takes no damage from spikes while invulnMs > 0', () => {
    const w = kit.make(SPIKE)
    w.player.invulnMs = 500
    onSpike(w)
    expect(kit.run(w, 10)).toEqual([])
    expect(w.player.coffee).toBe(3)
  })

  it('takes no damage from spikes while sudoMs > 0', () => {
    const w = kit.make(SPIKE)
    w.player.sudoMs = 500
    onSpike(w)
    expect(kit.run(w, 10)).toEqual([])
    expect(w.player.coffee).toBe(3)
  })

  it('takes no damage from a bug while invulnerable or under sudo', () => {
    const rows = draw(30, 12, [[3, 9, 'P'], [20, 9, 'b']])
    for (const key of ['invulnMs', 'sudoMs']) {
      const w = kit.make(rows)
      w.player[key] = 500
      onto(w, alive(w, 'bug')[0])
      expect(kit.run(w, 10)).toEqual([])
      expect(w.player.coffee).toBe(3)
    }
  })

  it('a bug costs one coffee on contact', () => {
    const w = kit.make(draw(30, 12, [[3, 9, 'P'], [20, 9, 'b']]))
    onto(w, alive(w, 'bug')[0])
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: 2 }])
    expect(w.player.coffee).toBe(2)
    expect(w.player.invulnMs).toBeGreaterThan(0)
  })

  it('a crusher costs one coffee on contact', () => {
    const w = kit.make(draw(30, 12, [[3, 9, 'P'], [15, 5, 'x']]))
    onto(w, byKind(w, 'crusher')[0])
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: 2 }])
    expect(w.player.coffee).toBe(2)
  })

  it('a flakyTest hurts only while solid', () => {
    const solid = kit.make(draw(30, 12, [[3, 9, 'P'], [15, 9, 'f']]))
    onto(solid, byKind(solid, 'flakyTest')[0])
    expect(nonSfx(kit.step(solid))).toEqual([{ type: 'hurt', coffee: 2 }])

    const w = kit.make(draw(30, 12, [[3, 9, 'P'], [15, 9, 'f']]))
    const flaky = byKind(w, 'flakyTest')[0]
    let guard = 0
    while (flaky.solid && guard++ < Math.ceil(FLAKY_MS / STEP_MS) + 10) kit.step(w)
    expect(flaky.solid).toBe(false)
    const ev = []
    for (let i = 0; i < 20; i++) {
      onto(w, flaky)
      ev.push(...kit.step(w))
    }
    expect(ofType(ev, 'hurt')).toEqual([])
    expect(w.player.coffee).toBe(3)
  })
})

describe('dying and respawning', () => {
  it('at 0 coffee emits hurt then died, and the player is dead and stays put', () => {
    const w = kit.make(SPIKE)
    w.player.coffee = 1
    onSpike(w)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: 0 }, { type: 'died' }])
    expect(w.player.coffee).toBe(0)
    expect(w.player.dead).toBe(true)
    const x0 = w.player.x
    kit.run(w, Math.floor(RESPAWN_MS / STEP_MS / 2), hold('right'))
    expect(w.player.x).toBeCloseTo(x0, 6)
    expect(w.player.dead).toBe(true)
  })

  it('respawns at the start about RESPAWN_MS later with full coffee', () => {
    const w = kit.make(SPIKE)
    const start = { x: w.player.x, y: w.player.y }
    w.player.coffee = 1
    onSpike(w)
    kit.step(w)
    const all = []
    let respawnAt = -1
    for (let i = 1; i < 120 && respawnAt < 0; i++) {
      const ev = kit.step(w)
      all.push(...ev)
      if (ofType(ev, 'respawn').length) respawnAt = i
    }
    const expected = RESPAWN_MS / STEP_MS
    expect(respawnAt).toBeGreaterThanOrEqual(expected - 2)
    expect(respawnAt).toBeLessThanOrEqual(expected + 2)
    expect(nonSfx(all)).toEqual([{ type: 'respawn' }])
    expect(w.player.dead).toBe(false)
    expect(w.player.coffee).toBe(MAX_COFFEE)
    expect(w.player.x).toBeCloseTo(start.x, 6)
    expect(w.player.vx).toBe(0)
    expect(Math.abs(w.player.y - start.y)).toBeLessThan(2)
  })

  describe('falling out of the map', () => {
    const HOLE = draw(30, 12, [[3, 9, 'P'], [10, 10, '....'], [10, 11, '....']])

    it('dies and then respawns at the start with full coffee', () => {
      const w = kit.make(HOLE)
      const start = { x: w.player.x, y: w.player.y }
      w.player.coffee = 2
      place(w, 10 * TILE + 2, 9 * TILE + 2)
      const ev = kit.run(w, 150)
      const types = nonSfx(ev).map((e) => e.type)
      expect(types).toEqual(['died', 'respawn'])
      expect(w.player.coffee).toBe(MAX_COFFEE)
      expect(w.player.dead).toBe(false)
      expect(w.player.x).toBeCloseTo(start.x, 0)
      expect(Math.abs(w.player.y - start.y)).toBeLessThan(2)
    })

    it('dies even while invulnerable or under sudo', () => {
      for (const key of ['invulnMs', 'sudoMs']) {
        const w = kit.make(HOLE)
        w.player[key] = 5000
        place(w, 10 * TILE + 2, 9 * TILE + 2)
        const ev = kit.run(w, 60)
        expect(ofType(ev, 'died')).toHaveLength(1)
      }
    })
  })
})

describe('checkpoints', () => {
  const CP = draw(40, 12, [[2, 9, 'P'], [10, 9, 'C'], [20, 9, 'C'], [30, 9, '^']])

  it('activates on touch (once), emits checkpoint with sfx, and moves the respawn point', () => {
    const w = kit.make(CP)
    const [c1, c2] = byKind(w, 'checkpoint').sort((a, b) => a.x - b.x)
    onto(w, c1)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'checkpoint' }])
    expect(sfxNames(ev)).toContain('checkpoint')
    expect(c1.active).toBe(true)
    expect(c2.active).toBe(false)
    expect(Math.abs(w.checkpoint.x - c1.x)).toBeLessThanOrEqual(TILE)
    expect(Math.abs(w.checkpoint.y - c1.y)).toBeLessThanOrEqual(TILE)
    // Standing on it does not fire again.
    const again = []
    for (let i = 0; i < 10; i++) {
      onto(w, c1)
      again.push(...kit.step(w))
    }
    expect(ofType(again, 'checkpoint')).toEqual([])
    // A second checkpoint fires its own event and takes over.
    onto(w, c2)
    expect(nonSfx(kit.step(w))).toEqual([{ type: 'checkpoint' }])
    expect(c2.active).toBe(true)
    expect(Math.abs(w.checkpoint.x - c2.x)).toBeLessThanOrEqual(TILE)
  })

  it('respawns at the last activated checkpoint', () => {
    const w = kit.make(CP)
    const c2 = byKind(w, 'checkpoint').sort((a, b) => a.x - b.x)[1]
    onto(w, c2)
    kit.step(w)
    const cp = { ...w.checkpoint }
    w.player.coffee = 1
    place(w, 30 * TILE + 2, 9 * TILE + 2)
    const ev = kit.run(w, 120)
    expect(nonSfx(ev).map((e) => e.type)).toEqual(['hurt', 'died', 'respawn'])
    expect(w.player.x).toBeCloseTo(cp.x, 6)
    expect(Math.abs(w.player.y - cp.y)).toBeLessThan(2)
    expect(w.player.coffee).toBe(MAX_COFFEE)
  })
})

describe('enemies and pickups keep their state across a respawn', () => {
  it('keeps kills, collected tokens and enemy positions', () => {
    const rows = draw(60, 12, [[2, 9, 'P'], [4, 9, 't'], [6, 9, 'b'], [30, 9, 'b']])
    const w = kit.make(rows, { power: 'rmrf', tokensRequired: 5 }, { powers: { rmrf: true } })
    kit.settle(w, 5)
    const [near, far] = alive(w, 'bug').sort((a, b) => a.x - b.x)
    const farSpawnX = far.x
    const token = byKind(w, 'token')[0]

    const killEvents = ofType(kit.step(w, tap('rmrf')), 'kill')
    expect(killEvents).toHaveLength(1)
    expect(isAlive(w, near.id)).toBe(false)
    expect(isAlive(w, far.id)).toBe(true)

    onto(w, token)
    kit.step(w)
    expect(w.tokens.collected).toBe(1)
    place(w, 2 * TILE, 9 * TILE + 2)
    kit.run(w, 200)
    const farBefore = far.x
    expect(Math.abs(farBefore - farSpawnX)).toBeGreaterThan(60) // it has been patrolling

    place(w, 2 * TILE, 300) // fall out of the map
    const ev = []
    for (let i = 0; i < 150 && !ofType(ev, 'respawn').length; i++) ev.push(...kit.step(w))
    expect(ofType(ev, 'died')).toHaveLength(1)
    expect(ofType(ev, 'respawn')).toHaveLength(1)

    expect(isAlive(w, near.id)).toBe(false)
    expect(isAlive(w, token.id)).toBe(false)
    expect(w.tokens.collected).toBe(1)
    expect(isAlive(w, far.id)).toBe(true)
    expect(Math.abs(far.x - farBefore)).toBeLessThanOrEqual(35) // continued, not reset to its spawn
    expect(Math.abs(far.x - farSpawnX)).toBeGreaterThan(40)
    const xNow = far.x
    kit.run(w, 30)
    expect(Math.abs(far.x - xNow)).toBeGreaterThan(5)
  })
})
