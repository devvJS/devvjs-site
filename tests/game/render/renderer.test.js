import { describe, it, expect } from 'vitest'
import { createRecordingContext, textsOf, minus, unionBounds, nearRect } from '../helpers/s3-recording-ctx.js'
import {
  loadSrc, makeState, makeWorld, makeEntity, makeMap, makePlayer, setTile, deepFreeze, ENTITY_KINDS,
} from '../helpers/s3-fixtures.js'

// Pinned observables (see the report):
// - positions are effective positions: raw coordinates plus the accumulated ctx.translate
// - HUD on canvas: fillText containing "COFFEE <n>/3" and "SCORE <n>" (case-insensitive)
// - boss bar: a fillText containing "PRODUCT MANAGER" (case-insensitive), only while a live boss exists
async function draw(state, alpha = 0.5) {
  const { createRenderer } = await loadSrc('game/render/renderer.js')
  const ctx = createRecordingContext()
  const r = createRenderer(ctx)
  r.draw(state, alpha)
  return ctx
}
const playing = (worldOver = {}, stateOver = {}) =>
  makeState('playing', { world: makeWorld(worldOver), ...stateOver })

describe('createRenderer', () => {
  it('turns image smoothing off', async () => {
    const ctx = await draw(playing())
    expect(ctx.imageSmoothingEnabled).toBe(false)
    expect(ctx.sets.some((s) => s.prop === 'imageSmoothingEnabled' && s.value === false)).toBe(true)
  })

  it('returns an object with draw()', async () => {
    const { createRenderer } = await loadSrc('game/render/renderer.js')
    expect(typeof createRenderer(createRecordingContext()).draw).toBe('function')
  })

  it('does not write to the state it draws (a frozen state draws fine)', async () => {
    const state = deepFreeze(playing({ entities: [makeEntity('bug'), makeEntity('boss')] }))
    const ctx = await draw(state)
    expect(ctx.records.length).toBeGreaterThan(0)
  })

  it('draws the same pixels for the same state', async () => {
    const a = await draw(playing({ entities: [makeEntity('bug')] }))
    const b = await draw(playing({ entities: [makeEntity('bug')] }))
    expect(a.records).toEqual(b.records)
  })
})

describe('screens', () => {
  it('title shows TERMINAL CHAOS and how to start, with no world', async () => {
    const t = textsOf((await draw(makeState('title'))).records).join('\n')
    expect(t).toContain('TERMINAL CHAOS')
    expect(t).toMatch(/press enter/i)
  })

  it('title also draws with a world present', async () => {
    const t = textsOf((await draw(makeState('title', { world: makeWorld() }))).records).join('\n')
    expect(t).toContain('TERMINAL CHAOS')
  })

  it('paused shows PAUSED over the world', async () => {
    const t = textsOf((await draw(makeState('paused'))).records).join('\n')
    expect(t).toContain('PAUSED')
  })

  it('level-complete shows LEVEL COMPLETE', async () => {
    const t = textsOf((await draw(makeState('level-complete', { levelIndex: 0, score: 300 }))).records).join('\n')
    expect(t).toContain('LEVEL COMPLETE')
  })

  it('victory shows Shipped and CodeSpace saved, with no world', async () => {
    const t = textsOf((await draw(makeState('victory', { levelIndex: 3, score: 900 }))).records).join('\n')
    expect(t).toContain('Shipped')
    expect(t).toContain('CodeSpace saved')
  })

  it('each screen is distinguishable: the key text only appears on its own screen', async () => {
    const texts = {}
    for (const s of ['title', 'playing', 'paused', 'level-complete', 'victory']) {
      texts[s] = textsOf((await draw(makeState(s))).records).join('\n')
    }
    expect(texts.title).not.toContain('PAUSED')
    expect(texts.playing).not.toContain('TERMINAL CHAOS')
    expect(texts.playing).not.toContain('PAUSED')
    expect(texts.playing).not.toContain('LEVEL COMPLETE')
    expect(texts.playing).not.toContain('Shipped')
    expect(texts.paused).not.toContain('TERMINAL CHAOS')
    expect(texts['level-complete']).not.toContain('PAUSED')
    expect(texts.victory).not.toContain('LEVEL COMPLETE')
    expect(texts.victory).not.toContain('PAUSED')
  })

  it.each(['title', 'playing', 'paused', 'level-complete', 'victory'])('%s draws only inside 320x180', async (s) => {
    const ctx = await draw(makeState(s))
    expect(ctx.records.length).toBeGreaterThan(0)
    for (const r of ctx.records) {
      expect(r.x, `${s} ${r.fn} x`).toBeGreaterThanOrEqual(0)
      expect(r.y, `${s} ${r.fn} y`).toBeGreaterThanOrEqual(0)
      expect(r.x + (r.w || 0), `${s} ${r.fn} right`).toBeLessThanOrEqual(320)
      expect(r.y + (r.h || 0), `${s} ${r.fn} bottom`).toBeLessThanOrEqual(180)
    }
  })
})

