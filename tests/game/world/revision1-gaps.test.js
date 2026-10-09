// Revision 1, part B: tests that pin S1's own additions (they pass against the
// current code). Each one fails if the named review mutation (Mxx) is applied.
import { describe, it, expect } from 'vitest'
import {
  createWorld, stepWorld, INVULN_MS, BOSS_MAX_HP, CRUSHER_CYCLE_MS,
} from '../../../src/game/world/index.js'
import { STEP_MS, TILE, VIEW_W, VIEW_H, MAX_COFFEE } from '../../../src/game/constants.js'
import {
  makeKit, draw, hold, tap, ofType, nonSfx, alive, byKind, bossOf, isAlive, place, onto,
} from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })
const ARENA = draw(30, 12, [[3, 9, 'P'], [14, 8, 'B']])
const BOSS_DEF = { id: 'boss', theme: 'boss', power: null, tokenKinds: [], tokensRequired: 0 }
const ALL = { powers: { echo: true, sudo: true, rmrf: true } }

const safeStep = (w, input) => {
  w.player.sudoMs = 1e9
  return kit.step(w, input)
}

// A bug ticket thrown by hand: the same entity the boss throws.
function pushTicket(w, x, y, vx) {
  const t = {
    id: 9000 + w.entities.length, kind: 'bossProjectile', variant: 'ticket', x, y, w: 10, h: 10,
    vx, vy: 0, alive: true, onGround: false, lifeMs: 10000,
  }
  w.entities.push(t)
  return t
}

describe('respawn grace (M27)', () => {
  it('respawns with invulnMs about INVULN_MS', () => {
    const w = kit.make(draw(30, 12, [[3, 9, 'P'], [10, 9, '^']]))
    w.player.coffee = 1
    place(w, 10 * TILE + 2, 9 * TILE + 2)
    let ev = kit.step(w)
    expect(ofType(ev, 'died')).toHaveLength(1)
    for (let i = 0; i < 120 && !ofType(ev, 'respawn').length; i++) ev = kit.step(w)
    expect(ofType(ev, 'respawn')).toHaveLength(1)
    expect(w.player.invulnMs).toBeGreaterThan(INVULN_MS - 2 * STEP_MS)
    expect(w.player.invulnMs).toBeLessThanOrEqual(INVULN_MS)
  })
})

describe('the rng drives the boss (M17)', () => {
  function ticketSpeeds(seed) {
    const w = kit.make(ARENA, BOSS_DEF, { seed, powers: ALL.powers })
    const speeds = []
    const seen = new Set()
    for (let i = 0; i < 500; i++) {
      safeStep(w)
      for (const e of alive(w, 'bossProjectile')) {
        if (e.variant === 'ticket' && !seen.has(e.id)) {
          seen.add(e.id)
          speeds.push(e.vx)
        }
      }
    }
    return speeds
  }

  it('gives different ticket speeds for different seeds, and the same for the same seed', () => {
    const a = ticketSpeeds(1)
    expect(a.length).toBeGreaterThanOrEqual(3)
    expect(ticketSpeeds(1)).toEqual(a)
    expect(ticketSpeeds(2)).not.toEqual(a)
  })
})

describe('camera keeps the player in view (M28)', () => {
  const inView = (w) => {
    const c = w.camera
    const p = w.player
    return c.x <= p.x && c.x + VIEW_W >= p.x + p.w && c.y <= p.y && c.y + VIEW_H >= p.y + p.h
  }

  it('after a teleport, on the very next step', () => {
    const w = kit.make(draw(80, 30, [[3, 27, 'P']]))
    kit.settle(w, 30)
    place(w, 70 * TILE, 10 * TILE)
    kit.step(w)
    expect(inView(w)).toBe(true)
    place(w, 5 * TILE, 27 * TILE)
    kit.step(w)
    expect(inView(w)).toBe(true)
  })

  it('while running and jumping across a wide map', () => {
    const w = kit.make(draw(80, 12, [[3, 9, 'P']]))
    for (let i = 0; i < 500; i++) {
      kit.step(w, i % 40 === 0 ? tap('right', 'jump') : hold('right'))
      expect(inView(w)).toBe(true)
    }
    expect(w.player.x).toBeGreaterThan(60 * TILE)
  })
})

describe('touching the boss (M29)', () => {
  it('costs a coffee', () => {
    const w = kit.make(ARENA, BOSS_DEF)
    onto(w, bossOf(w))
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: MAX_COFFEE - 1 }])
    expect(bossOf(w).hp).toBe(BOSS_MAX_HP)
  })
})

