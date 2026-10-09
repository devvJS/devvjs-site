import { describe, it, expect } from 'vitest'
import * as C from '../../../src/game/constants.js'

describe('game constants', () => {
  it('has the frozen values', () => {
    expect(C.TILE).toBe(16)
    expect(C.VIEW_W).toBe(320)
    expect(C.VIEW_H).toBe(180)
    expect(C.STEP_MS).toBeCloseTo(1000 / 60, 10)
    expect(C.GRAVITY).toBe(1800)
    expect(C.JUMP_VELOCITY).toBe(450)
    expect(C.RUN_SPEED).toBe(130)
    expect(C.MAX_FALL).toBe(420)
    expect(C.COYOTE_MS).toBe(80)
    expect(C.JUMP_BUFFER_MS).toBe(100)
    expect(C.MAX_JUMP_TILES_UP).toBe(3)
    expect(C.MAX_GAP_TILES).toBe(3)
    expect(C.MAX_COFFEE).toBe(3)
    expect(C.ACTIONS).toEqual(['left', 'right', 'jump', 'echo', 'sudo', 'rmrf', 'pause', 'mute', 'start'])
  })
})