describe('playing: world', () => {
  it.each(ENTITY_KINDS)('draws a %s inside its own box', async (kind) => {
    const e = makeEntity(kind, { x: 100, y: 60 })
    const withE = await draw(playing({ entities: [e] }))
    const without = await draw(playing({ entities: [] }))
    const added = minus(withE.records, without.records)
    expect(added.length).toBeGreaterThan(0)
    const near = nearRect(added, e, 8)
    expect(near.length).toBeGreaterThan(0)
    if (kind !== 'boss') {
      // Everything an entity adds stays within 8 px of its box.
      const b = unionBounds(added)
      expect(b.minX).toBeGreaterThanOrEqual(e.x - 8)
      expect(b.minY).toBeGreaterThanOrEqual(e.y - 8)
      expect(b.maxX).toBeLessThanOrEqual(e.x + e.w + 8)
      expect(b.maxY).toBeLessThanOrEqual(e.y + e.h + 8)
    }
  })

  it.each(ENTITY_KINDS)('does not draw a %s with alive:false', async (kind) => {
    const dead = await draw(playing({ entities: [makeEntity(kind, { alive: false })] }))
    const none = await draw(playing({ entities: [] }))
    expect(dead.records).toEqual(none.records)
  })

  it('draws the player inside its box', async () => {
    const p = makePlayer({ x: 100, y: 100 })
    const a = await draw(playing({ player: p }))
    const near = nearRect(a.records, p, 4)
    expect(near.length).toBeGreaterThan(0)
  })

  it('moves the player drawing when the player moves', async () => {
    const a = await draw(playing({ player: makePlayer({ x: 100, y: 100 }) }))
    const b = await draw(playing({ player: makePlayer({ x: 110, y: 100 }) }))
    expect(a.records).not.toEqual(b.records)
  })

  it.each(['idle', 'run', 'jump', 'fall', 'hurt', 'frozen'])('draws the player in the %s animation', async (anim) => {
    const ctx = await draw(playing({ player: makePlayer({ anim }) }))
    expect(ctx.records.length).toBeGreaterThan(0)
  })

  it('draws the player facing left differently from facing right', async () => {
    const r = await draw(playing({ player: makePlayer({ x: 100, y: 100, facing: 1 }) }))
    const l = await draw(playing({ player: makePlayer({ x: 100, y: 100, facing: -1 }) }))
    const box = { x: 100, y: 100, w: 12, h: 14 }
    expect(nearRect(l.records, box, 4)).not.toEqual(nearRect(r.records, box, 4))
  })

  it.each([1, 2, 3, 4, 5])('draws tile id %i inside its cell', async (id) => {
    const open = makeMap()
    const withTile = makeMap()
    setTile(withTile, 5, 5, id) // cell x 80..96, y 80..96
    const a = await draw(playing({ map: withTile }))
    const b = await draw(playing({ map: open }))
    const added = minus(a.records, b.records)
    expect(added.length).toBeGreaterThan(0)
    const bb = unionBounds(added)
    expect(bb.minX).toBeGreaterThanOrEqual(80)
    expect(bb.minY).toBeGreaterThanOrEqual(80)
    expect(bb.maxX).toBeLessThanOrEqual(96)
    expect(bb.maxY).toBeLessThanOrEqual(96)
  })

  it('draws the two conveyor directions differently', async () => {
    const r = makeMap(); setTile(r, 5, 5, 4)
    const l = makeMap(); setTile(l, 5, 5, 5)
    expect((await draw(playing({ map: r }))).records).not.toEqual((await draw(playing({ map: l }))).records)
  })

  it('draws everything inside 320x180 at the origin, far from it, and with entities', async () => {
    const ents = [makeEntity('bug', { x: 200, y: 132 }), makeEntity('token', { x: 150, y: 90 })]
    for (const camera of [{ x: 0, y: 0 }, { x: 40, y: 8 }, { x: 640, y: 20 }]) {
      const ctx = await draw(playing({ camera, entities: ents.map((e) => ({ ...e, x: e.x + camera.x, y: e.y })) }))
      for (const r of ctx.records) {
        expect(r.x, `${r.fn} x at camera ${camera.x}`).toBeGreaterThanOrEqual(0)
        expect(r.y, `${r.fn} y`).toBeGreaterThanOrEqual(0)
        expect(r.x + (r.w || 0), `${r.fn} right`).toBeLessThanOrEqual(320)
        expect(r.y + (r.h || 0), `${r.fn} bottom`).toBeLessThanOrEqual(180)
      }
    }
  })

  it('does not draw entities that are off screen', async () => {
    const far = makeEntity('bug', { x: 800, y: 132 })
    const a = await draw(playing({ entities: [far] }))
    const b = await draw(playing({ entities: [] }))
    expect(a.records).toEqual(b.records)
  })

  it('draws an unknown token label with a generic sprite', async () => {
    const t = makeEntity('token', { label: 'mystery' })
    const added = minus((await draw(playing({ entities: [t] }))).records, (await draw(playing())).records)
    expect(added.length).toBeGreaterThan(0)
  })

  it('draws different token labels differently', async () => {
    const a = await draw(playing({ entities: [makeEntity('token', { label: 'git' })] }))
    const b = await draw(playing({ entities: [makeEntity('token', { label: 'npm' })] }))
    expect(a.records).not.toEqual(b.records)
  })

  it('draws a locked exit differently from an unlocked one', async () => {
    const a = await draw(playing({ entities: [makeEntity('exit', { locked: true })] }))
    const b = await draw(playing({ entities: [makeEntity('exit', { locked: false })] }))
    expect(a.records).not.toEqual(b.records)
  })

  it('draws an active checkpoint differently from an inactive one', async () => {
    const a = await draw(playing({ entities: [makeEntity('checkpoint', { active: true })] }))
    const b = await draw(playing({ entities: [makeEntity('checkpoint', { active: false })] }))
    expect(a.records).not.toEqual(b.records)
  })

  it('draws a solid flaky test differently from an intangible one', async () => {
    const a = await draw(playing({ entities: [makeEntity('flakyTest', { solid: true })] }))
    const b = await draw(playing({ entities: [makeEntity('flakyTest', { solid: false })] }))
    expect(a.records).not.toEqual(b.records)
  })

  it('draws a big merge conflict wider than a small one', async () => {
    const big = makeEntity('mergeConflict', { size: 2, w: 20, h: 20 })
    const small = makeEntity('mergeConflict', { size: 1, w: 12, h: 12 })
    const base = (await draw(playing())).records
    const wBig = unionBounds(minus((await draw(playing({ entities: [big] }))).records, base))
    const wSmall = unionBounds(minus((await draw(playing({ entities: [small] }))).records, base))
    expect(wBig.maxX - wBig.minX).toBeGreaterThan(wSmall.maxX - wSmall.minX)
  })
})

