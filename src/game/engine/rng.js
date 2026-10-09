// A small seeded PRNG (mulberry32). The simulation draws all randomness from
// here so a run is reproducible from its seed.
export function createRng(seed = 1) {
  let state = seed >>> 0

  function next() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // An integer in [0, n).
  function int(n) {
    if (!Number.isInteger(n) || n < 1) throw new RangeError(`int(n) needs a positive integer, got ${n}`)
    return Math.floor(next() * n)
  }

  return { next, int }
}
