import { describe, it, expect } from 'vitest'
import * as worldMod from '../../../src/game/world/index.js'
import { parseLevel } from '../../../src/game/engine/tilemap.js'
import { TILE, VIEW_W, VIEW_H, MAX_COFFEE, STEP_MS } from '../../../src/game/constants.js'
import { createRng } from '../../../src/game/engine/rng.js'
import { makeKit, draw, levelDef, hold, byKind, bossOf } from '../helpers/s1-world.js'

const { createWorld, stepWorld } = worldMod
const kit = makeKit({ createWorld, stepWorld })

const FULL = draw(40, 12, [
  [2, 9, 'P'],
  [5, 9, 't'], [6, 9, 't'], [7, 9, 't'], [8, 9, 't'],
  [10, 9, 'b'], [12, 9, 'm'], [14, 9, 'f'], [16, 9, 'i'],
  [18, 3, 'x'], [20, 2, 'a'], [22, 9, 'C'], [24, 9, 'E'],
])

describe('tuning constants exported by src/game/world/index.js', () => {
  it('exports the pinned numbers', () => {
    expect(worldMod.INVULN_MS).toBe(1000)
    expect(worldMod.SUDO_MS).toBe(5000)
    expect(worldMod.FREEZE_MS).toBe(1000)
    expect(worldMod.ECHO_COOLDOWN_MS).toBe(300)
    expect(worldMod.SUDO_COOLDOWN_MS).toBe(12000)
    expect(worldMod.RMRF_COOLDOWN_MS).toBe(20000)
    expect(worldMod.RESPAWN_MS).toBe(800)
    expect(worldMod.CONVEYOR_SPEED).toBe(50)
    expect(worldMod.BUG_SPEED).toBe(30)
    expect(worldMod.ECHO_SPEED).toBe(300)
    expect(worldMod.TOKEN_SCORE).toBe(100)
    expect(worldMod.FLAKY_MS).toBe(1500)
    expect(worldMod.ALERT_INTERVAL_MS).toBe(2000)
    expect(worldMod.CRUSHER_CYCLE_MS).toBe(3000)
    expect(worldMod.BOSS_MAX_HP).toBe(12)
    expect(worldMod.BOSS_THROW_MS).toBe(2000)
    expect(worldMod.BOSS_REVERSE_MS).toBe(3000)
    expect(worldMod.BOSS_REVERSE_INTERVAL_MS).toBe(8000)
    expect(worldMod.KILL_SCORE).toEqual({ bug: 50, mergeConflict: 50, flakyTest: 75, meetingInvite: 75 })
  })
})

