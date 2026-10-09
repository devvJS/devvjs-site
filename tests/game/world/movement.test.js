import { describe, it, expect } from 'vitest'
import { createWorld, stepWorld, CONVEYOR_SPEED, BUG_SPEED } from '../../../src/game/world/index.js'
import {
  STEP_MS, TILE, GRAVITY, COYOTE_MS, JUMP_BUFFER_MS, JUMP_VELOCITY, RUN_SPEED, VIEW_W,
} from '../../../src/game/constants.js'
import { makeKit, draw, hold, tap, frame, idle, sfxNames, nonSfx, alive } from '../helpers/s1-world.js'

const kit = makeKit({ createWorld, stepWorld })
const FLAT = draw(30, 12, [[10, 9, 'P']])

describe('running', () => {
  it('moves right at about RUN_SPEED and faces right', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    const x0 = w.player.x
    kit.run(w, 30, hold('right'))
    const dx = w.player.x - x0
    expect(dx).toBeGreaterThan(0.6 * RUN_SPEED * 0.5)
    expect(dx).toBeLessThanOrEqual(RUN_SPEED * 0.5 + 1)
    expect(w.player.facing).toBe(1)
    expect(w.player.anim).toBe('run')
  })

  it('moves left at about RUN_SPEED and faces left', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    const x0 = w.player.x
    kit.run(w, 30, hold('left'))
    const dx = x0 - w.player.x
    expect(dx).toBeGreaterThan(0.6 * RUN_SPEED * 0.5)
    expect(dx).toBeLessThanOrEqual(RUN_SPEED * 0.5 + 1)
    expect(w.player.facing).toBe(-1)
  })

  it('stays put and idle with no input, and an idle step returns an empty event list', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    const x0 = w.player.x
    const ev = kit.step(w)
    expect(ev).toEqual([])
    expect(w.player.x).toBeCloseTo(x0, 6)
    expect(w.player.onGround).toBe(true)
    expect(w.player.anim).toBe('idle')
  })

  it('is stopped by the map edge', () => {
    const w = kit.make(draw(30, 12, [[1, 9, 'P']]))
    kit.run(w, 120, hold('left'))
    expect(w.player.x).toBeGreaterThanOrEqual(0)
    expect(w.player.x).toBeLessThanOrEqual(TILE)
    expect(w.camera.x).toBe(0)
  })
})

describe('camera follow', () => {
  it('follows the player to the right and stops at the right edge of the map', () => {
    const w = kit.make(draw(60, 12, [[5, 9, 'P']]))
    kit.settle(w)
    expect(w.camera.x).toBe(0)
    kit.run(w, 120, hold('right')) // about 260 px
    expect(w.camera.x).toBeGreaterThan(0)
    expect(w.camera.x).toBeLessThanOrEqual(w.player.x)
    expect(w.camera.x + VIEW_W).toBeGreaterThanOrEqual(w.player.x + w.player.w)
    kit.run(w, 400, hold('right'))
    expect(w.camera.x).toBeCloseTo(60 * TILE - VIEW_W, 5)
    expect(w.player.x + w.player.w).toBeLessThanOrEqual(60 * TILE)
  })
})

