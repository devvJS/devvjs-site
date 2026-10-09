import { describe, it, expect } from 'vitest'
import { stepBody, overlaps, groundTileUnder } from '../../../src/game/engine/physics.js'
import {
  STEP_MS, TILE, GRAVITY, MAX_FALL, JUMP_VELOCITY, MAX_JUMP_TILES_UP,
} from '../../../src/game/constants.js'
import { mapOf, bodyAt, rep } from '../helpers/maps.js'

// dt is in milliseconds, like step(STEP_MS) in the loop.
function run(body, map, steps) {
  for (let i = 0; i < steps; i++) stepBody(body, map, STEP_MS)
  return body
}

// 10 columns x 6 rows, floor on row 5 (top edge y = 80).
const FLAT = ['P.........', ...rep('..........', 4), '##########']

describe('gravity', () => {
  it('accelerates a falling body by GRAVITY * dt per step', () => {
    const map = mapOf(['P.........', ...rep('..........', 49)])
    const b = bodyAt(64, 0)
    stepBody(b, map, STEP_MS)
    expect(b.vy).toBeCloseTo(GRAVITY * (STEP_MS / 1000), 3)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.onGround).toBe(false)
    run(b, map, 9)
    expect(b.vy).toBeCloseTo(GRAVITY * (STEP_MS / 1000) * 10, 3)
    expect(b.y).toBeGreaterThan(20)
    expect(b.x).toBe(64)
  })

  it('clamps vy to MAX_FALL', () => {
    const map = mapOf(['P.........', ...rep('..........', 49)])
    const b = bodyAt(64, 0)
    run(b, map, 40)
    expect(b.vy).toBe(MAX_FALL)
    run(b, map, 5)
    expect(b.vy).toBe(MAX_FALL)
  })
})

describe('landing', () => {
  it('lands on SOLID: onGround, vy = 0, resting exactly on top', () => {
    const map = mapOf(FLAT)
    const b = bodyAt(64, 40)
    run(b, map, 120)
    expect(b.onGround).toBe(true)
    expect(b.vy).toBe(0)
    expect(b.y).toBeCloseTo(80 - b.h, 5)
    run(b, map, 10)
    expect(b.onGround).toBe(true)
    expect(b.y).toBeCloseTo(80 - b.h, 5)
  })

  it('onGround is false while airborne', () => {
    const map = mapOf(FLAT)
    const b = bodyAt(64, 10)
    stepBody(b, map, STEP_MS)
    expect(b.onGround).toBe(false)
  })

  it('conveyor tiles count as SOLID', () => {
    for (const ch of ['>', '<']) {
      const map = mapOf(['P.........', ...rep('..........', 4), ch.repeat(10)])
      const b = bodyAt(64, 40)
      run(b, map, 120)
      expect(b.onGround).toBe(true)
      expect(b.vy).toBe(0)
      expect(b.y).toBeCloseTo(80 - b.h, 5)
    }
  })
})

describe('walls', () => {
  it('zeroes vx on hitting a wall on the right and stops flush against it', () => {
    const map = mapOf(['P.........', '..........', '..........', '.....#....', '.....#....', '##########'])
    const b = bodyAt(40, 66, { vx: 130 })
    run(b, map, 30)
    expect(b.vx).toBe(0)
    expect(b.x).toBeCloseTo(80 - b.w, 5)
    expect(b.onGround).toBe(true)
  })

  it('zeroes vx on hitting a wall on the left (the map edge counts as a wall)', () => {
    const map = mapOf(FLAT)
    const b = bodyAt(20, 66, { vx: -130 })
    run(b, map, 30)
    expect(b.vx).toBe(0)
    expect(b.x).toBeCloseTo(0, 5)
  })

  it('moves freely when nothing blocks', () => {
    const map = mapOf(FLAT)
    const b = bodyAt(10, 66, { vx: 60 })
    run(b, map, 6)
    expect(b.x).toBeCloseTo(10 + 60 * (6 * STEP_MS / 1000), 3)
    expect(b.vx).toBe(60)
  })

  it('zeroes vy when bumping a ceiling', () => {
    const map = mapOf(['P.........', '..........', '....###...', '..........', '..........', '##########'])
    // body under the ceiling block (bottom of block at y = 48), rising fast
    const b = bodyAt(66, 60, { vy: -450 })
    stepBody(b, map, STEP_MS)
    run(b, map, 2)
    expect(b.y).toBeGreaterThanOrEqual(48 - 1e-6)
    expect(b.vy).toBeGreaterThanOrEqual(0)
  })
})

