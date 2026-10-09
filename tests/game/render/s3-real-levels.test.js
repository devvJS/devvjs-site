import { describe, it, expect } from 'vitest'
import { createRecordingContext } from '../helpers/s3-recording-ctx.js'
import { loadSrc } from '../helpers/s3-fixtures.js'
import { frame, tap, hold } from '../helpers/s1-world.js'
import { STEP_MS } from '../../../src/game/constants.js'

// Revision 1: draws every frame of a real run (real LEVELS, createWorld, stepWorld, createGame):
// title, the three levels, level-complete screens, the boss to defeat, victory.
describe('render smoke test on the real game', () => {
  it('draws every frame of a full run without throwing, NaN or drawing outside 320x180', async () => {
    const { LEVELS } = await loadSrc('game/levels/index.js')
    const { createWorld, stepWorld } = await loadSrc('game/world/index.js')
    const { createGame } = await loadSrc('game/game.js')
    const { createRenderer } = await loadSrc('game/render/renderer.js')
    const store = new Map()
    const game = createGame({
      levels: LEVELS, createWorld, stepWorld,
      storage: { get: (k) => store.get(k) ?? null, set: (k, v) => store.set(k, v) },
    })
    const ctx = createRecordingContext()
    const renderer = createRenderer(ctx)
    const seen = new Set()
    let frames = 0

    const look = () => {
      ctx.reset()
      renderer.draw(game.state, 0.5)
      frames++
      seen.add(game.state.screen)
      expect(ctx.records.length).toBeGreaterThan(0)
      for (const r of ctx.records) {
        for (const k of ['x', 'y', 'w', 'h']) {
          if (!Number.isFinite(r[k])) throw new Error(`${r.fn} ${k}=${r[k]} on ${game.state.screen}`)
        }
        if (r.x < 0 || r.y < 0 || r.x + r.w > 320 || r.y + r.h > 180) {
          throw new Error(`${r.fn} outside the view: ${r.x},${r.y} ${r.w}x${r.h} on ${game.state.screen}`)
        }
      }
    }
    const step = (fi) => {
      const ev = game.update(fi, STEP_MS)
      look()
      return ev
    }

    look() // title
    expect(game.state.screen).toBe('title')
    step(tap('start'))
    expect(game.state.screen).toBe('playing')

    for (let lv = 0; lv < 3; lv++) {
      expect(game.state.levelIndex).toBe(lv)
      // Walk a little, jump, then teleport to the exit with its power unlocked.
      for (let i = 0; i < 60; i++) step(i < 30 ? hold('right') : hold('right', 'jump'))
      const w = game.state.world
      const power = LEVELS[lv].power
      w.player.powers[power] = true
      const exit = w.entities.find((e) => e.kind === 'exit')
      exit.locked = false
      let done = false
      for (let i = 0; i < 600 && !done; i++) {
        w.player.x = exit.x
        w.player.y = exit.y + exit.h - w.player.h
        w.player.coffee = 3
        step(frame())
        done = game.state.screen === 'level-complete'
      }
      expect(game.state.screen, `level ${lv + 1} completes`).toBe('level-complete')
      for (let i = 0; i < 10; i++) step(frame())
      step(tap('start'))
      expect(game.state.screen).toBe('playing')
    }

    // Boss: stand next to him with echo, hit until he falls.
    expect(game.state.levelIndex).toBe(3)
    const bw = game.state.world
    const boss = bw.entities.find((e) => e.kind === 'boss')
    boss.hp = 1
    bw.player.powers.echo = true
    for (let i = 0; i < 20000 && game.state.screen === 'playing'; i++) {
      const p = bw.player
      p.x = boss.x - 40
      p.y = boss.y + boss.h - p.h
      p.facing = 1
      p.coffee = 3
      step(i % 20 === 0 ? tap('echo') : frame())
    }
    for (let i = 0; i < 600 && game.state.screen === 'playing'; i++) step(frame())
    expect(game.state.screen).toBe('victory')
    for (let i = 0; i < 30; i++) step(frame())
    step(tap('start'))
    expect(game.state.screen).toBe('title')
    for (const s of ['title', 'playing', 'level-complete', 'victory']) expect(seen.has(s), s).toBe(true)
    expect(frames).toBeGreaterThan(200)
  })
})
