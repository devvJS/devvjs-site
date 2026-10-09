import { describe, it, expect } from 'vitest'
import { createRecordingContext, textsOf, minus, unionBounds } from '../helpers/s3-recording-ctx.js'
import { loadSrc, makeState, makeWorld, makeEntity, makeMap, makePlayer } from '../helpers/s3-fixtures.js'

async function draw(state, alpha = 0.5) {
  const { createRenderer } = await loadSrc('game/render/renderer.js')
  const ctx = createRecordingContext()
  createRenderer(ctx).draw(state, alpha)
  return ctx
}
const playing = (w = {}, s = {}) => makeState('playing', { world: makeWorld(w), ...s })

// ---------- A4, A5, A2, A3: the real S1 shapes ----------
describe('crusher (real S1 shape: 16x16 box, topY fixed, y moves)', () => {
  const crusher = (over) => ({ ...makeEntity('crusher'), x: 100, y: 100, w: 16, h: 16, topY: 40, travel: 60, stage: 'down', ...over })

  it('draws the ram between topY and the head', async () => {
    const e = crusher()
    const ctx = await draw(playing({ entities: [e] }))
    const base = await draw(playing())
    const added = minus(ctx.records, base.records).filter((r) => r.fn !== 'fillText')
    for (const probe of [44, 60, 80, 96]) {
      const covered = added.some(
        (r) => r.y <= probe && probe < r.y + r.h && r.x < e.x + e.w && r.x + r.w > e.x,
      )
      expect(covered, `column covered at y=${probe}`).toBe(true)
    }
  })

  it('draws the ram from topY while the head is only just below it', async () => {
    const e = crusher({ y: 56, stage: 'slam' })
    const added = minus((await draw(playing({ entities: [e] }))).records, (await draw(playing())).records)
    const b = unionBounds(added)
    expect(b.minY).toBeLessThanOrEqual(42)
  })

  it('stays inside its column and the head box (no stray art far off)', async () => {
    const e = crusher()
    const added = minus((await draw(playing({ entities: [e] }))).records, (await draw(playing())).records)
    const b = unionBounds(added)
    expect(b.minX).toBeGreaterThanOrEqual(e.x - 10)
    expect(b.maxX).toBeLessThanOrEqual(e.x + e.w + 10)
    expect(b.maxY).toBeLessThanOrEqual(e.y + e.h + 10)
  })
})

describe('bossProjectile variant', () => {
  const bp = (variant, id) => makeEntity('bossProjectile', { variant, id, x: 150, y: 70 })
  const rec = async (variant, id) => (await draw(playing({ entities: [bp(variant, id)] }))).records

  it('draws asks the same whatever the id parity, and tickets the same', async () => {
    expect(await rec('ask', 10)).toEqual(await rec('ask', 11))
    expect(await rec('ticket', 20)).toEqual(await rec('ticket', 21))
    expect(await rec('ask', 12)).toEqual(await rec('ask', 13))
    expect(await rec('ticket', 22)).toEqual(await rec('ticket', 23))
  })

  it('draws asks and tickets differently', async () => {
    for (const id of [10, 11]) expect(await rec('ask', id)).not.toEqual(await rec('ticket', id))
  })
})

describe('boss on a call', () => {
  const boss = (over) => makeEntity('boss', { x: 240, y: 100, ...over })
  const callText = (ctx, b) =>
    ctx.records.filter((r) => r.fn === 'fillText' && /on a call/i.test(r.text) &&
      r.x > b.x - 60 && r.x < b.x + b.w + 60 && r.y > b.y - 60 && r.y < b.y + b.h + 20)

  it('shows ON A CALL near the boss while onCall', async () => {
    const b = boss({ onCall: true })
    expect(callText(await draw(playing({ entities: [b] })), b).length).toBeGreaterThan(0)
  })

  it('shows no call text when not on a call, or when only warning', async () => {
    const b = boss({ onCall: false })
    expect(textsOf((await draw(playing({ entities: [b] }))).records).join('\n')).not.toMatch(/on a call/i)
    const w = boss({ onCall: false, callWarn: true })
    expect(textsOf((await draw(playing({ entities: [w] }))).records).join('\n')).not.toMatch(/on a call/i)
  })

  it('shows a "!" near the boss while callWarn, and not otherwise', async () => {
    const b = boss({ callWarn: true })
    const warn = (await draw(playing({ entities: [b] }))).records.filter(
      (r) => r.fn === 'fillText' && r.text.trim() === '!' && r.x > b.x - 40 && r.x < b.x + b.w + 40 && r.y > b.y - 40 && r.y < b.y + b.h + 20,
    )
    expect(warn.length).toBeGreaterThan(0)
    const none = await draw(playing({ entities: [boss({ callWarn: false })] }))
    expect(textsOf(none.records)).not.toContain('!')
  })
})

