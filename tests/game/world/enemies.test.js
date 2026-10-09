import { describe, it, expect } from 'vitest'
import {
  createWorld, stepWorld, BUG_SPEED, FLAKY_MS, ALERT_INTERVAL_MS, CRUSHER_CYCLE_MS, FREEZE_MS,
  KILL_SCORE,
} from '../../../src/game/world/index.js'
import { STEP_MS, TILE, MAX_COFFEE } from '../../../src/game/constants.js'
import {
  makeKit, draw, hold, ofType, nonSfx, sfxNames, alive, byKind, isAlive, onto,
} from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })
const POWERS_ECHO = { powers: { echo: true } }

describe('bug', () => {
  it('turns at a ledge and never walks off the platform', () => {
    // Player on a separate floor piece; the bug owns the platform in columns 8-13.
    const rows = draw(30, 12, [[0, 10, '###'], [8, 10, '######'], [1, 9, 'P'], [10, 9, 'b']], { floorRows: 0 })
    const w = kit.make(rows)
    kit.settle(w, 5)
    const bug = alive(w, 'bug')[0]
    const y0 = bug.y
    const dirs = new Set()
    let atSpeed = 0
    const frames = 1200 // 20 s
    for (let i = 0; i < frames; i++) {
      kit.step(w)
      expect(bug.alive).not.toBe(false)
      expect(bug.y).toBeCloseTo(y0, 0)
      const cx = bug.x + bug.w / 2
      expect(cx).toBeGreaterThanOrEqual(8 * TILE)
      expect(cx).toBeLessThanOrEqual(14 * TILE)
      if (bug.vx !== 0) dirs.add(Math.sign(bug.vx))
      if (Math.abs(Math.abs(bug.vx) - BUG_SPEED) < 0.5) atSpeed++
    }
    expect(dirs).toEqual(new Set([-1, 1]))
    expect(atSpeed).toBeGreaterThan(frames * 0.9)
  })

  it('turns at a wall and stays between the walls', () => {
    const rows = draw(30, 12, [
      [1, 9, 'P'], [14, 9, 'b'], [12, 8, '#'], [12, 9, '#'], [17, 8, '#'], [17, 9, '#'],
    ])
    const w = kit.make(rows)
    kit.settle(w, 5)
    const bug = alive(w, 'bug')[0]
    const dirs = new Set()
    for (let i = 0; i < 600; i++) {
      kit.step(w)
      expect(bug.x).toBeGreaterThanOrEqual(13 * TILE - 0.5)
      expect(bug.x + bug.w).toBeLessThanOrEqual(17 * TILE + 0.5)
      if (bug.vx !== 0) dirs.add(Math.sign(bug.vx))
    }
    expect(dirs).toEqual(new Set([-1, 1]))
  })
})

describe('echo against enemies', () => {
  it('kills a bug: kill event with the bug score, sfx kill, bug gone, projectile consumed', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [8, 9, 'b']]), {}, POWERS_ECHO)
    kit.settle(w, 5)
    const bug = alive(w, 'bug')[0]
    const ev = kit.fireAt(w, bug)
    expect(ofType(ev, 'kill')).toEqual([{ type: 'kill', kind: 'bug', score: KILL_SCORE.bug }])
    expect(sfxNames(ev)).toContain('kill')
    expect(isAlive(w, bug.id)).toBe(false)
    expect(alive(w, 'projectile')).toHaveLength(0)
  })

  it('splits a size-2 mergeConflict into two size-1 entities, then a size-1 dies with a kill event', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [10, 9, 'm']]), {}, POWERS_ECHO)
    kit.settle(w, 5)
    const parent = alive(w, 'mergeConflict')[0]
    const parentSize = { w: parent.w, h: parent.h }
    const parentX = parent.x
    expect(parent.size).toBe(2)

    kit.fireAt(w, parent)
    expect(isAlive(w, parent.id)).toBe(false)
    const kids = alive(w, 'mergeConflict')
    expect(kids).toHaveLength(2)
    expect(kids.map((k) => k.size)).toEqual([1, 1])
    expect(new Set(kids.map((k) => k.id)).size).toBe(2)
    expect(kids.map((k) => k.id)).not.toContain(parent.id)
    for (const k of kids) {
      expect(k.w).toBeLessThan(parentSize.w)
      expect(k.h).toBeLessThan(parentSize.h)
      expect(Math.abs(k.x - parentX)).toBeLessThanOrEqual(40)
    }

    const all = []
    const target = alive(w, 'mergeConflict').sort((a, b) => a.x - b.x)[0]
    all.push(...kit.fireAt(w, target))
    expect(ofType(all, 'kill')).toEqual([{ type: 'kill', kind: 'mergeConflict', score: KILL_SCORE.mergeConflict }])
    expect(alive(w, 'mergeConflict')).toHaveLength(1)
    expect(alive(w, 'mergeConflict')[0].size).toBe(1)

    all.push(...kit.fireAt(w, alive(w, 'mergeConflict')[0]))
    expect(ofType(all, 'kill')).toHaveLength(2)
    expect(alive(w, 'mergeConflict')).toHaveLength(0)
  })

  it('kills a flakyTest while it is solid', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [8, 9, 'f']]), {}, POWERS_ECHO)
    const flaky = byKind(w, 'flakyTest')[0]
    expect(flaky.solid).toBe(true)
    const ev = kit.fireAt(w, flaky)
    expect(ofType(ev, 'kill')).toEqual([{ type: 'kill', kind: 'flakyTest', score: KILL_SCORE.flakyTest }])
    expect(isAlive(w, flaky.id)).toBe(false)
  })
})

