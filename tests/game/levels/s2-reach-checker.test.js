import { describe, it, expect } from 'vitest'
import { parseLevel } from '../../../src/game/engine/tilemap.js'
import {
  isStandable,
  reachableCells,
  spawnReached,
  tokenReached,
  reachableTokenCount,
  bossFloorReachable,
  softlockedCells,
} from '../helpers/s2-reach.js'

function check(rows, kind = 'exit') {
  const map = parseLevel(rows)
  const reach = reachableCells(map)
  const spawn = map.spawns.find((s) => s.kind === kind)
  return { map, reach, spawn, reached: spawnReached(map, reach, spawn) }
}

describe('reachability checker (self-test)', () => {
  it('walks along a flat floor', () => {
    expect(check(['.........', '.........', 'P.......E', '#########']).reached).toBe(true)
  })

  it('treats a cell above SOLID, ONEWAY and conveyors as standable, and above spikes or air as not', () => {
    const map = parseLevel(['P....', '#=><^'])
    expect([0, 1, 2, 3, 4].map((x) => isStandable(map, x, 0))).toEqual([true, true, true, true, false])
  })

  it('crosses a gap of 2 empty columns (dx 3) by jumping', () => {
    expect(check(['........', '........', '..P..E..', '###..###']).reached).toBe(true)
  })

  it('does not cross a gap of 3 empty columns on the same row (dx 4)', () => {
    expect(check(['.........', '.........', '..P...E..', '###...###']).reached).toBe(false)
  })

  it('does not cross a wide gap', () => {
    expect(check(['..........', '..........', 'P.......E.', '###......#']).reached).toBe(false)
  })

  it('climbs a ledge 3 rows up, one column across', () => {
    const rows = ['......', '......', '......', '..E...', '..##..', '......', '.P....', '##....']
    expect(check(rows).reached).toBe(true)
  })

  it('cannot reach a ledge 4 rows up', () => {
    const rows = ['......', '......', '..E...', '..##..', '......', '......', '.P....', '##....']
    expect(check(rows).reached).toBe(false)
  })

  it('cannot climb 3 rows up and 3 columns across', () => {
    const rows = ['......', '......', '......', '....E.', '....##', '......', '.P....', '##....']
    expect(check(rows).reached).toBe(false)
  })

  it('climbs through a ONEWAY platform from below', () => {
    const rows = ['......', '......', '......', '.E....', '===...', '......', '.P....', '##....']
    expect(check(rows).reached).toBe(true)
  })

  it('is blocked by a SOLID platform of the same shape', () => {
    const rows = ['......', '......', '......', '.E....', '###...', '......', '.P....', '##....']
    expect(check(rows).reached).toBe(false)
  })

  it('is blocked by a ceiling that leaves no headroom for a gap jump', () => {
    expect(check(['........', '########', '..P..E..', '###..###']).reached).toBe(false)
    expect(check(['........', '........', '..P..E..', '###..###']).reached).toBe(true)
  })

  it('never lands on spikes: a spike pit floor is not standable', () => {
    expect(check(['.......', '.......', 'P.....E', '##^^^##']).reached).toBe(false)
  })

  it('steps off a ledge and falls straight down to a floor below', () => {
    const rows = ['P.....', '#####.', '#####.', '#####.', '#####.', '#####E', '######']
    expect(check(rows).reached).toBe(true)
  })

  it('cannot climb back up a 5-row wall', () => {
    const rows = ['.....E', '#####.', '#####.', '#####.', '#####.', 'P....#', '######']
    expect(check(rows).reached).toBe(false)
  })

  it('falls diagonally off a ledge up to 3 columns away, not 4', () => {
    const near = ['P.......', '#.......', '........', '........', '........', '....E...', '...#####']
    expect(check(near).reached).toBe(true)
    const far = ['P.......', '#.......', '........', '........', '........', '....E...', '....####']
    expect(check(far).reached).toBe(false)
  })

  it('stands on conveyors', () => {
    expect(check(['P...E', '>>>>>']).reached).toBe(true)
  })

  it('counts a token beside a reachable cell or up to 3 rows above in its column', () => {
    const map = parseLevel(['......', '.t....', '......', '......', '.P.t..', '######'])
    const reach = reachableCells(map)
    const tokens = map.spawns.filter((s) => s.kind === 'token')
    expect(tokens.map((t) => tokenReached(map, reach, t))).toEqual([true, true])
    expect(reachableTokenCount(map, reach)).toBe(2)
  })

  it('does not count a token 4 rows above a reachable cell', () => {
    const map = parseLevel(['.t....', '......', '......', '......', '.P....', '######'])
    expect(reachableTokenCount(map, reachableCells(map))).toBe(0)
  })

  it('does not count a token behind a solid ceiling', () => {
    const open = parseLevel(['..t...', '......', '......', '.P....', '######'])
    expect(reachableTokenCount(open, reachableCells(open))).toBe(1)
    const roofed = parseLevel(['..t...', '######', '......', '.P....', '######'])
    expect(reachableTokenCount(roofed, reachableCells(roofed))).toBe(0)
  })

  it('checks that the boss arena floor is reachable', () => {
    const arena = parseLevel(['..............', '..............', 'P.........B...', '##############'])
    expect(bossFloorReachable(arena, reachableCells(arena))).toBe(true)
    const wall = '.....#........'
    const split = parseLevel([wall, wall, wall, 'P....#....B...', '##############'])
    expect(bossFloorReachable(split, reachableCells(split))).toBe(false)
  })

  it('a partial ceiling over only the landing row-above blocks a gap jump', () => {
    expect(check(['........', '....#...', '..P..E..', '###..###']).reached).toBe(false)
  })

  it('spikes in a horizontal path block a jump along it', () => {
    expect(check(['......', '......', '.P^.E.', '######']).reached).toBe(false)
  })

  it('spikes in a step-off path block a fall', () => {
    expect(check(['P^..', '#...', '....', '...E', '####']).reached).toBe(false)
  })

  it('a 1-deep spike trough over solid is not a landing', () => {
    const map = parseLevel(['P...', '#...', '....', '.^^.', '####'])
    const reach = reachableCells(map)
    expect(reach.has(3 * 4 + 1)).toBe(false)
    expect(reach.has(3 * 4 + 2)).toBe(false)
    expect(reach.has(2 * 4 + 1)).toBe(false)
  })

  it('an exit 2 cells away from the nearest reachable cell is not reached', () => {
    expect(check(['....E', '.....', 'P....', '#####']).reached).toBe(false)
    expect(check(['.....', '....E', 'P....', '#####']).reached).toBe(true)
  })

  it('rise 4 at dx 0 is not a jump', () => {
    const rows = ['......', '......', '.E....', '.=....', '......', '......', '.P....', '##....']
    expect(check(rows).reached).toBe(false)
  })
})

