import { describe, it, expect } from 'vitest'
import {
  createWorld, stepWorld, TOKEN_SCORE, ECHO_SPEED, ECHO_COOLDOWN_MS, SUDO_MS, SUDO_COOLDOWN_MS,
  RMRF_COOLDOWN_MS, KILL_SCORE,
} from '../../../src/game/world/index.js'
import { STEP_MS, TILE } from '../../../src/game/constants.js'
import {
  makeKit, draw, hold, tap, ofType, nonSfx, sfxNames, alive, byKind, isAlive, place, onto,
} from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })
const FLAT = draw(30, 12, [[10, 9, 'P']])

describe('tokens', () => {
  const rows = draw(30, 12, [[2, 9, 'P'], [6, 9, 't'], [8, 9, 't'], [10, 9, 't'], [12, 9, 'E']])
  const tokensOf = (w) => byKind(w, 'token').sort((a, b) => a.x - b.x)

  it('collecting a token emits collect with its label and score, counts it, and removes it', () => {
    const w = kit.make(rows)
    const [t1] = tokensOf(w)
    onto(w, t1)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'collect', label: '{ }', score: TOKEN_SCORE }])
    expect(sfxNames(ev)).toContain('collect')
    expect(w.tokens).toEqual({ collected: 1, required: 2 })
    expect(isAlive(w, t1.id)).toBe(false)
    expect(w.player.powers.echo).toBe(false)
    expect(kit.run(w, 5)).toEqual([]) // nothing more from the same token
  })

  it('collects by walking into a token', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [5, 9, 't']]))
    const ev = kit.run(w, 40, hold('right'))
    expect(ofType(ev, 'collect')).toEqual([{ type: 'collect', label: '{ }', score: TOKEN_SCORE }])
    expect(w.tokens.collected).toBe(1)
  })

  it('reaching tokensRequired unlocks the level power and the exit, once', () => {
    const w = kit.make(rows)
    const [t1, t2, t3] = tokensOf(w)
    const exit = byKind(w, 'exit')[0]
    onto(w, t1)
    kit.step(w)
    expect(exit.locked).toBe(true)
    onto(w, t2)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([
      { type: 'collect', label: '=>', score: TOKEN_SCORE },
      { type: 'power-unlocked', power: 'echo' },
    ])
    expect(sfxNames(ev)).toEqual(expect.arrayContaining(['collect', 'unlock']))
    expect(w.player.powers).toEqual({ echo: true, sudo: false, rmrf: false })
    expect(exit.locked).toBe(false)
    onto(w, t3)
    const more = kit.step(w)
    expect(nonSfx(more)).toEqual([{ type: 'collect', label: ';', score: TOKEN_SCORE }])
    expect(w.tokens.collected).toBe(3)
  })

  it('does not mutate the powers object it was given when unlocking', () => {
    const given = { echo: false, sudo: false, rmrf: false }
    const w = kit.make(rows, {}, { powers: given })
    const [t1, t2] = tokensOf(w)
    onto(w, t1)
    kit.step(w)
    onto(w, t2)
    kit.step(w)
    expect(w.player.powers.echo).toBe(true)
    expect(given).toEqual({ echo: false, sudo: false, rmrf: false })
  })
})

describe('exit', () => {
  const rows = draw(30, 12, [[2, 9, 'P'], [10, 9, 'E']])

  it('says exit-locked once per touch while locked, and again on a new touch', () => {
    const w = kit.make(rows)
    const exit = byKind(w, 'exit')[0]
    onto(w, exit)
    expect(nonSfx(kit.step(w))).toEqual([{ type: 'exit-locked' }])
    const staying = []
    for (let i = 0; i < 10; i++) {
      onto(w, exit)
      staying.push(...kit.step(w))
    }
    expect(nonSfx(staying)).toEqual([])
    place(w, 2 * TILE, 9 * TILE + 2)
    expect(kit.run(w, 3)).toEqual([])
    onto(w, exit)
    expect(nonSfx(kit.step(w))).toEqual([{ type: 'exit-locked' }])
  })

  it('emits level-complete (not exit-locked) when the power is already unlocked', () => {
    const w = kit.make(rows, {}, { powers: { echo: true } })
    onto(w, byKind(w, 'exit')[0])
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'level-complete' }])
    expect(sfxNames(ev)).toContain('win')
  })

  it('does not complete the level before the power is unlocked, but does after collecting the tokens', () => {
    const level = draw(30, 12, [[2, 9, 'P'], [6, 9, 't'], [8, 9, 't'], [10, 9, 'E']])
    const w = kit.make(level)
    const [t1, t2] = byKind(w, 'token').sort((a, b) => a.x - b.x)
    onto(w, t1)
    kit.step(w)
    onto(w, t2)
    kit.step(w)
    onto(w, byKind(w, 'exit')[0])
    expect(nonSfx(kit.step(w))).toEqual([{ type: 'level-complete' }])
  })
})

