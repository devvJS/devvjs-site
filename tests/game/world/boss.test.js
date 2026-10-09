import { describe, it, expect } from 'vitest'
import {
  createWorld, stepWorld, BOSS_MAX_HP, BOSS_THROW_MS, BOSS_REVERSE_MS, BOSS_REVERSE_INTERVAL_MS,
} from '../../../src/game/world/index.js'
import { STEP_MS, TILE, MAX_COFFEE } from '../../../src/game/constants.js'
import {
  makeKit, draw, tap, ofType, nonSfx, sfxNames, alive, isAlive, bossOf, onto,
} from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })

const ARENA = draw(30, 12, [[3, 9, 'P'], [14, 8, 'B']])
const ARENA_PLAYER_RIGHT = draw(30, 12, [[26, 9, 'P'], [14, 8, 'B']])
const BOSS_DEF = { id: 'boss', theme: 'boss', power: null, tokenKinds: [], tokensRequired: 0 }
const ALL = { powers: { echo: true, sudo: true, rmrf: true } }

function arena(rows = ARENA, opts = ALL) {
  const w = kit.make(rows, BOSS_DEF, opts)
  kit.settle(w, 30)
  return w
}

// One step with the player kept invincible, so the boss's attacks never matter.
const safeStep = (w, input) => {
  w.player.sudoMs = 1e9
  return kit.step(w, input)
}

// Fires echo at the boss until a boss-hit shows up; returns every event seen.
function hitBoss(w) {
  const boss = bossOf(w)
  const all = []
  for (let i = 0; i < 10; i++) {
    // A hit while he is "on a call" is blocked (orchestrator ruling): wait it out.
    for (let k = 0; k < 600 && boss.onCall; k++) safeStep(w)
    all.push(...kit.fireAt(w, boss, { safe: true }))
    if (ofType(all, 'boss-hit').length) break
  }
  return all
}

describe('the boss only takes damage from projectiles', () => {
  it('is not hurt by the player touching him or by sudo / rm -rf', () => {
    const w = arena()
    const boss = bossOf(w)
    const all = []
    for (let i = 0; i < 30; i++) {
      w.player.sudoMs = 1e9
      onto(w, boss)
      all.push(...kit.step(w))
    }
    all.push(...kit.step(w, tap('rmrf')))
    all.push(...kit.step(w, tap('sudo')))
    expect(ofType(all, 'boss-hit')).toEqual([])
    expect(ofType(all, 'kill')).toEqual([])
    expect(boss.hp).toBe(BOSS_MAX_HP)
    expect(isAlive(w, boss.id)).toBe(true)
  })

  it('loses 1 hp per echo hit: boss-hit event with the new hp, sfx boss-hit, projectile consumed', () => {
    const w = arena()
    const boss = bossOf(w)
    const ev = hitBoss(w)
    expect(ofType(ev, 'boss-hit')).toEqual([{ type: 'boss-hit', hp: BOSS_MAX_HP - 1 }])
    expect(sfxNames(ev)).toContain('boss-hit')
    expect(boss.hp).toBe(BOSS_MAX_HP - 1)
    expect(boss.phase).toBe(1)
    expect(ofType(ev, 'boss-phase')).toEqual([])
    expect(alive(w, 'projectile')).toHaveLength(0)
  })
})

