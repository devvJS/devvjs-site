import { describe, it, expect } from 'vitest'
import { LEVELS } from '../../../src/game/levels/index.js'
import { parseLevel, tileAt, CONVEYOR_R, CONVEYOR_L } from '../../../src/game/engine/tilemap.js'
import { TILE } from '../../../src/game/constants.js'
import {
  reachableCells,
  spawnReached,
  reachableTokenCount,
  bossFloorReachable,
  softlockedCells,
} from '../helpers/s2-reach.js'

const [editor, ci, prod, boss] = LEVELS
const parsed = (level) => parseLevel(level.rows)
const count = (map, kind) => map.spawns.filter((s) => s.kind === kind).length

describe('LEVELS definitions', () => {
  it('has exactly 4 levels in order: editor, ci, prod, boss', () => {
    expect(LEVELS).toHaveLength(4)
    expect(LEVELS.map((l) => l.id)).toEqual(['editor', 'ci', 'prod', 'boss'])
    expect(LEVELS.map((l) => l.theme)).toEqual(['editor', 'ci', 'prod', 'boss'])
    expect(LEVELS.map((l) => l.power)).toEqual(['echo', 'sudo', 'rmrf', null])
  })

  it('names the levels', () => {
    expect(LEVELS.map((l) => l.name)).toEqual(['The Editor', 'The CI Pipeline', 'Production', 'The Product Manager'])
  })

  it('lists the token kinds per level', () => {
    expect(editor.tokenKinds).toEqual(['{ }', '=>', ';'])
    expect(ci.tokenKinds).toEqual(['test()', 'expect', 'npm'])
    expect(prod.tokenKinds).toEqual(['git', 'deploy', 'logs'])
    expect(boss.tokenKinds).toEqual([])
    expect(boss.tokensRequired).toBe(0)
  })

  it('has rows as an array of strings', () => {
    for (const level of LEVELS) {
      expect(Array.isArray(level.rows)).toBe(true)
      for (const row of level.rows) expect(typeof row).toBe('string')
    }
  })
})

describe.each([['editor', editor], ['ci', ci], ['prod', prod], ['boss', boss]])('level %s structure', (_name, level) => {
  it('parses with parseLevel, height 12 to 30, exactly one P', () => {
    const map = parsed(level)
    expect(map.height).toBeGreaterThanOrEqual(12)
    expect(map.height).toBeLessThanOrEqual(30)
    expect(count(map, 'player')).toBe(1)
  })
})

describe.each([['editor', editor], ['ci', ci], ['prod', prod]])('non-boss level %s', (_name, level) => {
  const map = parsed(level)
  const reach = reachableCells(map)

  it('is at least 100 columns wide and has one exit and at least one checkpoint', () => {
    expect(map.width).toBeGreaterThanOrEqual(100)
    expect(count(map, 'exit')).toBe(1)
    expect(count(map, 'checkpoint')).toBeGreaterThanOrEqual(1)
    expect(count(map, 'boss')).toBe(0)
  })

  it('requires at least 5 tokens and spawns at least that many', () => {
    expect(Number.isInteger(level.tokensRequired)).toBe(true)
    expect(level.tokensRequired).toBeGreaterThanOrEqual(5)
    expect(count(map, 'token')).toBeGreaterThanOrEqual(level.tokensRequired)
  })

  it('has a reachable start area', () => {
    expect(reach.size).toBeGreaterThan(10)
  })

  it('has the exit reachable from P', () => {
    const exit = map.spawns.find((s) => s.kind === 'exit')
    expect(spawnReached(map, reach, exit)).toBe(true)
  })

  it('has every checkpoint reachable', () => {
    const unreachable = map.spawns
      .filter((s) => s.kind === 'checkpoint' && !spawnReached(map, reach, s))
      .map((s) => [s.x / TILE, s.y / TILE])
    expect(unreachable).toEqual([])
  })

  it('has no softlock: every reachable cell can reach the exit or die', () => {
    expect(softlockedCells(map)).toEqual([])
  })

  it('has no alertDropper within 1 column of a checkpoint', () => {
    const cps = map.spawns.filter((s) => s.kind === 'checkpoint').map((s) => s.x / TILE)
    const close = map.spawns
      .filter((s) => s.kind === 'alertDropper' && cps.some((c) => Math.abs(c - s.x / TILE) <= 1))
      .map((s) => s.x / TILE)
    expect(close).toEqual([])
  })

  it('has at least tokensRequired tokens reachable', () => {
    expect(reachableTokenCount(map, reach)).toBeGreaterThanOrEqual(level.tokensRequired)
  })
})

describe('boss level', () => {
  const map = parsed(boss)

  it('has exactly one B and no exit', () => {
    expect(count(map, 'boss')).toBe(1)
    expect(count(map, 'exit')).toBe(0)
  })

  it('has its arena floor reachable', () => {
    expect(bossFloorReachable(map, reachableCells(map))).toBe(true)
  })
})

describe('enemy and hazard variety', () => {
  it('editor has at least 3 bugs and 2 merge conflicts', () => {
    const map = parsed(editor)
    expect(count(map, 'bug')).toBeGreaterThanOrEqual(3)
    expect(count(map, 'mergeConflict')).toBeGreaterThanOrEqual(2)
  })

  it('ci has at least 3 flaky tests, 2 crushers and 2 conveyor tiles', () => {
    const map = parsed(ci)
    expect(count(map, 'flakyTest')).toBeGreaterThanOrEqual(3)
    expect(count(map, 'crusher')).toBeGreaterThanOrEqual(2)
    let conveyors = 0
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = tileAt(map, x, y)
        if (t === CONVEYOR_R || t === CONVEYOR_L) conveyors++
      }
    }
    expect(conveyors).toBeGreaterThanOrEqual(2)
  })

  it('prod has at least 3 meeting invites and 2 alert droppers', () => {
    const map = parsed(prod)
    expect(count(map, 'meetingInvite')).toBeGreaterThanOrEqual(3)
    expect(count(map, 'alertDropper')).toBeGreaterThanOrEqual(2)
  })
})
