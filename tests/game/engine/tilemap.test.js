import { describe, it, expect } from 'vitest'
import { parseLevel, tileAt, LEGEND } from '../../../src/game/engine/tilemap.js'

describe('LEGEND', () => {
  it('maps tile characters to tile ids', () => {
    expect(LEGEND['.']).toBe(0)
    expect(LEGEND['#']).toBe(1)
    expect(LEGEND['=']).toBe(2)
    expect(LEGEND['^']).toBe(3)
    expect(LEGEND['>']).toBe(4)
    expect(LEGEND['<']).toBe(5)
  })

  it('maps spawn characters to spawn kinds', () => {
    expect(LEGEND.P).toBe('player')
    expect(LEGEND.C).toBe('checkpoint')
    expect(LEGEND.E).toBe('exit')
    expect(LEGEND.t).toBe('token')
    expect(LEGEND.b).toBe('bug')
    expect(LEGEND.m).toBe('mergeConflict')
    expect(LEGEND.f).toBe('flakyTest')
    expect(LEGEND.i).toBe('meetingInvite')
    expect(LEGEND.x).toBe('crusher')
    expect(LEGEND.a).toBe('alertDropper')
    expect(LEGEND.B).toBe('boss')
  })
})

describe('parseLevel', () => {
  const rows = [
    '......E',
    '.P.t...',
    '..b.C.m',
    '#=^><##',
  ]

  it('reports size and a Uint8Array of tiles in row-major order', () => {
    const map = parseLevel(rows)
    expect(map.width).toBe(7)
    expect(map.height).toBe(4)
    expect(map.tiles).toBeInstanceOf(Uint8Array)
    expect(map.tiles).toHaveLength(28)
    expect(Array.from(map.tiles.slice(21, 28))).toEqual([1, 2, 3, 4, 5, 1, 1])
  })

  it('turns spawn cells into EMPTY', () => {
    const map = parseLevel(rows)
    expect(Array.from(map.tiles.slice(0, 21)).every((t) => t === 0)).toBe(true)
  })

  it('lists spawns with pixel coordinates at the tile top-left, row by row', () => {
    const map = parseLevel(rows)
    expect(map.spawns).toEqual([
      { kind: 'exit', x: 96, y: 0 },
      { kind: 'player', x: 16, y: 16 },
      { kind: 'token', x: 48, y: 16 },
      { kind: 'bug', x: 32, y: 32 },
      { kind: 'checkpoint', x: 64, y: 32 },
      { kind: 'mergeConflict', x: 96, y: 32 },
    ])
  })

  it('maps the rest of the spawn legend', () => {
    const map = parseLevel(['PfixaB', '######'])
    expect(map.spawns.map((s) => [s.kind, s.x, s.y])).toEqual([
      ['player', 0, 0],
      ['flakyTest', 16, 0],
      ['meetingInvite', 32, 0],
      ['crusher', 48, 0],
      ['alertDropper', 64, 0],
      ['boss', 80, 0],
    ])
  })

  it('throws on ragged rows', () => {
    expect(() => parseLevel(['P..', '....'])).toThrow()
    expect(() => parseLevel(['P....', '..'])).toThrow()
  })

  it('throws with no player', () => {
    expect(() => parseLevel(['...', '###'])).toThrow()
  })

  it('throws with two players', () => {
    expect(() => parseLevel(['P.P', '###'])).toThrow()
    expect(() => parseLevel(['P..', 'P..'])).toThrow()
  })
})

describe('tileAt', () => {
  const map = parseLevel(['P..', '.#=', '^><'])

  it('reads in-bounds tiles', () => {
    expect(tileAt(map, 0, 0)).toBe(0)
    expect(tileAt(map, 1, 1)).toBe(1)
    expect(tileAt(map, 2, 1)).toBe(2)
    expect(tileAt(map, 0, 2)).toBe(3)
    expect(tileAt(map, 1, 2)).toBe(4)
    expect(tileAt(map, 2, 2)).toBe(5)
  })

  it('treats the sides and the top as SOLID', () => {
    expect(tileAt(map, -1, 0)).toBe(1)
    expect(tileAt(map, -5, 1)).toBe(1)
    expect(tileAt(map, 3, 0)).toBe(1)
    expect(tileAt(map, 9, 2)).toBe(1)
    expect(tileAt(map, 0, -1)).toBe(1)
    expect(tileAt(map, 2, -7)).toBe(1)
  })

  it('treats below the map as EMPTY', () => {
    expect(tileAt(map, 0, 3)).toBe(0)
    expect(tileAt(map, 1, 100)).toBe(0)
  })
})