describe('ONEWAY platforms', () => {
  // platform on row 3 (y 48..64), floor on row 8 (y = 128)
  const rows = ['P.........', ...rep('..........', 2), '...====...', ...rep('..........', 4), '##########']

  it('lands when falling onto it from above', () => {
    const map = mapOf(rows)
    const b = bodyAt(56, 0)
    run(b, map, 60)
    expect(b.onGround).toBe(true)
    expect(b.vy).toBe(0)
    expect(b.y).toBeCloseTo(48 - b.h, 5)
  })

  it('lets the body pass up through it from below, then lands on top', () => {
    const map = mapOf(rows)
    // bottom of the body at y = 94, below the platform; rises about 56 px
    const b = bodyAt(56, 80, { vy: -JUMP_VELOCITY })
    stepBody(b, map, STEP_MS)
    expect(b.vy).toBeLessThan(0)
    expect(b.y).toBeLessThan(80)
    let minY = b.y
    for (let i = 0; i < 120; i++) {
      stepBody(b, map, STEP_MS)
      minY = Math.min(minY, b.y)
    }
    expect(minY).toBeLessThan(48 - b.h)
    expect(b.onGround).toBe(true)
    expect(b.y).toBeCloseTo(48 - b.h, 5)
  })

  it('does not block horizontal movement through its side', () => {
    const map = mapOf(rows)
    // body overlapping the platform's row, moving sideways, held up by nothing: just check x
    const b = bodyAt(20, 50, { vx: 130 })
    stepBody(b, map, STEP_MS)
    expect(b.x).toBeCloseTo(20 + 130 * (STEP_MS / 1000), 3)
    expect(b.vx).toBe(130)
  })
})

describe('jump height', () => {
  it('a JUMP_VELOCITY jump from flat ground peaks between 3 and 4 tiles', () => {
    const map = mapOf(['P.........', ...rep('..........', 9), '##########'])
    const floorTop = 10 * TILE
    const b = bodyAt(64, floorTop - 14)
    run(b, map, 5)
    expect(b.onGround).toBe(true)
    const startY = b.y
    b.vy = -JUMP_VELOCITY
    let minY = b.y
    for (let i = 0; i < 120; i++) {
      stepBody(b, map, STEP_MS)
      minY = Math.min(minY, b.y)
    }
    const rise = startY - minY
    expect(rise).toBeGreaterThan(3 * TILE)
    expect(rise).toBeLessThan(4 * TILE)
    expect(rise).toBeGreaterThanOrEqual(MAX_JUMP_TILES_UP * TILE)
    expect(b.onGround).toBe(true)
    expect(b.y).toBeCloseTo(startY, 5)
  })
})

describe('overlaps', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 }
  it('is true for real overlap and containment', () => {
    expect(overlaps(a, { x: 9, y: 9, w: 10, h: 10 })).toBe(true)
    expect(overlaps(a, { x: 2, y: 2, w: 3, h: 3 })).toBe(true)
    expect(overlaps({ x: 2, y: 2, w: 3, h: 3 }, a)).toBe(true)
  })
  it('is false when only edges touch', () => {
    expect(overlaps(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: -10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: 0, y: 10, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: 0, y: -10, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: 10, y: 10, w: 5, h: 5 })).toBe(false)
  })
  it('is false when apart', () => {
    expect(overlaps(a, { x: 50, y: 50, w: 10, h: 10 })).toBe(false)
    expect(overlaps(a, { x: 5, y: 20, w: 10, h: 10 })).toBe(false)
  })
})

describe('groundTileUnder', () => {
  // row 3 is the floor: tile ids by column 0..5 -> '#', '=', '>', '<', '^', '.'
  const map = mapOf(['P.....', '......', '......', '#=><^.'])
  const feetAt = (col) => bodyAt(col * TILE + 2, 3 * TILE - 14)

  it('returns the tile id under the feet', () => {
    expect(groundTileUnder(feetAt(0), map)).toBe(1)
    expect(groundTileUnder(feetAt(1), map)).toBe(2)
    expect(groundTileUnder(feetAt(2), map)).toBe(4)
    expect(groundTileUnder(feetAt(3), map)).toBe(5)
    expect(groundTileUnder(feetAt(4), map)).toBe(3)
  })

  it('returns EMPTY over a gap or in mid-air', () => {
    expect(groundTileUnder(feetAt(5), map)).toBe(0)
    expect(groundTileUnder(bodyAt(2, 0), map)).toBe(0)
  })
})