describe('jumping', () => {
  it('jumps from the ground: upward speed near JUMP_VELOCITY, sfx jump, airborne, anim jump', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    const ev = kit.step(w, tap('jump'))
    expect(sfxNames(ev)).toEqual(['jump'])
    expect(nonSfx(ev)).toEqual([])
    expect(w.player.vy).toBeLessThan(-JUMP_VELOCITY + 70)
    expect(w.player.vy).toBeGreaterThan(-JUMP_VELOCITY - 10)
    expect(w.player.onGround).toBe(false)
    kit.step(w, hold('jump'))
    expect(w.player.anim).toBe('jump')
  })

  it('shows the fall animation while descending', () => {
    const w = kit.make(draw(30, 12, [[3, 1, 'P']]))
    kit.run(w, 10)
    expect(w.player.vy).toBeGreaterThan(0)
    expect(w.player.onGround).toBe(false)
    expect(w.player.anim).toBe('fall')
  })

  it('does not jump in mid-air once coyote time is long gone', () => {
    const w = kit.make(draw(30, 12, [[3, 1, 'P']]))
    kit.run(w, 10)
    const ev = kit.run(w, 3, (i) => (i === 0 ? tap('jump') : idle()))
    expect(sfxNames(ev)).not.toContain('jump')
    expect(w.player.vy).toBeGreaterThan(0)
  })

  it('releasing jump while rising halves the upward speed (a variable jump)', () => {
    const released = kit.make(FLAT)
    const held = kit.make(FLAT)
    kit.settle(released)
    kit.settle(held)
    for (const w of [released, held]) {
      kit.step(w, tap('jump'))
      kit.step(w, hold('jump'))
    }
    const vy2 = released.player.vy
    expect(vy2).toBeLessThan(-300)
    kit.step(released, idle())
    kit.step(held, hold('jump'))
    const g = GRAVITY * (STEP_MS / 1000)
    expect(held.player.vy).toBeCloseTo(vy2 + g, 0)
    // halved (and one gravity step, applied before or after the halving)
    expect(released.player.vy).toBeGreaterThanOrEqual(vy2 / 2 + g / 2 - 3)
    expect(released.player.vy).toBeLessThanOrEqual(vy2 / 2 + g + 3)
    expect(released.player.vy).toBeLessThan(0)
  })

  describe('coyote time', () => {
    // Floor only under columns 0-5; the player walks off the right end.
    const LEDGE = draw(30, 12, [[3, 9, 'P'], [6, 10, '.'.repeat(24)], [6, 11, '.'.repeat(24)]])
    function walkOff() {
      const w = kit.make(LEDGE)
      kit.settle(w, 10)
      for (let i = 0; i < 200; i++) {
        kit.step(w, hold('right'))
        if (!w.player.onGround) return w
      }
      throw new Error('the player never left the ledge')
    }

    it('still jumps a couple of frames after leaving a ledge', () => {
      expect(COYOTE_MS).toBe(80)
      const w = walkOff()
      kit.run(w, 2)
      const ev = kit.step(w, tap('jump'))
      expect(sfxNames(ev)).toContain('jump')
      expect(w.player.vy).toBeLessThan(-300)
    })

    it('does not jump once more than COYOTE_MS has passed since leaving the ledge', () => {
      const w = walkOff()
      kit.run(w, 7)
      const ev = kit.step(w, tap('jump'))
      expect(sfxNames(ev)).not.toContain('jump')
      expect(w.player.vy).toBeGreaterThan(0)
    })
  })

  describe('jump buffer', () => {
    const HIGH = draw(30, 12, [[3, 1, 'P']])
    function landingIndex() {
      const w = kit.make(HIGH)
      for (let i = 0; i < 200; i++) {
        kit.step(w)
        if (w.player.onGround) return i
      }
      throw new Error('never landed')
    }
    function jumpIndexWhenPressedAt(pressAt, total) {
      const w = kit.make(HIGH)
      for (let i = 0; i < total; i++) {
        const ev = kit.step(w, i === pressAt ? tap('jump') : idle())
        if (sfxNames(ev).includes('jump')) return i
      }
      return -1
    }

    it('fires a jump pressed up to JUMP_BUFFER_MS before landing, on landing', () => {
      expect(JUMP_BUFFER_MS).toBe(100)
      const n = landingIndex()
      expect(n).toBeGreaterThan(15)
      const at = jumpIndexWhenPressedAt(n - 3, n + 20) // 50 ms early
      expect(at).toBeGreaterThanOrEqual(n)
      expect(at).toBeLessThanOrEqual(n + 1)
    })

    it('ignores a jump pressed much earlier than JUMP_BUFFER_MS before landing', () => {
      const n = landingIndex()
      expect(jumpIndexWhenPressedAt(n - 12, n + 20)).toBe(-1) // 200 ms early
    })
  })
})