describe('boss phases and defeat', () => {
  it('moves through phases 2 and 3 at the hp thirds, each announced once, then is defeated once', () => {
    const w = arena()
    const boss = bossOf(w)
    const events = []
    const hits = []
    for (let n = 1; n <= BOSS_MAX_HP; n++) {
      const ev = hitBoss(w)
      events.push(...ev)
      hits.push(...ofType(ev, 'boss-hit').map((e) => e.hp))
      expect(boss.hp).toBe(BOSS_MAX_HP - n)
      const phases = ofType(events, 'boss-phase')
      if (n < 4) {
        expect(boss.phase).toBe(1)
        expect(phases).toEqual([])
      } else if (n < 8) {
        expect(boss.phase).toBe(2)
        expect(phases).toEqual([{ type: 'boss-phase', phase: 2 }])
      } else if (n < 12) {
        expect(boss.phase).toBe(3)
        expect(phases).toEqual([{ type: 'boss-phase', phase: 2 }, { type: 'boss-phase', phase: 3 }])
      }
      if (n < 12) expect(ofType(events, 'boss-defeated')).toEqual([])
    }
    expect(hits).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
    expect(ofType(events, 'boss-phase')).toEqual([{ type: 'boss-phase', phase: 2 }, { type: 'boss-phase', phase: 3 }])
    expect(ofType(events, 'boss-defeated')).toEqual([{ type: 'boss-defeated' }])
    expect(boss.hp).toBe(0)
  })

  it('announces phase 3 when a hit takes hp from 5 to 4 (and not phase 2 again)', () => {
    const w = arena()
    const boss = bossOf(w)
    boss.hp = 5
    boss.phase = 2
    const ev = hitBoss(w)
    expect(ofType(ev, 'boss-hit')).toEqual([{ type: 'boss-hit', hp: 4 }])
    expect(ofType(ev, 'boss-phase')).toEqual([{ type: 'boss-phase', phase: 3 }])
    expect(boss.phase).toBe(3)
  })

  it('after the final hit: one boss-defeated, no more actions, no more hits', () => {
    const w = arena()
    const boss = bossOf(w)
    boss.hp = 1
    boss.phase = 3
    const ev = hitBoss(w)
    expect(ofType(ev, 'boss-hit')).toEqual([{ type: 'boss-hit', hp: 0 }])
    expect(ofType(ev, 'boss-defeated')).toEqual([{ type: 'boss-defeated' }])
    expect(ofType(ev, 'boss-phase')).toEqual([])
    const knownIds = new Set(w.entities.map((e) => e.id))
    const later = []
    for (let i = 0; i < 720; i++) later.push(...safeStep(w)) // 12 s: longer than any throw interval
    expect(ofType(later, 'boss-defeated')).toEqual([])
    expect(ofType(later, 'boss-hit')).toEqual([])
    expect(w.entities.filter((e) => e.kind === 'bossProjectile' && !knownIds.has(e.id))).toEqual([])
    expect(boss.hp).toBe(0)
    // Further echo shots do nothing to him.
    const more = kit.fireAt(w, boss, { safe: true })
    expect(ofType(more, 'boss-hit')).toEqual([])
    expect(boss.hp).toBe(0)
  })
})

describe('boss attacks', () => {
  // Steps for ms with the player invincible; reports each bossProjectile the
  // first time it is seen, with the step time and a copy of its state.
  function watchThrows(w, ms) {
    const seen = new Map()
    const frames = Math.round(ms / STEP_MS)
    for (let i = 0; i < frames; i++) {
      safeStep(w)
      for (const p of alive(w, 'bossProjectile')) {
        if (!seen.has(p.id)) seen.set(p.id, { at: w.time, vx: p.vx })
      }
    }
    return [...seen.values()]
  }

  it('throws a bossProjectile every BOSS_THROW_MS in phase 1, the first after one interval', () => {
    const w = kit.make(ARENA, BOSS_DEF, ALL) // time 0: throws are timed from the start
    const throws = watchThrows(w, 5 * BOSS_THROW_MS)
    expect(throws.length).toBeGreaterThanOrEqual(4)
    expect(throws.length).toBeLessThanOrEqual(5)
    throws.forEach((t, k) => expect(Math.abs(t.at - (k + 1) * BOSS_THROW_MS)).toBeLessThanOrEqual(3 * STEP_MS))
  })

  it('throws toward the player: left when the player is on his left, right when on his right', () => {
    const left = kit.make(ARENA, BOSS_DEF, ALL)
    const [a] = watchThrows(left, 2.5 * BOSS_THROW_MS)
    expect(a.vx).toBeLessThan(0)
    const right = kit.make(ARENA_PLAYER_RIGHT, BOSS_DEF, ALL)
    const [b] = watchThrows(right, 2.5 * BOSS_THROW_MS)
    expect(b.vx).toBeGreaterThan(0)
  })

  it('throws from the boss and hurts the player on contact', () => {
    const w = kit.make(ARENA, BOSS_DEF) // no powers
    const boss = bossOf(w)
    let proj = null
    for (let i = 0; i < 400 && !proj; i++) {
      kit.step(w)
      proj = alive(w, 'bossProjectile')[0] ?? null
    }
    expect(proj).not.toBeNull()
    expect(Math.abs(proj.x + proj.w / 2 - (boss.x + boss.w / 2))).toBeLessThanOrEqual(boss.w / 2 + TILE)
    expect(w.player.coffee).toBe(MAX_COFFEE)
    onto(w, proj)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: MAX_COFFEE - 1 }])
  })

  it('rm -rf clears the bossProjectiles in view but never the boss', () => {
    const w = arena()
    const boss = bossOf(w)
    let guard = 0
    while (alive(w, 'bossProjectile').length === 0 && guard++ < 400) safeStep(w)
    const before = alive(w, 'bossProjectile')
    expect(before.length).toBeGreaterThan(0)
    const ev = kit.step(w, tap('rmrf'))
    expect(ofType(ev, 'power-used')).toEqual([{ type: 'power-used', power: 'rmrf' }])
    for (const p of before) expect(isAlive(w, p.id)).toBe(false)
    expect(ofType(ev, 'kill').filter((k) => k.kind === 'boss')).toEqual([])
    expect(isAlive(w, boss.id)).toBe(true)
    expect(boss.hp).toBe(BOSS_MAX_HP)
  })
})

