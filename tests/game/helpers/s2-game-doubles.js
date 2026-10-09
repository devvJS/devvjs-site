import { vi } from 'vitest'

export const NO_POWERS = { echo: false, sudo: false, rmrf: false }

export function fakeLevels(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    id: `L${i}`,
    name: `Level ${i}`,
    theme: 'editor',
    rows: ['P'],
    power: i === n - 1 ? null : ['echo', 'sudo', 'rmrf'][i],
    tokenKinds: [],
    tokensRequired: 0,
  }))
}

// Storage double over a Map; values are strings, a missing key reads as null.
export function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    get: vi.fn((key) => (map.has(key) ? map.get(key) : null)),
    set: vi.fn((key, value) => {
      map.set(key, value)
    }),
  }
}

export function throwingStorage() {
  return {
    get: vi.fn(() => {
      throw new Error('storage unavailable')
    }),
    set: vi.fn(() => {
      throw new Error('storage unavailable')
    }),
  }
}

// createWorld records a snapshot of the powers it was given; stepWorld returns the
// next scripted event array (or []), recording every call.
export function fakeEngine() {
  const script = []
  const created = []
  const createWorld = vi.fn((levelDef, opts) => {
    const world = { levelId: levelDef.id, powers: JSON.parse(JSON.stringify(opts?.powers ?? null)) }
    created.push(world)
    return world
  })
  const stepWorld = vi.fn(() => script.shift() ?? [])
  return { createWorld, stepWorld, script, created, queue: (...frames) => script.push(...frames) }
}

export function frame(pressed = [], held = pressed) {
  return { pressed: new Set(pressed), held: new Set(held) }
}