describe('flakyTest', () => {
  it('starts solid and toggles every FLAKY_MS', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [15, 9, 'f']]))
    const flaky = byKind(w, 'flakyTest')[0]
    expect(flaky.solid).toBe(true)
    const changes = []
    let prev = flaky.solid
    const frames = Math.ceil((3.3 * FLAKY_MS) / STEP_MS)
    for (let i = 0; i < frames; i++) {
      kit.step(w)
      if (flaky.solid !== prev) changes.push({ at: (i + 1) * STEP_MS, solid: flaky.solid })
      prev = flaky.solid
    }
    expect(changes.map((c) => c.solid)).toEqual([false, true, false])
    changes.forEach((c, k) => expect(Math.abs(c.at - (k + 1) * FLAKY_MS)).toBeLessThanOrEqual(2 * STEP_MS))
  })

  it('stays where it was spawned', () => {
    const w = kit.make(draw(30, 12, [[2, 9, 'P'], [15, 9, 'f']]))
    const flaky = byKind(w, 'flakyTest')[0]
    const x0 = flaky.x
    kit.run(w, 200)
    expect(flaky.x).toBe(x0)
  })
})

describe('meetingInvite', () => {
  const rows = draw(40, 12, [[2, 9, 'P'], [20, 5, 'i']])
  const dist = (a, b) => Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2))

  it('flies toward the player', () => {
    const w = kit.make(rows)
    const invite = byKind(w, 'meetingInvite')[0]
    const d0 = dist(invite, w.player)
    kit.run(w, 60)
    const d1 = dist(invite, w.player)
    expect(d1).toBeLessThan(d0 - 20)
    kit.run(w, 60)
    expect(dist(invite, w.player)).toBeLessThan(d1 - 20)
    expect(invite.alive).not.toBe(false)
  })

  it('freezes the player on contact: frozen event, sfx freeze, no coffee lost, invite consumed', () => {
    const w = kit.make(rows)
    kit.settle(w, 5)
    const invite = byKind(w, 'meetingInvite')[0]
    onto(w, invite)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'frozen' }])
    expect(sfxNames(ev)).toContain('freeze')
    expect(w.player.coffee).toBe(MAX_COFFEE)
    expect(w.player.frozenMs).toBeGreaterThan(FREEZE_MS - 2 * STEP_MS)
    expect(w.player.frozenMs).toBeLessThanOrEqual(FREEZE_MS)
    expect(isAlive(w, invite.id)).toBe(false)
    expect(kit.run(w, 10)).toEqual([])
  })

  it('lets go after FREEZE_MS', () => {
    const w = kit.make(rows)
    onto(w, byKind(w, 'meetingInvite')[0])
    kit.step(w)
    kit.run(w, Math.ceil(FREEZE_MS / STEP_MS) + 3, hold('right'))
    expect(w.player.frozenMs).toBe(0)
    const x0 = w.player.x
    kit.run(w, 15, hold('right'))
    expect(w.player.x).toBeGreaterThan(x0 + 10)
  })
})

