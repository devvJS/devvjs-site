// Revision 1, part A: new behavior (review S1 defects 1, 2 and 4). These fail
// against the code as reviewed.
import { describe, it, expect } from 'vitest'
import * as worldMod from '../../../src/game/world/index.js'
import { LEVELS } from '../../../src/game/levels/index.js'
import { tileAt, SOLID, CONVEYOR_R, CONVEYOR_L } from '../../../src/game/engine/tilemap.js'
import { STEP_MS, TILE } from '../../../src/game/constants.js'
import {
  makeKit, draw, tap, idle, ofType, alive, bossOf, isAlive, place,
} from '../helpers/s1-world.js'

const { createWorld, stepWorld, BOSS_REVERSE_INTERVAL_MS } = worldMod
const kit = makeKit({ createWorld, stepWorld })
const BOSS_LEVEL = LEVELS.find((l) => l.id === 'boss')
const ALL = { echo: true, sudo: true, rmrf: true }
const bossWorld = (seed = 1) => createWorld(BOSS_LEVEL, { seed, powers: { ...ALL } })

const safeStep = (w, input = idle()) => {
  w.player.sudoMs = 1e9
  return kit.step(w, input)
}

const cx = (e) => e.x + e.w / 2

describe('D1: a hatched minion never sits inside a wall', () => {
  const ARENA = bossWorld // the real arena: solid walls at x < 16 and x >= 400
  const isSolidAt = (w, box) => {
    for (let ty = Math.floor(box.y / TILE); ty <= Math.ceil((box.y + box.h) / TILE) - 1; ty++) {
      for (let tx = Math.floor(box.x / TILE); tx <= Math.ceil((box.x + box.w) / TILE) - 1; tx++) {
        const t = tileAt(w.map, tx, ty)
        if (t === SOLID || t === CONVEYOR_R || t === CONVEYOR_L) return true
      }
    }
    return false
  }

  // A ticket that dies flush against a wall with its bottom `d` px above the
  // bottom of row `r`.
  function hatchAt(side, r, d) {
    const w = ARENA()
    const y = r * TILE - d - 10.5 // it falls half a pixel in the step it hits the wall
    const x = side < 0 ? TILE : 25 * TILE - 10
    w.entities.push({
      id: 9000, kind: 'bossProjectile', variant: 'ticket', x, y, w: 10, h: 10,
      vx: side * 110, vy: 0, alive: true, onGround: false, lifeMs: 10000,
    })
    const log = { overlaps: [], xs: [] }
    let minion = null
    for (let i = 0; i < 120; i++) {
      safeStep(w)
      minion ??= alive(w, 'bug').find((b) => b.minion) ?? null
      if (!minion) continue
      if (isSolidAt(w, minion)) log.overlaps.push(i)
      if (i >= 30) log.xs.push(minion.x)
    }
    return { w, minion, log }
  }

  for (const [name, side, rows] of [
    ['left wall', -1, [3, 6, 9, 10]],
    ['right wall', 1, [3, 6, 9, 10, 12]],
  ]) {
    it(`hatches clear of the ${name}, lands on the floor and walks, at every height`, () => {
      const problems = []
      for (const r of rows) {
        for (const d of [0, 0.4, 1, 2, 2.9, 3]) {
          const { minion, log } = hatchAt(side, r, d)
          const tag = `row ${r} d ${d}`
          if (!minion) problems.push(`${tag}: no minion hatched`)
          else {
            if (log.overlaps.length) problems.push(`${tag}: inside a solid tile on ${log.overlaps.length} steps`)
            if (!minion.onGround) problems.push(`${tag}: not on the ground after 2 s`)
            if (Math.max(...log.xs) - Math.min(...log.xs) < 8) problems.push(`${tag}: did not walk`)
          }
        }
      }
      expect(problems).toEqual([])
    })
  }
})

describe('boss pacing: ECHO_RANGE', () => {
  it('is exported and shorter than the spawn-to-boss distance of the real boss level', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    expect(typeof worldMod.ECHO_RANGE).toBe('number')
    expect(worldMod.ECHO_RANGE).toBeGreaterThan(100)
    expect(worldMod.ECHO_RANGE).toBeLessThan(cx(boss) - cx(w.player))
  })

  it('removes a shot after it has traveled ECHO_RANGE', () => {
    const range = worldMod.ECHO_RANGE
    expect(typeof range).toBe('number')
    const w = bossWorld()
    kit.settle(w, 30)
    w.player.sudoMs = 1e9
    kit.step(w, tap('echo'))
    const shot = alive(w, 'projectile')[0]
    expect(shot).toBeDefined()
    const x0 = shot.x
    let last = x0
    let removedAt = -1
    for (let i = 0; i < 200; i++) {
      safeStep(w)
      if (!isAlive(w, shot.id)) {
        removedAt = i
        break
      }
      last = shot.x
    }
    expect(removedAt).toBeGreaterThan(0)
    // Removed on the step it passes ECHO_RANGE: the last position seen is within one step of it.
    expect(last - x0).toBeGreaterThan(range - 2 * worldMod.ECHO_SPEED * (STEP_MS / 1000) - 1)
    expect(last - x0).toBeLessThanOrEqual(range + 1)
  })
})