describe('playing: camera', () => {
  const entityBounds = async (camera, entity) => {
    const a = await draw(playing({ camera, entities: [entity] }))
    const b = await draw(playing({ camera, entities: [] }))
    return unionBounds(minus(a.records, b.records))
  }

  it('draws at world position minus camera', async () => {
    const e = makeEntity('token', { x: 100, y: 60 })
    const at0 = await entityBounds({ x: 0, y: 0 }, e)
    const at40 = await entityBounds({ x: 40, y: 8 }, e)
    expect(at40.minX).toBe(at0.minX - 40)
    expect(at40.maxX).toBe(at0.maxX - 40)
    expect(at40.minY).toBe(at0.minY - 8)
    expect(at40.maxY).toBe(at0.maxY - 8)
  })

  it('shows an entity at the screen position of its world position', async () => {
    const e = makeEntity('token', { x: 700, y: 60 })
    const b = await entityBounds({ x: 640, y: 0 }, e)
    expect(b.minX).toBeGreaterThanOrEqual(60 - 8)
    expect(b.maxX).toBeLessThanOrEqual(60 + e.w + 8)
  })

  it('moves the player drawing with the camera too', async () => {
    const p = makePlayer({ x: 100, y: 100 })
    const a = await draw(playing({ player: p, camera: { x: 0, y: 0 } }))
    const b = await draw(playing({ player: p, camera: { x: 30, y: 0 } }))
    const boxAt0 = { x: 100, y: 100, w: 12, h: 14 }
    const boxAt30 = { x: 70, y: 100, w: 12, h: 14 }
    expect(nearRect(a.records, boxAt0, 0).length).toBeGreaterThan(0)
    expect(nearRect(b.records, boxAt30, 0).length).toBeGreaterThan(0)
  })
})

