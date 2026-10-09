import { describe, it, expect } from 'vitest'
import { loadSrc, ENTITY_KINDS } from '../helpers/s3-fixtures.js'

// Pinned export shape of src/game/render/sprites.js:
//   PALETTE: string[]   index 0 is null (transparent), every other entry is '#rrggbb'
//   SPRITES: { player, entity: { <kind> }, tile: { <id 1..5> }, token: { <label> } }
//   a sprite is { w, h, rows } with rows = h arrays of w integers, each a valid PALETTE index
const TOKEN_LABELS = ['{ }', '=>', ';', 'test()', 'expect', 'npm', 'git', 'deploy', 'logs']
const TILE_IDS = [1, 2, 3, 4, 5]

const load = () => loadSrc('game/render/sprites.js')

function expectWellFormed(sprite, palette, name) {
  expect(sprite, `${name} exists`).toBeTruthy()
  expect(Number.isInteger(sprite.w) && sprite.w > 0 && sprite.w <= 64, `${name} w`).toBe(true)
  expect(Number.isInteger(sprite.h) && sprite.h > 0 && sprite.h <= 64, `${name} h`).toBe(true)
  expect(sprite.rows.length, `${name} row count`).toBe(sprite.h)
  let opaque = 0
  for (const row of sprite.rows) {
    expect(row.length, `${name} row width`).toBe(sprite.w)
    for (const idx of row) {
      expect(Number.isInteger(idx) && idx >= 0 && idx < palette.length, `${name} index ${idx}`).toBe(true)
      if (idx !== 0) opaque++
    }
  }
  expect(opaque, `${name} has visible pixels`).toBeGreaterThan(0)
}

describe('sprites palette', () => {
  it('has a transparent slot 0 and #rrggbb colors after it', async () => {
    const { PALETTE } = await load()
    expect(PALETTE[0]).toBeNull()
    for (const c of PALETTE.slice(1)) expect(c).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('includes the site colors', async () => {
    const { PALETTE } = await load()
    const lower = PALETTE.map((c) => c && c.toLowerCase())
    for (const c of ['#39ff14', '#00e5ff', '#0d0f12']) expect(lower).toContain(c)
  })
})

describe('sprites', () => {
  it('has a well-formed player sprite', async () => {
    const { SPRITES, PALETTE } = await load()
    expectWellFormed(SPRITES.player, PALETTE, 'player')
  })

  it.each(ENTITY_KINDS)('has a well-formed sprite for entity kind %s', async (kind) => {
    const { SPRITES, PALETTE } = await load()
    expectWellFormed(SPRITES.entity[kind], PALETTE, `entity ${kind}`)
  })

  it.each(TILE_IDS)('has a well-formed sprite for tile id %i', async (id) => {
    const { SPRITES, PALETTE } = await load()
    expectWellFormed(SPRITES.tile[id], PALETTE, `tile ${id}`)
  })

  it.each(TOKEN_LABELS)('has a well-formed sprite for token label %s', async (label) => {
    const { SPRITES, PALETTE } = await load()
    expectWellFormed(SPRITES.token[label], PALETTE, `token ${label}`)
  })

  it('gives different art to the player, a bug and the boss', async () => {
    const { SPRITES } = await load()
    const j = (s) => JSON.stringify(s.rows)
    expect(new Set([j(SPRITES.player), j(SPRITES.entity.bug), j(SPRITES.entity.boss)]).size).toBe(3)
  })

  it('gives each token label its own art', async () => {
    const { SPRITES } = await load()
    const arts = TOKEN_LABELS.map((l) => JSON.stringify(SPRITES.token[l].rows))
    expect(new Set(arts).size).toBe(TOKEN_LABELS.length)
  })

  it('gives the two conveyor directions different art', async () => {
    const { SPRITES } = await load()
    expect(JSON.stringify(SPRITES.tile[4].rows)).not.toBe(JSON.stringify(SPRITES.tile[5].rows))
  })
})