describe('boss pacing: the call', () => {
  it('exports BOSS_CALL_MS and BOSS_CALL_INTERVAL_MS', () => {
    expect(typeof worldMod.BOSS_CALL_MS).toBe('number')
    expect(typeof worldMod.BOSS_CALL_INTERVAL_MS).toBe('number')
    expect(worldMod.BOSS_CALL_MS).toBeGreaterThanOrEqual(1000)
    expect(worldMod.BOSS_CALL_INTERVAL_MS).toBeGreaterThanOrEqual(worldMod.BOSS_CALL_MS)
  })

  it('the boss is periodically onCall, for BOSS_CALL_MS at a time', () => {
    const { BOSS_CALL_MS, BOSS_CALL_INTERVAL_MS } = worldMod
    expect(typeof BOSS_CALL_MS).toBe('number')
    const w = bossWorld()
    const boss = bossOf(w)
    const onsets = []
    const lengths = []
    let prev = false
    let since = 0
    const frames = Math.round((3 * (BOSS_CALL_MS + BOSS_CALL_INTERVAL_MS) + 1000) / STEP_MS)
    for (let i = 0; i < frames; i++) {
      safeStep(w)
      const now = boss.onCall === true
      expect(typeof boss.onCall).toBe('boolean')
      if (now && !prev) {
        onsets.push(w.time)
        since = w.time
      }
      if (!now && prev) lengths.push(w.time - since)
      prev = now
    }
    expect(onsets.length).toBeGreaterThanOrEqual(3)
    expect(lengths.length).toBeGreaterThanOrEqual(2)
    for (const len of lengths) expect(Math.abs(len - BOSS_CALL_MS)).toBeLessThanOrEqual(3 * STEP_MS)
    // The spacing between calls is BOSS_CALL_INTERVAL_MS, counted either from one
    // call's start or from its end.
    for (let k = 1; k < onsets.length; k++) {
      const gap = onsets[k] - onsets[k - 1]
      const fromStart = Math.abs(gap - BOSS_CALL_INTERVAL_MS) <= 3 * STEP_MS
      const fromEnd = Math.abs(gap - (BOSS_CALL_INTERVAL_MS + BOSS_CALL_MS)) <= 3 * STEP_MS
      expect(fromStart || fromEnd).toBe(true)
    }
  })

  it('blocks a hit during a call (consumed, blocked event, no damage) and takes one outside it', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    kit.settle(w, 10)
    let guard = 0
    while (boss.onCall !== true && guard++ < 3000) safeStep(w)
    expect(boss.onCall).toBe(true)
    const blocked = kit.fireAt(w, boss, { safe: true })
    expect(ofType(blocked, 'blocked')).toEqual([{ type: 'blocked' }])
    expect(ofType(blocked, 'boss-hit')).toEqual([])
    expect(boss.hp).toBe(worldMod.BOSS_MAX_HP)
    expect(alive(w, 'projectile')).toHaveLength(0)

    guard = 0
    while (boss.onCall !== false && guard++ < 3000) safeStep(w)
    expect(boss.onCall).toBe(false)
    const real = kit.fireAt(w, boss, { safe: true })
    expect(ofType(real, 'boss-hit')).toEqual([{ type: 'boss-hit', hp: worldMod.BOSS_MAX_HP - 1 }])
    expect(ofType(real, 'blocked')).toEqual([])
  })
})

describe('boss pacing: entering phase 3 triggers the reversal', () => {
  it('reverses within 500 ms of a real hit into phase 3, then every BOSS_REVERSE_INTERVAL_MS', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    kit.settle(w, 10)
    boss.hp = 5
    boss.phase = 2
    const onsets = []
    let prev = w.reversedMs
    const track = (input) => {
      const ev = safeStep(w, input)
      if (w.reversedMs > prev) onsets.push(w.time)
      prev = w.reversedMs
      return ev
    }
    let entry = null
    for (let tries = 0; tries < 60 && entry === null; tries++) {
      for (let k = 0; k < 3000 && boss.onCall; k++) track()
      const p = w.player
      p.cooldowns.echo = 0
      place(w, boss.x - 40, boss.y + boss.h - p.h)
      p.facing = 1
      const ev = [...track(tap('echo'))]
      for (let k = 0; k < 60 && alive(w, 'projectile').length; k++) ev.push(...track())
      if (ofType(ev, 'boss-phase').some((e) => e.phase === 3)) entry = w.time
    }
    expect(entry).not.toBeNull()
    expect(boss.phase).toBe(3)
    const until = entry + 2 * BOSS_REVERSE_INTERVAL_MS + 800
    while (w.time < until) track()
    expect(onsets.length).toBeGreaterThanOrEqual(3)
    expect(onsets[0] - entry).toBeGreaterThanOrEqual(-STEP_MS)
    expect(onsets[0] - entry).toBeLessThanOrEqual(500 + STEP_MS)
    for (let k = 1; k < 3; k++) {
      expect(Math.abs(onsets[k] - onsets[k - 1] - BOSS_REVERSE_INTERVAL_MS)).toBeLessThanOrEqual(3 * STEP_MS)
    }
  })
})