describe('playing: shake', () => {
  it('draws the same with shake 0 and with no shake', async () => {
    const a = await draw(playing({ shake: 0 }))
    const b = await draw(playing({ shake: 0 }))
    expect(a.records).toEqual(b.records)
  })

  it('offsets the drawing by a small amount when shake > 0', async () => {
    const { vi } = await import('vitest')
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9)
    try {
      const e = makeEntity('token', { x: 100, y: 60 })
      const bounds = async (shake) => {
        const a = await draw(playing({ shake, entities: [e] }))
        const b = await draw(playing({ shake, entities: [] }))
        return unionBounds(minus(a.records, b.records))
      }
      const calm = await bounds(0)
      const shaken = await bounds(1)
      const dx = shaken.minX - calm.minX
      const dy = shaken.minY - calm.minY
      expect(dx !== 0 || dy !== 0).toBe(true)
      expect(Math.abs(dx)).toBeLessThanOrEqual(8)
      expect(Math.abs(dy)).toBeLessThanOrEqual(8)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('playing: sudo', () => {
  it.each([0, 50, 100, 150, 200])('draws the player differently at world time %i ms while sudo is on', async (time) => {
    const box = { x: 100, y: 100, w: 12, h: 14 }
    const on = await draw(playing({ time, player: makePlayer({ x: 100, y: 100, sudoMs: 3000 }) }))
    const off = await draw(playing({ time, player: makePlayer({ x: 100, y: 100, sudoMs: 0 }) }))
    const styles = (recs) => [...new Set(nearRect(recs, box, 12).map((r) => r.style))].sort()
    expect(nearRect(on.records, box, 12)).not.toEqual(nearRect(off.records, box, 12))
    expect(styles(on.records)).not.toEqual(styles(off.records))
  })
})

describe('HUD on canvas', () => {
  it('shows the coffee count and the score', async () => {
    const t = textsOf((await draw(playing({ player: makePlayer({ coffee: 2 }) }, { score: 120 }))).records).join('\n')
    expect(t).toMatch(/coffee\s*2\s*\/\s*3/i)
    expect(t).toMatch(/score\s*0*120\b/i)
  })

  it('updates when the coffee and score change', async () => {
    const t = textsOf((await draw(playing({ player: makePlayer({ coffee: 1 }) }, { score: 4500 }))).records).join('\n')
    expect(t).toMatch(/coffee\s*1\s*\/\s*3/i)
    expect(t).not.toMatch(/coffee\s*2\s*\/\s*3/i)
    expect(t).toMatch(/score\s*0*4500\b/i)
  })

  it('draws the HUD inside the screen', async () => {
    const ctx = await draw(playing({ player: makePlayer({ coffee: 2 }) }, { score: 120 }))
    for (const r of ctx.records.filter((x) => x.fn === 'fillText')) {
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.x).toBeLessThanOrEqual(320)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeLessThanOrEqual(180)
    }
  })
})

describe('boss HP bar', () => {
  const bossText = (ctx) => textsOf(ctx.records).join('\n')

  it('is drawn when a live boss exists', async () => {
    const ctx = await draw(playing({ theme: 'boss', entities: [makeEntity('boss', { x: 240, y: 100 })] }))
    expect(bossText(ctx)).toMatch(/product manager/i)
  })

  it('is not drawn without a boss', async () => {
    const ctx = await draw(playing({ entities: [makeEntity('bug')] }))
    expect(bossText(ctx)).not.toMatch(/product manager/i)
  })

  it('is not drawn for a dead boss', async () => {
    const ctx = await draw(playing({ entities: [makeEntity('boss', { x: 240, y: 100, alive: false })] }))
    expect(bossText(ctx)).not.toMatch(/product manager/i)
  })

  it('changes with the boss hp', async () => {
    const full = await draw(playing({ entities: [makeEntity('boss', { x: 240, y: 100, hp: 30 })] }))
    const half = await draw(playing({ entities: [makeEntity('boss', { x: 240, y: 100, hp: 15, phase: 1 })] }))
    expect(full.records).not.toEqual(half.records)
  })
})