describe('power gating', () => {
  it('does nothing for powers that are not unlocked', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [6, 9, 'b']]))
    kit.settle(w, 5)
    const bug = alive(w, 'bug')[0]
    const ev = kit.step(w, { held: new Set(['echo', 'sudo', 'rmrf']), pressed: new Set(['echo', 'sudo', 'rmrf']) })
    expect(ev).toEqual([])
    expect(alive(w, 'projectile')).toHaveLength(0)
    expect(w.player.sudoMs).toBe(0)
    expect(w.player.cooldowns).toEqual({ echo: 0, sudo: 0, rmrf: 0 })
    expect(isAlive(w, bug.id)).toBe(true)
  })
})

describe('echo', () => {
  const POW = { powers: { echo: true } }

  it('fires a projectile in the facing direction: power-used, sfx shoot, cooldown set', () => {
    const w = kit.make(FLAT, {}, POW)
    kit.settle(w)
    const ev = kit.step(w, tap('echo'))
    expect(nonSfx(ev)).toEqual([{ type: 'power-used', power: 'echo' }])
    expect(sfxNames(ev)).toEqual(['shoot'])
    const shots = alive(w, 'projectile')
    expect(shots).toHaveLength(1)
    expect(shots[0].vx).toBe(ECHO_SPEED)
    expect(shots[0].vy).toBe(0)
    expect(shots[0].x).toBeGreaterThanOrEqual(w.player.x)
    expect(shots[0].y).toBeGreaterThanOrEqual(w.player.y - 8)
    expect(shots[0].y).toBeLessThanOrEqual(w.player.y + w.player.h)
    expect(w.player.cooldowns.echo).toBeGreaterThan(ECHO_COOLDOWN_MS - 2 * STEP_MS)
    expect(w.player.cooldowns.echo).toBeLessThanOrEqual(ECHO_COOLDOWN_MS)
    const x0 = shots[0].x
    kit.run(w, 6)
    expect(shots[0].x - x0).toBeCloseTo((ECHO_SPEED * 6 * STEP_MS) / 1000, -1)
  })

  it('fires to the left when facing left', () => {
    const w = kit.make(FLAT, {}, POW)
    kit.settle(w)
    kit.run(w, 2, hold('left'))
    expect(w.player.facing).toBe(-1)
    kit.step(w, tap('echo'))
    const shot = alive(w, 'projectile')[0]
    expect(shot.vx).toBe(-ECHO_SPEED)
    expect(shot.x + shot.w).toBeLessThanOrEqual(w.player.x + w.player.w)
  })

  it('does nothing while on cooldown, and works again once the cooldown has run out', () => {
    const w = kit.make(FLAT, {}, POW)
    kit.settle(w)
    kit.step(w, tap('echo'))
    const during = kit.step(w, tap('echo'))
    expect(during).toEqual([])
    expect(alive(w, 'projectile')).toHaveLength(1)
    expect(w.player.cooldowns.echo).toBeGreaterThanOrEqual(ECHO_COOLDOWN_MS - 3 * STEP_MS - 0.01)
    expect(w.player.cooldowns.echo).toBeLessThanOrEqual(ECHO_COOLDOWN_MS - STEP_MS + 0.01)
    kit.run(w, Math.ceil(ECHO_COOLDOWN_MS / STEP_MS) + 2)
    expect(w.player.cooldowns.echo).toBe(0)
    const again = kit.step(w, tap('echo'))
    expect(nonSfx(again)).toEqual([{ type: 'power-used', power: 'echo' }])
  })

  it('is removed by a wall and does not reach what is behind it', () => {
    const rows = draw(30, 12, [[2, 9, 'P'], [8, 8, '#'], [8, 9, '#'], [10, 9, 'b']])
    const w = kit.make(rows, {}, POW)
    kit.settle(w, 5)
    const bug = alive(w, 'bug')[0]
    const events = [...kit.step(w, tap('echo'))]
    const shot = alive(w, 'projectile')[0]
    expect(shot).toBeDefined()
    let maxRight = shot.x + shot.w
    for (let i = 0; i < 60; i++) {
      events.push(...kit.step(w))
      if (isAlive(w, shot.id)) maxRight = Math.max(maxRight, shot.x + shot.w)
    }
    expect(maxRight).toBeLessThanOrEqual(8 * TILE + 6)
    expect(isAlive(w, shot.id)).toBe(false)
    expect(alive(w, 'projectile')).toHaveLength(0)
    expect(ofType(events, 'kill')).toEqual([])
    expect(isAlive(w, bug.id)).toBe(true)
  })

  it('is removed at the edge of the map when nothing is in the way', () => {
    const w = kit.make(FLAT, {}, POW)
    kit.settle(w)
    kit.step(w, tap('echo'))
    kit.run(w, 150) // 2.5 s: the map is 480 px wide
    expect(alive(w, 'projectile')).toHaveLength(0)
  })
})