// --- Pacing bots on the real boss level --------------------------------------

function runBot(mode, maxMs) {
  const w = bossWorld(1)
  const boss = bossOf(w)
  const p = w.player
  let defeatedAt = null
  const frames = Math.round(maxMs / STEP_MS)
  for (let i = 0; i < frames && defeatedAt === null; i++) {
    const held = new Set()
    const pressed = new Set()
    if (!p.dead && !boss.defeated) {
      const dx = cx(boss) - cx(p)
      const toward = dx >= 0 ? 'right' : 'left'
      const face = dx >= 0 ? 1 : -1
      const reach = mode === 'approach' ? worldMod.ECHO_RANGE - 16 : Infinity
      if (mode === 'approach' && Math.abs(dx) > reach) held.add(toward)
      else if (p.facing !== face) held.add(toward)
      if (mode === 'approach') {
        const near = w.entities.some(
          (e) => e.kind === 'bossProjectile' && e.alive && Math.hypot(cx(e) - cx(p), e.y + e.h / 2 - (p.y + p.h / 2)) <= 40,
        )
        if (near && p.onGround) { held.add('jump'); pressed.add('jump') }
        const hostile = w.entities.filter((e) => e.alive && (e.kind === 'bossProjectile' || (e.kind === 'bug' && e.minion))).length
        if (p.cooldowns.sudo <= 0 && p.sudoMs <= 0 && p.coffee <= 1) { held.add('sudo'); pressed.add('sudo') }
        if (p.cooldowns.rmrf <= 0 && hostile >= 3) { held.add('rmrf'); pressed.add('rmrf') }
      }
      const canFire = p.cooldowns.echo <= 0 && p.facing === face && Math.abs(dx) <= reach + 16 && (mode === 'spam' || !boss.onCall)
      if (canFire) { held.add('echo'); pressed.add('echo') }
    }
    const ev = stepWorld(w, { held, pressed }, STEP_MS)
    if (ofType(ev, 'boss-defeated').length) defeatedAt = w.time
  }
  return { w, boss, defeatedAt }
}

describe('boss pacing: bots on the real boss level (seed 1)', () => {
  it('(a) a bot that stands at the spawn and fires echo whenever it can has not won after 120 s', () => {
    expect(typeof worldMod.ECHO_RANGE).toBe('number')
    const { boss, defeatedAt, w } = runBot('spam', 120000)
    expect(defeatedAt).toBeNull()
    expect(boss.defeated).toBe(false)
    expect(boss.hp).toBeGreaterThan(0)
    expect(w.time).toBeGreaterThanOrEqual(120000 - STEP_MS)
  })

  it('(b) a bot that walks into range, fires off-call, dodges and uses sudo / rm -rf wins between 30 s and 120 s', () => {
    expect(typeof worldMod.ECHO_RANGE).toBe('number')
    const { boss, defeatedAt } = runBot('approach', 120000)
    expect(boss.hp).toBe(0)
    expect(defeatedAt).not.toBeNull()
    expect(defeatedAt).toBeGreaterThanOrEqual(30000)
    expect(defeatedAt).toBeLessThanOrEqual(120000)
  })
})

describe('D4: a walker never stalls against an adverse belt', () => {
  // Left section (cols 0-7) of plain floor, a left-pushing belt (cols 8-13, faster than a bug),
  // then plain floor. The bug starts on the left and walks right (the player is to the right).
  const rows = draw(40, 12, [[8, 10, '<<<<<<'], [30, 9, 'P'], [5, 9, 'b']])

  it('never stays within one tile for 3 s, and never leaves the floor', () => {
    const w = kit.make(rows)
    const bug = alive(w, 'bug')[0]
    const history = []
    let y0 = null
    for (let i = 0; i < 1200; i++) {
      safeStep(w)
      expect(bug.alive).not.toBe(false)
      y0 ??= bug.y
      expect(bug.y).toBeCloseTo(y0, 0)
      history.push(bug.x)
    }
    const window = 180 // 3 s
    for (let i = 0; i + window <= history.length; i++) {
      const slice = history.slice(i, i + window)
      const spread = Math.max(...slice) - Math.min(...slice)
      if (spread < TILE) throw new Error(`stalled: x stayed within ${spread.toFixed(1)} px from step ${i} (x ${slice[0].toFixed(1)})`)
    }
  })
})