describe('reversed controls in phase 3', () => {
  // Steps for ms (player invincible) and returns the times (ms) at which
  // reversedMs jumped up, together with the value it was set to.
  function onsets(w, ms) {
    const found = []
    let prev = w.reversedMs
    const frames = Math.round(ms / STEP_MS)
    for (let i = 0; i < frames; i++) {
      safeStep(w)
      if (w.reversedMs > prev) found.push({ at: w.time, value: w.reversedMs })
      prev = w.reversedMs
    }
    return found
  }
  const freshArena = (hp, phase) => {
    const w = kit.make(ARENA, BOSS_DEF, ALL) // time starts at 0, so onsets are measured from creation
    const boss = bossOf(w)
    boss.hp = hp
    boss.phase = phase
    return w
  }

  it('periodically sets reversedMs to BOSS_REVERSE_MS and lets it count down', () => {
    const w = freshArena(4, 3)
    const found = onsets(w, 3 * BOSS_REVERSE_INTERVAL_MS + 600)
    expect(found.length).toBeGreaterThanOrEqual(2)
    found.slice(0, 2).forEach((o, k) => {
      expect(Math.abs(o.at - (k + 1) * BOSS_REVERSE_INTERVAL_MS)).toBeLessThanOrEqual(3 * STEP_MS)
      expect(o.value).toBeGreaterThan(BOSS_REVERSE_MS - 2 * STEP_MS)
      expect(o.value).toBeLessThanOrEqual(BOSS_REVERSE_MS)
    })
  })

  it('counts down by dt after it is set, and is back to 0 well before the next onset', () => {
    const w = freshArena(4, 3)
    let guard = 0
    while (w.reversedMs === 0 && guard++ < 1200) safeStep(w)
    expect(w.reversedMs).toBeGreaterThan(0)
    const v = w.reversedMs
    safeStep(w)
    expect(w.reversedMs).toBeCloseTo(v - STEP_MS, 6)
    for (let i = 0; i < Math.ceil(BOSS_REVERSE_MS / STEP_MS) + 3; i++) safeStep(w)
    expect(w.reversedMs).toBe(0)
  })

  it('never sets reversedMs in phase 1 or phase 2', () => {
    for (const [hp, phase] of [[BOSS_MAX_HP, 1], [8, 2]]) {
      const w = freshArena(hp, phase)
      expect(onsets(w, 2 * BOSS_REVERSE_INTERVAL_MS + 600)).toEqual([])
      expect(w.reversedMs).toBe(0)
    }
  })

  it('stops reversing once the boss is defeated', () => {
    const w = freshArena(1, 3)
    hitBoss(w)
    expect(bossOf(w).hp).toBe(0)
    w.reversedMs = 0
    expect(onsets(w, 2 * BOSS_REVERSE_INTERVAL_MS + 600)).toEqual([])
  })
})