describe('createWorld: player and level data', () => {
  it('starts the player inside the P cell with full coffee, no powers and zeroed timers', () => {
    const w = kit.make(FULL)
    const p = w.player
    expect(p.w).toBe(12)
    expect(p.h).toBe(14)
    expect(p.x).toBeGreaterThanOrEqual(2 * TILE)
    expect(p.x).toBeLessThanOrEqual(2 * TILE + TILE - 12)
    expect(p.y).toBeGreaterThanOrEqual(9 * TILE)
    expect(p.y).toBeLessThanOrEqual(9 * TILE + TILE - 14)
    expect(p).toMatchObject({
      vx: 0, vy: 0, facing: 1, coffee: MAX_COFFEE, invulnMs: 0, frozenMs: 0, sudoMs: 0, dead: false,
      cooldowns: { echo: 0, sudo: 0, rmrf: 0 },
      powers: { echo: false, sudo: false, rmrf: false },
    })
    expect(MAX_COFFEE).toBe(3)
    expect(w).toMatchObject({ levelId: 't1', theme: 'editor', time: 0, reversedMs: 0, shake: 0 })
    expect(w.map.width).toBe(40)
    expect(w.map.height).toBe(12)
  })

  it('passes carried powers in as unlocked, and does not mutate the object it was given', () => {
    const given = { echo: true }
    const w = kit.make(FULL, {}, { powers: given })
    expect(w.player.powers).toEqual({ echo: true, sudo: false, rmrf: false })
    expect(given).toEqual({ echo: true })
  })

  it('sets tokens.required from tokensRequired and starts with none collected', () => {
    expect(kit.make(FULL, { tokensRequired: 3 }).tokens).toEqual({ collected: 0, required: 3 })
  })

  it('makes one entity per non-player spawn, with unique ids and sane boxes at the spawn cell', () => {
    const w = kit.make(FULL)
    const spawns = parseLevel(FULL).spawns.filter((s) => s.kind !== 'player')
    const kinds = {}
    for (const e of w.entities) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1
    expect(kinds).toEqual({
      token: 4, bug: 1, mergeConflict: 1, flakyTest: 1, meetingInvite: 1,
      crusher: 1, alertDropper: 1, checkpoint: 1, exit: 1,
    })
    expect(w.entities).toHaveLength(spawns.length)
    expect(new Set(w.entities.map((e) => e.id)).size).toBe(w.entities.length)
    for (const e of w.entities) {
      expect(e.id).not.toBeUndefined()
      for (const k of ['x', 'y', 'w', 'h', 'vx', 'vy']) expect(Number.isFinite(e[k])).toBe(true)
      expect(e.w).toBeGreaterThan(0)
      expect(e.h).toBeGreaterThan(0)
      expect(e.alive).toBe(true)
    }
    for (const kind of ['bug', 'mergeConflict', 'flakyTest', 'meetingInvite', 'crusher', 'alertDropper', 'checkpoint', 'exit']) {
      const e = byKind(w, kind)[0]
      const s = spawns.find((sp) => sp.kind === kind)
      expect(Math.abs(e.x - s.x)).toBeLessThanOrEqual(TILE)
      expect(Math.abs(e.y - s.y)).toBeLessThanOrEqual(TILE)
    }
  })

  it('labels tokens round-robin from tokenKinds in spawn order', () => {
    const w = kit.make(FULL)
    const labels = byKind(w, 'token').sort((a, b) => a.x - b.x).map((t) => t.label)
    expect(labels).toEqual(['{ }', '=>', ';', '{ }'])
  })

  it('gives kind state: checkpoint inactive, mergeConflict size 2, flakyTest solid', () => {
    const w = kit.make(FULL)
    expect(byKind(w, 'checkpoint')[0].active).toBe(false)
    expect(byKind(w, 'mergeConflict')[0].size).toBe(2)
    expect(byKind(w, 'flakyTest')[0].solid).toBe(true)
  })

  it('locks the exit unless the level power is already unlocked', () => {
    expect(byKind(kit.make(FULL), 'exit')[0].locked).toBe(true)
    expect(byKind(kit.make(FULL, {}, { powers: { echo: true } }), 'exit')[0].locked).toBe(false)
    // A carried power that is not this level's power does not open the exit.
    expect(byKind(kit.make(FULL, {}, { powers: { sudo: true } }), 'exit')[0].locked).toBe(true)
    expect(byKind(kit.make(FULL, { power: 'sudo' }, { powers: { sudo: true } }), 'exit')[0].locked).toBe(false)
  })

  it('takes the first checkpoint from the player start', () => {
    const w = kit.make(FULL)
    expect(w.checkpoint).toEqual({ x: w.player.x, y: w.player.y })
  })

  it('does not share state between worlds made from the same levelDef', () => {
    const def = levelDef(draw(40, 12, [[2, 9, 'P']]))
    const rowsBefore = [...def.rows]
    const a = createWorld(def, { seed: 1 })
    const b = createWorld(def, { seed: 1 })
    const startX = b.player.x
    for (let i = 0; i < 100; i++) stepWorld(a, hold('right'), STEP_MS)
    expect(a.player.x).toBeGreaterThan(startX + 20)
    expect(b.player.x).toBe(startX)
    expect(b.time).toBe(0)
    expect(def.rows).toEqual(rowsBefore)
  })
})

