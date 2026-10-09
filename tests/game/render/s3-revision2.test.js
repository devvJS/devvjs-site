import { describe, it, expect } from 'vitest'
import { createRecordingContext, minus, unionBounds, nearRect } from '../helpers/s3-recording-ctx.js'
import { loadSrc, makeState, makeWorld, makeEntity, makeMap, setTile } from '../helpers/s3-fixtures.js'

async function draw(state) {
  const { createRenderer } = await loadSrc('game/render/renderer.js')
  const ctx = createRecordingContext()
  createRenderer(ctx).draw(state, 0.5)
  return ctx
}
const playing = (w = {}) => makeState('playing', { world: makeWorld(w) })

// A tiny rasterizer over the recording ctx's fillRect records (320x180, last write wins).
function raster(records) {
  const buf = new Array(320 * 180).fill(null)
  for (const r of records) {
    if (r.fn !== 'fillRect') continue
    for (let y = Math.max(0, r.y); y < Math.min(180, r.y + r.h); y++)
      for (let x = Math.max(0, r.x); x < Math.min(320, r.x + r.w); x++) buf[y * 320 + x] = r.style
  }
  return buf
}

describe('tile pixel fidelity', () => {
  // Cells (tile coords): a 5x3 solid block at 8..12 x 4..6 (top row is solidTop, the rest solid),
  // then on row 8: one-way 14..15, spikes 17, conveyor right 18, conveyor left 19.
  // Away from the player (x 40), the HUD (top) and the floor.
  function buildMap() {
    const m = makeMap(30, 11)
    m.tiles.fill(0)
    for (let ty = 4; ty <= 6; ty++) for (let tx = 8; tx <= 12; tx++) setTile(m, tx, ty, 1)
    setTile(m, 14, 8, 2); setTile(m, 15, 8, 2)
    setTile(m, 17, 8, 3)
    setTile(m, 18, 8, 4)
    setTile(m, 19, 8, 5)
    return m
  }

  it.each(['editor', 'ci', 'prod', 'boss'])('%s: every tile kind is pixel-identical to its sprite', async (theme) => {
    const { SPRITES, PALETTE } = await loadSrc('game/render/sprites.js')
    const { hash } = await loadSrc('game/render/background.js')
    const set = SPRITES.tiles[theme]
    const map = buildMap()
    const bare = makeMap(30, 11)
    bare.tiles.fill(0)
    const time = 0 // belt frame 0
    const withTiles = raster((await draw(playing({ theme, map, time }))).records)
    const without = raster((await draw(playing({ theme, map: bare, time }))).records)

    const expected = [...without]
    const masked = new Set()
    const solidAt = (tx, ty) => ty < 0 || [1, 4, 5].includes(map.tiles[ty * map.width + tx])
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const id = map.tiles[ty * map.width + tx]
        if (!id) continue
        const sprite =
          id === 1 ? (solidAt(tx, ty - 1) ? set.solid : set.solidTop)[hash(tx, ty) % 4]
          : id === 2 ? set.oneway
          : id === 3 ? set.spikes
          : id === 4 ? set.conveyorR[0]
          : set.conveyorL[0]
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const c = sprite.rows[y][x]
            if (c !== 0) expected[(ty * 16 + y) * 320 + tx * 16 + x] = PALETTE[c]
          }
        if (theme === 'prod' && id === 1) {
          // The blinking rack LEDs are drawn over the sprite; their colors change with time.
          const { RACK_LEDS } = await loadSrc('game/render/sprites.js')
          const h = hash(tx, ty)
          const top = !solidAt(tx, ty - 1)
          const unit = top ? RACK_LEDS.unit : RACK_LEDS.unit * (h % 4)
          for (const lx of RACK_LEDS.xs) masked.add((ty * 16 + unit + 1) * 320 + tx * 16 + lx)
        }
      }
    }
    let changed = 0
    for (let i = 0; i < withTiles.length; i++) if (withTiles[i] !== without[i]) changed++
    expect(changed, 'the tiles change the picture').toBeGreaterThan(500)

    const bad = []
    for (let i = 0; i < expected.length; i++) {
      if (masked.has(i)) continue
      if (withTiles[i] !== expected[i]) bad.push(`${i % 320},${Math.floor(i / 320)} got ${withTiles[i]} want ${expected[i]}`)
    }
    expect(bad.slice(0, 5)).toEqual([])
  })
})

describe('boss projectile art identity', () => {
  async function added(variant) {
    const e = makeEntity('bossProjectile', { variant, id: 4, x: 150, y: 70 })
    return minus((await draw(playing({ entities: [e] }))).records, (await draw(playing())).records).filter((r) => r.fn === 'fillRect')
  }
  function describeSprite(s, PALETTE) {
    let minX = 99, minY = 99, maxX = -1, maxY = -1
    const colors = new Set()
    s.rows.forEach((row, y) => row.forEach((c, x) => {
      if (!c) return
      colors.add(PALETTE[c])
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }))
    return { w: maxX - minX + 1, h: maxY - minY + 1, colors: [...colors].sort() }
  }
  const look = (recs) => {
    const b = unionBounds(recs)
    return { w: b.maxX - b.minX, h: b.maxY - b.minY, colors: [...new Set(recs.map((r) => r.style))].sort() }
  }

  it('ask is the quick-ask sprite and ticket is the ticket sprite', async () => {
    const { SPRITES, PALETTE } = await loadSrc('game/render/sprites.js')
    const ask = describeSprite(SPRITES.variant.quickAsk, PALETTE)
    const ticket = describeSprite(SPRITES.entity.bossProjectile, PALETTE)
    expect(JSON.stringify(ask)).not.toBe(JSON.stringify(ticket)) // else the test can't tell them apart
    expect(look(await added('ask'))).toEqual(ask)
    expect(look(await added('ticket'))).toEqual(ticket)
  })
})

describe('boss visuals (cosmetic)', () => {
  const boss = (over) => makeEntity('boss', { x: 240, y: 100, ...over })
  const styles = async (b) => {
    const ctx = await draw(playing({ entities: [b] }))
    return [...new Set(nearRect(ctx.records, b, 0).map((r) => r.style))].sort()
  }

  it('is drawn with a different palette while on a call', async () => {
    expect(await styles(boss({ onCall: true }))).not.toEqual(await styles(boss({ onCall: false })))
  })

  it('anim "hit" is drawn differently from idle', async () => {
    const a = await draw(playing({ entities: [boss({ anim: 'hit' })] }))
    const b = await draw(playing({ entities: [boss({ anim: 'idle' })] }))
    expect(a.records).not.toEqual(b.records)
  })
})