describe('sudo', () => {
  const POW = { powers: { sudo: true } }

  it('grants about SUDO_MS of invincibility and starts the cooldown', () => {
    const w = kit.make(FLAT, { power: 'sudo' }, POW)
    kit.settle(w)
    const ev = kit.step(w, tap('sudo'))
    expect(nonSfx(ev)).toEqual([{ type: 'power-used', power: 'sudo' }])
    expect(sfxNames(ev)).toEqual(['power'])
    expect(w.player.sudoMs).toBeGreaterThan(SUDO_MS - 2 * STEP_MS)
    expect(w.player.sudoMs).toBeLessThanOrEqual(SUDO_MS)
    expect(w.player.cooldowns.sudo).toBeGreaterThan(SUDO_COOLDOWN_MS - 2 * STEP_MS)
    expect(w.player.cooldowns.sudo).toBeLessThanOrEqual(SUDO_COOLDOWN_MS)
    kit.run(w, 60)
    expect(w.player.sudoMs).toBeGreaterThanOrEqual(SUDO_MS - 62 * STEP_MS - 0.01)
    expect(w.player.sudoMs).toBeLessThanOrEqual(SUDO_MS - 60 * STEP_MS + 0.01)
    expect(w.player.cooldowns.sudo).toBeGreaterThanOrEqual(SUDO_COOLDOWN_MS - 62 * STEP_MS - 0.01)
    expect(w.player.cooldowns.sudo).toBeLessThanOrEqual(SUDO_COOLDOWN_MS - 60 * STEP_MS + 0.01)
  })

  it('protects against spikes until it expires, then damage resumes', () => {
    const w = kit.make(draw(30, 12, [[3, 9, 'P'], [10, 9, '^']]), { power: 'sudo' }, POW)
    place(w, 10 * TILE + 2, 9 * TILE + 2)
    kit.step(w, tap('sudo'))
    let hurtAt = -1
    const frames = Math.ceil(SUDO_MS / STEP_MS) + 30
    for (let i = 1; i < frames && hurtAt < 0; i++) {
      if (ofType(kit.step(w), 'hurt').length) hurtAt = i * STEP_MS
    }
    expect(hurtAt).toBeGreaterThanOrEqual(SUDO_MS - 3 * STEP_MS)
    expect(hurtAt).toBeLessThanOrEqual(SUDO_MS + 3 * STEP_MS)
    expect(w.player.coffee).toBe(2)
    expect(w.player.sudoMs).toBe(0)
  })

  it('does nothing while on cooldown (it is not refreshed), and works again after it', () => {
    const w = kit.make(FLAT, { power: 'sudo' }, POW)
    kit.settle(w)
    kit.step(w, tap('sudo'))
    kit.run(w, 30)
    const before = w.player.sudoMs
    expect(kit.step(w, tap('sudo'))).toEqual([])
    expect(w.player.sudoMs).toBeLessThan(before)
    kit.run(w, Math.ceil(SUDO_COOLDOWN_MS / STEP_MS) + 5)
    expect(w.player.cooldowns.sudo).toBe(0)
    expect(w.player.sudoMs).toBe(0)
    const again = kit.step(w, tap('sudo'))
    expect(nonSfx(again)).toEqual([{ type: 'power-used', power: 'sudo' }])
  })
})