describe('telegraphs draw differently from the quiet state', () => {
  async function pair(a, b, pad = 10) {
    const A = await draw(playing({ entities: [a] }))
    const B = await draw(playing({ entities: [b] }))
    expect(A.records).not.toEqual(B.records)
    const only = [...minus(A.records, B.records), ...minus(B.records, A.records)]
    const box = { x: a.x, y: Math.min(a.topY ?? a.y, a.y), w: a.w, h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.topY ?? a.y, a.y) }
    const bb = unionBounds(only)
    expect(bb.minX).toBeGreaterThanOrEqual(box.x - pad)
    expect(bb.maxX).toBeLessThanOrEqual(box.x + box.w + pad)
    expect(bb.minY).toBeGreaterThanOrEqual(box.y - pad)
    expect(bb.maxY).toBeLessThanOrEqual(box.y + box.h + pad)
  }

  it('crusher stage warn vs rest', async () => {
    const base = { ...makeEntity('crusher'), x: 100, y: 40, w: 16, h: 16, topY: 40, travel: 60 }
    await pair({ ...base, stage: 'warn' }, { ...base, stage: 'rest' })
  })
  it('alertDropper warn vs not', async () => {
    await pair(makeEntity('alertDropper', { x: 100, y: 30, warn: true }), makeEntity('alertDropper', { x: 100, y: 30, warn: false }))
  })
  it('flakyTest warn vs not (intangible)', async () => {
    await pair(makeEntity('flakyTest', { solid: false, warn: true }), makeEntity('flakyTest', { solid: false, warn: false }))
  })
})

// ---------- A6 + B: perf and culling on the real levels ----------
describe('frame budget on the real levels', () => {
  async function worst(levelIdx) {
    const { LEVELS } = await loadSrc('game/levels/index.js')
    const { createWorld } = await loadSrc('game/world/index.js')
    const { createRenderer } = await loadSrc('game/render/renderer.js')
    const world = createWorld(LEVELS[levelIdx], { seed: 1 })
    const state = makeState('playing', { world })
    const maxX = world.map.width * 16 - 320
    const maxY = Math.max(0, world.map.height * 16 - 180)
    let max = 0
    for (let x = 0; x <= maxX; x += 16) {
      for (const y of new Set([0, maxY])) {
        world.camera = { x, y }
        const ctx = createRecordingContext()
        createRenderer(ctx).draw(state, 0.5)
        max = Math.max(max, ctx.calls.length)
      }
    }
    return max
  }
  it('prod draws at most 3000 ctx calls per frame at its densest view', async () => {
    expect(await worst(2)).toBeLessThanOrEqual(3000)
  })
  it('boss level draws at most 3000 ctx calls per frame at its densest view', async () => {
    expect(await worst(3)).toBeLessThanOrEqual(3000)
  })
})

describe('culling (gap tests)', () => {
  it('call count does not depend on map size', async () => {
    const small = await draw(playing({ map: makeMap(60, 14), camera: { x: 640, y: 0 } }))
    const big = await draw(playing({ map: makeMap(600, 14), camera: { x: 640, y: 0 } }))
    expect(big.calls.length).toBe(small.calls.length)
  })

  it('far-away entities cost no ctx calls', async () => {
    const far = Array.from({ length: 200 }, (_, i) => makeEntity('bug', { x: 2000 + i * 40, y: 132 }))
    const a = await draw(playing({ map: makeMap(600, 14), entities: far }))
    const b = await draw(playing({ map: makeMap(600, 14), entities: [] }))
    expect(a.calls.length).toBe(b.calls.length)
  })
})

describe('other gaps', () => {
  it('re-asserts imageSmoothingEnabled=false on every draw', async () => {
    const { createRenderer } = await loadSrc('game/render/renderer.js')
    const ctx = createRecordingContext()
    const r = createRenderer(ctx)
    r.draw(playing(), 0.5)
    ctx.imageSmoothingEnabled = true
    r.draw(playing(), 0.5)
    expect(ctx.imageSmoothingEnabled).toBe(false)
  })

  it('the canvas HUD cooldown sweep changes with the cooldown fraction (one renderer, as in the game)', async () => {
    const { ECHO_COOLDOWN_MS } = await loadSrc('game/world/index.js')
    const { createRenderer } = await loadSrc('game/render/renderer.js')
    const ctx = createRecordingContext()
    const r = createRenderer(ctx)
    const recs = []
    for (const f of [1, 0.75, 0.5, 0.25]) {
      const player = makePlayer({ powers: { echo: true, sudo: false, rmrf: false }, cooldowns: { echo: ECHO_COOLDOWN_MS * f, sudo: 0, rmrf: 0 } })
      ctx.reset()
      r.draw(playing({ player }), 0.5)
      recs.push(JSON.stringify(ctx.records))
    }
    expect(new Set(recs).size).toBe(4)
  })

  it('the boss bar changes with the phase', async () => {
    const t = async (phase) =>
      JSON.stringify((await draw(playing({ entities: [makeEntity('boss', { x: 240, y: 100, hp: 20, phase })] }))).records)
    const [a, b, c] = [await t(1), await t(2), await t(3)]
    expect(new Set([a, b, c]).size).toBe(3)
  })
})