describe('crusher', () => {
  const rows = draw(30, 12, [[2, 9, 'P'], [15, 5, 'x']])
  const pose = (c) => ({ y: c.y, bottom: c.y + c.h })

  it('cycles with period CRUSHER_CYCLE_MS and stays in its column', () => {
    const w = kit.make(rows)
    const c = byKind(w, 'crusher')[0]
    const p0 = pose(c)
    const x0 = c.x
    const n = Math.round(CRUSHER_CYCLE_MS / STEP_MS)
    let maxDiff = 0
    for (let i = 1; i <= n; i++) {
      kit.step(w)
      maxDiff = Math.max(maxDiff, Math.abs(c.y - p0.y), Math.abs(c.y + c.h - p0.bottom))
      expect(c.x).toBe(x0)
      expect(c.w).toBeGreaterThan(0)
      expect(c.h).toBeGreaterThan(0)
      if (i === Math.round(n / 2)) expect(Math.abs(c.y + c.h - p0.bottom) + Math.abs(c.y - p0.y)).toBeGreaterThan(8)
    }
    expect(maxDiff).toBeGreaterThan(8)
    expect(Math.abs(c.y - p0.y)).toBeLessThanOrEqual(3)
    expect(Math.abs(c.y + c.h - p0.bottom)).toBeLessThanOrEqual(3)
  })

  it('hurts on contact wherever it is in its cycle', () => {
    const w = kit.make(rows)
    const c = byKind(w, 'crusher')[0]
    const hurts = []
    for (let i = 0; i < 50; i++) {
      onto(w, c)
      hurts.push(...ofType(kit.step(w), 'hurt'))
    }
    expect(hurts).toEqual([{ type: 'hurt', coffee: 2 }])
  })
})

describe('alertDropper', () => {
  const rows = draw(30, 12, [[15, 1, 'a'], [2, 9, 'P']])

  // Steps for `ms`, calling onStep(step index) after each; returns the alerts
  // seen (by id) with the step they first appeared.
  function watch(w, ms, onStep = () => {}) {
    const first = new Map()
    const frames = Math.round(ms / STEP_MS)
    for (let i = 0; i < frames; i++) {
      kit.step(w)
      for (const a of alive(w, 'alert')) if (!first.has(a.id)) first.set(a.id, i)
      onStep(i)
    }
    return first
  }

  it('drops an alert every ALERT_INTERVAL_MS, the first one after one interval', () => {
    const w = kit.make(rows)
    const first = watch(w, 5 * ALERT_INTERVAL_MS + 100)
    const times = [...first.values()].map((i) => (i + 1) * STEP_MS)
    expect(times.length).toBeGreaterThanOrEqual(4)
    expect(times.length).toBeLessThanOrEqual(5)
    times.forEach((t, k) => expect(Math.abs(t - (k + 1) * ALERT_INTERVAL_MS)).toBeLessThanOrEqual(3 * STEP_MS))
  })

  it('makes an alert at the dropper that falls and is removed when it hits the ground', () => {
    const w = kit.make(rows)
    const dropper = byKind(w, 'alertDropper')[0]
    const dx = dropper.x
    let tracked = null
    const ys = []
    let removedAfter = -1
    const frames = Math.round((ALERT_INTERVAL_MS + 2000) / STEP_MS)
    for (let i = 0; i < frames; i++) {
      kit.step(w)
      if (!tracked) {
        tracked = alive(w, 'alert')[0] ?? null
        if (tracked) {
          expect(Math.abs(tracked.x - dropper.x)).toBeLessThanOrEqual(TILE)
          expect(tracked.y).toBeLessThan(5 * TILE)
        }
      }
      if (tracked) {
        if (isAlive(w, tracked.id)) ys.push(tracked.y + tracked.h)
        else if (removedAfter < 0) removedAfter = ys.length
      }
    }
    expect(dropper.x).toBe(dx)
    expect(ys.length).toBeGreaterThan(5)
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1])
    expect(ys[ys.length - 1]).toBeGreaterThan(8 * TILE) // fell most of the way down
    expect(Math.max(...ys)).toBeLessThanOrEqual(10 * TILE + 1) // never into the floor (top edge y = 160)
    expect(removedAfter).toBeGreaterThan(0)
    expect(ys.length).toBeLessThan(120) // gone within 2 s of appearing
  })

  it('hurts the player on contact', () => {
    const w = kit.make(rows)
    for (let i = 0; i < 200 && !alive(w, 'alert').length; i++) kit.step(w)
    const alert = alive(w, 'alert')[0]
    onto(w, alert)
    const ev = kit.step(w)
    expect(nonSfx(ev)).toEqual([{ type: 'hurt', coffee: 2 }])
  })
})