describe('frozen', () => {
  it('cannot move, jump or use powers while frozen, and the freeze counts down', () => {
    const w = kit.make(draw(30, 12, [[10, 9, 'P']]), {}, { powers: { echo: true, sudo: true, rmrf: true } })
    kit.settle(w)
    const x0 = w.player.x
    w.player.frozenMs = 500
    const all = frame(['right', 'jump', 'echo', 'sudo', 'rmrf'], ['jump', 'echo', 'sudo', 'rmrf'])
    const ev = kit.step(w, all)
    expect(ev).toEqual([])
    expect(w.player.x).toBeCloseTo(x0, 6)
    expect(w.player.frozenMs).toBeCloseTo(500 - STEP_MS, 3)
    expect(w.player.anim).toBe('frozen')
    expect(alive(w, 'projectile')).toHaveLength(0)
    expect(w.player.sudoMs).toBe(0)
    expect(w.player.cooldowns).toEqual({ echo: 0, sudo: 0, rmrf: 0 })
    kit.run(w, 20, all)
    expect(w.player.x).toBeCloseTo(x0, 6)
  })

  it('moves again once the freeze has run out', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    w.player.frozenMs = 100
    const x0 = w.player.x
    kit.run(w, 12, hold('right')) // 200 ms
    expect(w.player.frozenMs).toBe(0)
    expect(w.player.x).toBeGreaterThan(x0 + 5)
  })
})

describe('reversed controls', () => {
  it('swaps left and right while reversedMs > 0, counting it down', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    w.reversedMs = 1000
    const x0 = w.player.x
    kit.run(w, 15, hold('right'))
    expect(w.player.x).toBeLessThan(x0 - 10)
    expect(w.player.facing).toBe(-1)
    expect(w.reversedMs).toBeCloseTo(1000 - 15 * STEP_MS, 3)
    const x1 = w.player.x
    kit.run(w, 15, hold('left'))
    expect(w.player.x).toBeGreaterThan(x1 + 10)
    expect(w.player.facing).toBe(1)
  })

  it('goes back to normal when it runs out', () => {
    const w = kit.make(FLAT)
    kit.settle(w)
    w.reversedMs = 100
    kit.run(w, 10) // 167 ms
    expect(w.reversedMs).toBe(0)
    const x0 = w.player.x
    kit.run(w, 15, hold('right'))
    expect(w.player.x).toBeGreaterThan(x0 + 10)
  })
})

describe('conveyors', () => {
  const onBelt = (ch) => draw(30, 12, [[10, 9, 'P'], [0, 10, ch.repeat(30)]])

  it('pushes a grounded player right at CONVEYOR_SPEED on > tiles', () => {
    const w = kit.make(onBelt('>'))
    kit.settle(w, 10)
    const x0 = w.player.x
    kit.run(w, 60) // one second
    const dx = w.player.x - x0
    expect(dx).toBeGreaterThan(0.8 * CONVEYOR_SPEED)
    expect(dx).toBeLessThan(1.2 * CONVEYOR_SPEED)
  })

  it('pushes a grounded player left on < tiles', () => {
    const w = kit.make(onBelt('<'))
    kit.settle(w, 10)
    const x0 = w.player.x
    kit.run(w, 60)
    const dx = x0 - w.player.x
    expect(dx).toBeGreaterThan(0.8 * CONVEYOR_SPEED)
    expect(dx).toBeLessThan(1.2 * CONVEYOR_SPEED)
  })

  it('does not push a player standing on a plain floor', () => {
    const w = kit.make(FLAT)
    kit.settle(w, 10)
    const x0 = w.player.x
    kit.run(w, 60)
    expect(Math.abs(w.player.x - x0)).toBeLessThan(0.5)
  })

  describe('bugs on conveyors', () => {
    const bugX = (floorCh) => {
      const rows = draw(30, 12, [[1, 9, 'P'], [15, 9, 'b'], [0, 10, floorCh.repeat(30)]])
      const w = kit.make(rows)
      kit.settle(w, 5)
      const x0 = alive(w, 'bug')[0].x
      kit.run(w, 60)
      return alive(w, 'bug')[0].x - x0
    }

    it('are pushed in the belt direction on top of their own patrol', () => {
      const plain = bugX('#')
      expect(Math.abs(plain)).toBeGreaterThan(0.7 * BUG_SPEED * 0.8)
      const right = bugX('>') - plain
      const left = bugX('<') - plain
      expect(right).toBeGreaterThan(0.7 * CONVEYOR_SPEED)
      expect(right).toBeLessThan(1.3 * CONVEYOR_SPEED)
      expect(left).toBeLessThan(-0.7 * CONVEYOR_SPEED)
      expect(left).toBeGreaterThan(-1.3 * CONVEYOR_SPEED)
    })
  })
})