describe('createWorld: boss level', () => {
  const ARENA = draw(30, 12, [[3, 9, 'P'], [14, 8, 'B']])
  const BOSS_DEF = { theme: 'boss', power: null, tokenKinds: [], tokensRequired: 0, id: 'boss' }

  it('makes the boss at full hp in phase 1 and no exit', () => {
    const w = kit.make(ARENA, BOSS_DEF)
    expect(w.entities.map((e) => e.kind)).toEqual(['boss'])
    const boss = bossOf(w)
    expect(boss.hp).toBe(worldMod.BOSS_MAX_HP)
    expect(boss.maxHp).toBe(worldMod.BOSS_MAX_HP)
    expect(boss.phase).toBe(1)
    expect(w.theme).toBe('boss')
    expect(w.tokens).toEqual({ collected: 0, required: 0 })
  })
})

describe('createWorld: camera', () => {
  it('starts at the left edge for a player near the left of a wide map', () => {
    const w = kit.make(draw(60, 12, [[1, 9, 'P']]))
    expect(w.camera.x).toBe(0)
    expect(w.camera.y).toBeGreaterThanOrEqual(0)
    expect(w.camera.y).toBeLessThanOrEqual(12) // 12 rows = 192 px, the view is 180
  })

  it('is clamped to the right edge of the map for a player near the right', () => {
    const w = kit.make(draw(60, 12, [[58, 9, 'P']]))
    const maxX = 60 * TILE - VIEW_W
    expect(w.camera.x).toBeLessThanOrEqual(maxX)
    expect(w.camera.x).toBeGreaterThan(0)
    kit.settle(w, 120)
    expect(w.camera.x).toBeCloseTo(maxX, 5)
  })

  it('follows the player inside the clamped range and keeps the player in view', () => {
    const w = kit.make(draw(60, 12, [[30, 9, 'P']]))
    kit.settle(w, 120)
    expect(w.camera.x).toBeGreaterThan(0)
    expect(w.camera.x).toBeLessThan(60 * TILE - VIEW_W)
    expect(w.camera.x).toBeLessThanOrEqual(w.player.x)
    expect(w.camera.x + VIEW_W).toBeGreaterThanOrEqual(w.player.x + w.player.w)
    // roughly centered
    expect(Math.abs(w.camera.x + VIEW_W / 2 - (w.player.x + 6))).toBeLessThanOrEqual(40)
  })

  it('clamps vertically on a tall map and keeps the player in view', () => {
    const rows = draw(40, 30, [[2, 28 - 1, 'P']])
    const w = kit.make(rows)
    kit.settle(w, 120)
    expect(w.camera.y).toBeCloseTo(30 * TILE - VIEW_H, 5)
    expect(w.camera.y).toBeLessThanOrEqual(w.player.y)
    expect(w.camera.y + VIEW_H).toBeGreaterThanOrEqual(w.player.y + w.player.h)
  })
})

describe('createWorld: determinism and rng', () => {
  it('builds identical worlds for the same seed', () => {
    const a = kit.make(FULL, {}, { seed: 7 })
    const b = kit.make(FULL, {}, { seed: 7 })
    expect({ ...a, rng: undefined }).toEqual({ ...b, rng: undefined })
  })

  it('exposes an rng that draws floats in [0,1) and depends on the seed (default seed 1)', () => {
    const draws = (w) => Array.from({ length: 5 }, () => w.rng.next())
    const s7 = draws(kit.make(FULL, {}, { seed: 7 }))
    const s8 = draws(kit.make(FULL, {}, { seed: 8 }))
    for (const v of [...s7, ...s8]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(s7).not.toEqual(s8)
    expect(draws(createWorld(levelDef(FULL), {}))).toEqual(draws(createWorld(levelDef(FULL), { seed: 1 })))
    expect(typeof createRng(1).next).toBe('function')
  })

  it('starts the clock at 0 and adds exactly dt per step', () => {
    const w = kit.make(FULL)
    kit.run(w, 10)
    expect(w.time).toBeCloseTo(10 * STEP_MS, 6)
  })
})
