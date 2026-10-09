// Revision 2: direct tests for the boss's call rules (review S1, round 2:
// mutants N04, N05, N06, N09). They pass against the current code.
import { describe, it, expect } from 'vitest'
import {
  createWorld, stepWorld, ECHO_RANGE, ECHO_SPEED, BOSS_MAX_HP,
} from '../../../src/game/world/index.js'
import { LEVELS } from '../../../src/game/levels/index.js'
import { STEP_MS } from '../../../src/game/constants.js'
import { makeKit, tap, ofType, alive, bossOf, place } from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })
const BOSS_LEVEL = LEVELS.find((l) => l.id === 'boss')
const bossWorld = () => createWorld(BOSS_LEVEL, { seed: 1, powers: { echo: true, sudo: true, rmrf: true } })

const safeStep = (w, input) => {
  w.player.sudoMs = 1e9
  return kit.step(w, input)
}

// Steps (player invincible) until cond() holds; fails after maxMs.
function until(w, cond, maxMs = 30000) {
  const limit = w.time + maxMs
  while (!cond()) {
    if (w.time > limit) throw new Error('condition never became true')
    safeStep(w)
  }
}

// One echo shot at the boss from point-blank-ish range. Returns whether it hit,
// whether it was blocked, and boss.onCall right after the step that decided it.
function shoot(w) {
  const boss = bossOf(w)
  const p = w.player
  p.cooldowns.echo = 0
  place(w, boss.x - 40, boss.y + boss.h - p.h)
  p.facing = 1
  let result = { hit: false, blocked: false, onCallAfter: boss.onCall }
  let ev = safeStep(w, tap('echo'))
  for (let i = 0; i < 60; i++) {
    if (ofType(ev, 'boss-hit').length) result = { hit: true, blocked: false, onCallAfter: boss.onCall }
    if (ofType(ev, 'blocked').length) result = { hit: false, blocked: true, onCallAfter: boss.onCall }
    if (result.hit || result.blocked || !alive(w, 'projectile').length) break
    ev = safeStep(w)
  }
  return result
}

const startOfFirstOffWindow = (w) => {
  const boss = bossOf(w)
  until(w, () => boss.onCall === true)
  until(w, () => boss.onCall === false)
}

describe('two hits between calls force a call', () => {
  it('the second hit starts a call on its own step; the first leaves him off the phone', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    startOfFirstOffWindow(w)
    const first = shoot(w)
    expect(first).toEqual({ hit: true, blocked: false, onCallAfter: false })
    expect(boss.hp).toBe(BOSS_MAX_HP - 1)
    for (let i = 0; i < 20; i++) {
      safeStep(w)
      expect(boss.onCall).toBe(false)
    }
    const second = shoot(w)
    expect(second).toEqual({ hit: true, blocked: false, onCallAfter: true })
    expect(boss.hp).toBe(BOSS_MAX_HP - 2)
    // The forced call really blocks the next shot.
    expect(shoot(w)).toMatchObject({ hit: false, blocked: true })
    expect(boss.hp).toBe(BOSS_MAX_HP - 2)
  })

  it('shots blocked during a call do not count toward the next window', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    until(w, () => boss.onCall === true)
    for (let i = 0; i < 3; i++) {
      expect(shoot(w)).toMatchObject({ blocked: true })
      expect(boss.onCall).toBe(true)
    }
    until(w, () => boss.onCall === false)
    expect(shoot(w)).toEqual({ hit: true, blocked: false, onCallAfter: false })
    expect(boss.hp).toBe(BOSS_MAX_HP - 1)
  })

  it('a scheduled call resets the window: one hit before it and one after it make no forced call', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    startOfFirstOffWindow(w)
    expect(shoot(w)).toEqual({ hit: true, blocked: false, onCallAfter: false })
    until(w, () => boss.onCall === true) // the next scheduled call
    until(w, () => boss.onCall === false)
    expect(shoot(w)).toEqual({ hit: true, blocked: false, onCallAfter: false })
    expect(boss.hp).toBe(BOSS_MAX_HP - 2)
  })
})

describe('callWarn: the phone rings before a scheduled call', () => {
  it('is true for at least a full shot flight before each call, and false during it', () => {
    const w = bossWorld()
    const boss = bossOf(w)
    const flightMs = (ECHO_RANGE / ECHO_SPEED) * 1000
    expect(flightMs).toBeGreaterThan(400)
    let warnSteps = 0
    let prevCall = false
    let calls = 0
    let quiet = 0
    for (let i = 0; i < Math.round(25000 / STEP_MS); i++) {
      safeStep(w)
      expect(typeof boss.callWarn).toBe('boolean')
      if (boss.onCall) {
        expect(boss.callWarn).toBe(false)
        if (!prevCall) {
          calls += 1
          expect(warnSteps * STEP_MS).toBeGreaterThanOrEqual(Math.max(500, flightMs))
        }
        warnSteps = 0
      } else if (boss.callWarn) {
        warnSteps += 1
      } else {
        warnSteps = 0
        quiet += 1
      }
      prevCall = boss.onCall
    }
    expect(calls).toBeGreaterThanOrEqual(3)
    expect(quiet).toBeGreaterThan(60) // it is not on all the time
  })
})