describe('softlock rule (self-test)', () => {
  const pit = (col6) => parseLevel([
    '............',
    '............',
    'P.......E...',
    '#####..#####',
    '#####..#####',
    `#####.${col6}#####`.slice(0, 12),
    '#####..#####',
    '#####..#####',
    '############',
  ])

  it('flags a walled pit you can fall into but not climb out of', () => {
    expect(softlockedCells(pit('.'))).toEqual([[5, 7], [6, 7]])
  })

  it('does not flag a pit with a one-way step out', () => {
    expect(softlockedCells(pit('='))).toEqual([])
  })

  it('does not flag a pit that leaves the map (a fall is a death)', () => {
    const map = parseLevel(['............', '............', 'P.......E...', '#####..#####'])
    expect(softlockedCells(map)).toEqual([])
  })

  it('does not flag a pit with spikes in it', () => {
    const map = parseLevel([
      '............',
      '............',
      'P.......E...',
      '#####..#####',
      '#####..#####',
      '#####^^#####',
      '############',
    ])
    expect(softlockedCells(map)).toEqual([])
  })

  // A 5-wide, 4-deep walled pit the rim cannot cross (E is out of reach), so only the
  // death branch can save the cells that fall in.
  const widePit = ({ spikes = false, shaft = false } = {}) => {
    const plain = '#####.....####'
    return parseLevel([
      '..............',
      '..............',
      'P...........E.',
      plain,
      plain,
      plain,
      spikes ? '#####..^..####' : plain,
      shaft ? '#########.####' : '##############',
      shaft ? '#########.####' : '##############',
    ])
  }

  it('the wide pit really cannot reach E (cells in it are reachable)', () => {
    const map = widePit()
    const reach = reachableCells(map)
    expect(reach.has(6 * map.width + 6)).toBe(true)
    const exit = map.spawns.find((s) => s.kind === 'exit')
    expect(spawnReached(map, reach, exit)).toBe(false)
  })

  it('flags the wide pit with a plain floor (control)', () => {
    const bad = softlockedCells(widePit())
    expect(bad).toContainEqual([6, 6])
    expect(bad).toContainEqual([0, 2])
    expect(bad.length).toBeGreaterThan(0)
  })

  it('does not flag the wide pit when its floor has spikes', () => {
    expect(softlockedCells(widePit({ spikes: true }))).toEqual([])
  })

  it('does not flag the wide pit when its floor has a 1-wide void shaft', () => {
    const map = widePit({ shaft: true })
    expect(reachableCells(map).has(6 * map.width + 8)).toBe(true)
    expect(softlockedCells(map)).toEqual([])
  })

  it('flags the same pit with its shaft filled (control)', () => {
    expect(softlockedCells(widePit({ shaft: false })).length).toBeGreaterThan(0)
  })

  // The shaft in the floor ends in a spike 3 rows below any standable cell, so only the
  // step-off fall outcome 'spikes' counts as a death here.
  const spikeShaftPit = (bottom) => {
    const plain = '#####.....####'
    return parseLevel([
      '..............',
      '..............',
      'P...........E.',
      plain,
      plain,
      plain,
      plain,
      '#######.######',
      '#######.######',
      `#######${bottom}######`,
    ])
  }

  it('does not flag a pit whose floor shaft ends in spikes far below', () => {
    const map = spikeShaftPit('^')
    expect(reachableCells(map).has(6 * map.width + 6)).toBe(true)
    expect(softlockedCells(map)).toEqual([])
  })

  it('flags the same pit when the shaft ends in solid (control)', () => {
    const bad = softlockedCells(spikeShaftPit('#'))
    expect(bad).toContainEqual([6, 6])
    expect(bad.length).toBeGreaterThan(0)
  })
})