describe('knockback (M31)', () => {
  const rows = draw(30, 12, [[3, 9, 'P'], [20, 9, 'b']])
  function hitFrom(side) {
    const w = kit.make(rows)
    const bug = alive(w, 'bug')[0]
    const bugCx = bug.x + bug.w / 2
    place(w, bugCx - 6 + side * 4, bug.y + bug.h - 14)
    return { w, ev: kit.step(w) }
  }

  it('pushes the player away from what hit him (bug on the right -> pushed left)', () => {
    const { w, ev } = hitFrom(-1)
    expect(ofType(ev, 'hurt')).toHaveLength(1)
    expect(w.player.vx).toBeLessThan(0)
    const x0 = w.player.x
    kit.run(w, 6)
    expect(w.player.x).toBeLessThan(x0 - 5)
  })

  it('pushes the other way when the attacker is on the left', () => {
    const { w, ev } = hitFrom(1)
    expect(ofType(ev, 'hurt')).toHaveLength(1)
    expect(w.player.vx).toBeGreaterThan(0)
    const x0 = w.player.x
    kit.run(w, 6)
    expect(w.player.x).toBeGreaterThan(x0 + 5)
  })

  it('ignores steering for a moment (holding toward the attacker does not cancel it)', () => {
    const { w } = hitFrom(-1)
    const x0 = w.player.x
    kit.run(w, 6, hold('right'))
    expect(w.player.x).toBeLessThan(x0)
  })
})

describe('minion cap (M32)', () => {
  it.each([[1, 1], [2, 2], [3, 3]])('in phase %i at most %i minion bugs hatch', (phase, cap) => {
    const w = kit.make(ARENA, BOSS_DEF, ALL)
    bossOf(w).phase = phase
    for (let k = 0; k < 6; k++) {
      pushTicket(w, 0, 3 * TILE + k * 16, -110) // flush against the left map edge
    }
    safeStep(w)
    const minions = alive(w, 'bug').filter((b) => b.minion)
    expect(minions).toHaveLength(cap)
  })
})

describe('meeting invite under sudo (M35)', () => {
  it('is declined: no freeze, no event, and the invite is consumed', () => {
    const w = kit.make(draw(40, 12, [[2, 9, 'P'], [20, 5, 'i']]))
    const invite = byKind(w, 'meetingInvite')[0]
    w.player.sudoMs = 1000
    onto(w, invite)
    const ev = kit.step(w)
    expect(ofType(ev, 'frozen')).toEqual([])
    expect(w.player.frozenMs).toBe(0)
    expect(isAlive(w, invite.id)).toBe(false)
  })
})

describe('echo point-blank into a wall (M36)', () => {
  it('never puts a shot beyond the wall', () => {
    const rows = draw(30, 12, [[3, 9, 'P'], [4, 8, '#'], [4, 9, '#'], [7, 9, 'b']])
    const w = kit.make(rows, {}, { powers: { echo: true } })
    kit.settle(w, 5)
    place(w, 4 * TILE - 12, 9 * TILE + 2) // flush against the wall
    w.player.facing = 1
    const bug = alive(w, 'bug')[0]
    const ev = [...kit.step(w, tap('echo'))]
    for (let i = 0; i < 60; i++) {
      for (const s of alive(w, 'projectile')) expect(s.x + s.w).toBeLessThanOrEqual(4 * TILE + 0.01)
      ev.push(...kit.step(w))
    }
    expect(ofType(ev, 'kill')).toEqual([])
    expect(isAlive(w, bug.id)).toBe(true)
  })
})

describe('crusher slam (M37)', () => {
  it('comes all the way down to the floor', () => {
    const w = kit.make(draw(30, 12, [[3, 9, 'P'], [15, 5, 'x']])) // floor top at y = 160
    const c = byKind(w, 'crusher')[0]
    let lowest = 0
    for (let i = 0; i < Math.round(CRUSHER_CYCLE_MS / STEP_MS) + 2; i++) {
      kit.step(w)
      lowest = Math.max(lowest, c.y + c.h)
    }
    expect(lowest).toBeCloseTo(10 * TILE, 0)
  })
})

describe('a defeated boss (M10, M33)', () => {
  it('lets echo shots fly straight through him', () => {
    const w = kit.make(ARENA, BOSS_DEF, ALL)
    kit.settle(w, 30)
    const boss = bossOf(w)
    boss.hp = 1
    boss.phase = 3
    for (let i = 0; i < 40 && !boss.defeated; i++) {
      for (let k = 0; k < 600 && boss.onCall; k++) safeStep(w)
      kit.fireAt(w, boss, { safe: true })
    }
    expect(boss.defeated).toBe(true)
    // Fire again: the shot must be seen on the far side of him.
    const p = w.player
    p.cooldowns.echo = 0
    place(w, boss.x - 60, boss.y + boss.h - p.h)
    p.facing = 1
    p.sudoMs = 1e9
    const ev = [...kit.step(w, tap('echo'))]
    const shot = alive(w, 'projectile')[0]
    expect(shot).toBeDefined()
    let farthest = shot.x + shot.w
    for (let i = 0; i < 40 && isAlive(w, shot.id); i++) {
      ev.push(...safeStep(w))
      if (isAlive(w, shot.id)) farthest = Math.max(farthest, shot.x + shot.w)
    }
    expect(farthest).toBeGreaterThan(boss.x + boss.w + 4)
    expect(ofType(ev, 'boss-hit')).toEqual([])
    expect(boss.hp).toBe(0)
  })
})
