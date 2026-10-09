import { describe, it, expect } from 'vitest'
import { createRng } from '../../../src/game/engine/rng.js'

describe('createRng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const sa = Array.from({ length: 25 }, () => a.next())
    const sb = Array.from({ length: 25 }, () => b.next())
    expect(sa).toEqual(sb)
  })

  it('different seeds give different sequences', () => {
    const a = createRng(1)
    const b = createRng(2)
    const sa = Array.from({ length: 10 }, () => a.next())
    const sb = Array.from({ length: 10 }, () => b.next())
    expect(sa).not.toEqual(sb)
  })

  it('is not a constant', () => {
    const r = createRng(7)
    const vals = new Set(Array.from({ length: 50 }, () => r.next()))
    expect(vals.size).toBeGreaterThan(40)
  })

  it('next() stays in [0,1)', () => {
    const r = createRng(99)
    for (let i = 0; i < 2000; i++) {
      const v = r.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('int(n) gives integers in [0,n) and reaches every value', () => {
    const r = createRng(5)
    const seen = new Set()
    for (let i = 0; i < 2000; i++) {
      const v = r.int(6)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(6)
      seen.add(v)
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('int(1) is always 0', () => {
    const r = createRng(3)
    for (let i = 0; i < 50; i++) expect(r.int(1)).toBe(0)
  })

  it('mixing next() and int() is deterministic per seed', () => {
    const run = () => {
      const r = createRng(11)
      return [r.next(), r.int(100), r.int(100), r.next(), r.int(7)]
    }
    expect(run()).toEqual(run())
  })
})