describe('rm -rf', () => {
  const LEVEL = draw(60, 12, [
    [2, 9, 'P'], [4, 9, 't'], [6, 9, 'b'], [9, 5, 'm'], [12, 9, 'f'], [15, 4, 'i'],
    [40, 9, 'b'], [8, 9, 'C'], [14, 9, 'E'],
  ])
  const POW = { powers: { rmrf: true } }
  const make = () => kit.make(LEVEL, { power: 'rmrf', tokensRequired: 9 }, POW)

  it('kills every non-boss enemy in the camera view, and nothing outside it or non-enemy', () => {
    const w = make()
    const far = alive(w, 'bug').sort((a, b) => b.x - a.x)[0]
    expect(far.x).toBeGreaterThan(w.camera.x + 320) // really outside the view
    const enemies = ['bug', 'mergeConflict', 'flakyTest', 'meetingInvite'].flatMap((k) => alive(w, k))
    const inView = enemies.filter((e) => e.id !== far.id)
    expect(inView).toHaveLength(4)
    const ev = kit.step(w, tap('rmrf'))
    expect(ofType(ev, 'power-used')).toEqual([{ type: 'power-used', power: 'rmrf' }])
    expect(sfxNames(ev)).toContain('power')
    const kills = ofType(ev, 'kill').sort((a, b) => a.kind.localeCompare(b.kind))
    expect(kills).toEqual(
      ['bug', 'flakyTest', 'meetingInvite', 'mergeConflict'].map((kind) => ({ type: 'kill', kind, score: KILL_SCORE[kind] })),
    )
    for (const e of inView) expect(isAlive(w, e.id)).toBe(false)
    expect(isAlive(w, far.id)).toBe(true)
    expect(alive(w, 'mergeConflict')).toHaveLength(0) // no split
    expect(alive(w, 'token')).toHaveLength(1)
    expect(alive(w, 'checkpoint')).toHaveLength(1)
    expect(alive(w, 'exit')).toHaveLength(1)
    expect(w.player.cooldowns.rmrf).toBeGreaterThan(RMRF_COOLDOWN_MS - 2 * STEP_MS)
    expect(w.player.cooldowns.rmrf).toBeLessThanOrEqual(RMRF_COOLDOWN_MS)
  })

  it('does nothing on cooldown, and works again after RMRF_COOLDOWN_MS', () => {
    const w = make()
    const far = alive(w, 'bug').sort((a, b) => b.x - a.x)[0]
    kit.step(w, tap('rmrf'))
    const usedAt = w.time
    const safeRun = (n) => {
      for (let i = 0; i < n; i++) {
        w.player.sudoMs = 1e9
        kit.step(w)
      }
    }
    place(w, far.x - 80, 9 * TILE + 2)
    safeRun(120) // the camera catches up; the far bug is now in view
    expect(w.camera.x + 320).toBeGreaterThan(far.x + far.w)
    expect(w.camera.x).toBeLessThan(far.x)
    expect(kit.step(w, tap('rmrf'))).toEqual([])
    expect(isAlive(w, far.id)).toBe(true)

    for (let i = 0; i < 3000 && w.player.cooldowns.rmrf > 0; i++) safeRun(1)
    expect(w.player.cooldowns.rmrf).toBe(0)
    expect(Math.abs(w.time - usedAt - RMRF_COOLDOWN_MS)).toBeLessThanOrEqual(4 * STEP_MS)
    place(w, far.x - 60, 9 * TILE + 2)
    safeRun(90)
    const ev = kit.step(w, tap('rmrf'))
    expect(ofType(ev, 'power-used')).toEqual([{ type: 'power-used', power: 'rmrf' }])
    expect(isAlive(w, far.id)).toBe(false)
  })

  it('is ignored while the power is not unlocked', () => {
    const w = kit.make(LEVEL, { power: 'rmrf', tokensRequired: 9 })
    const bugs = alive(w, 'bug')
    expect(kit.step(w, tap('rmrf')).filter((e) => e.type === 'kill')).toEqual([])
    for (const b of bugs) expect(isAlive(w, b.id)).toBe(true)
    expect(w.player.cooldowns.rmrf).toBe(0)
  })
})
