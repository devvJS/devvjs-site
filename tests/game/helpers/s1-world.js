// S1 world-test helpers. This file never imports src/game/world: tests pass
// { createWorld, stepWorld } to makeKit, so the helpers load even while the
// module under test is missing.
import { STEP_MS } from '../../../src/game/constants.js'

export const TILE_PX = 16
export const tx = (col) => col * TILE_PX

// Builds level rows: width x height of '.', the bottom `floorRows` rows '#'
// (the floor's top edge is at y = (height - floorRows) * 16), then each item
// [col, row, string] writes its string into the grid from that cell.
export function draw(width, height, items = [], { floorRows = 2 } = {}) {
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, () => (y >= height - floorRows ? '#' : '.')),
  )
  for (const [col, row, str] of items) {
    for (let i = 0; i < str.length; i++) grid[row][col + i] = str[i]
  }
  return grid.map((r) => r.join(''))
}

export function levelDef(rows, over = {}) {
  return {
    id: 't1',
    name: 'Test Level',
    theme: 'editor',
    rows,
    power: 'echo',
    tokenKinds: ['{ }', '=>', ';'],
    tokensRequired: 2,
    ...over,
  }
}

// frameInput builders ({ held: Set, pressed: Set }).
export const frame = (held = [], pressed = []) => ({ held: new Set(held), pressed: new Set(pressed) })
export const idle = () => frame()
export const hold = (...actions) => frame(actions, [])
export const tap = (...actions) => frame(actions, actions) // pressed this frame and held

// Event filters.
export const ofType = (events, type) => events.filter((e) => e.type === type)
export const nonSfx = (events) => events.filter((e) => e.type !== 'sfx')
export const sfxNames = (events) => ofType(events, 'sfx').map((e) => e.name)

// Entity queries. An entity counts as alive if it is still in world.entities
// and its alive flag is not false.
export const byKind = (world, kind) => world.entities.filter((e) => e.kind === kind)
export const alive = (world, kind) => byKind(world, kind).filter((e) => e.alive !== false)
export const isAlive = (world, id) => world.entities.some((e) => e.id === id && e.alive !== false)
export const bossOf = (world) => world.entities.find((e) => e.kind === 'boss')

// Teleports the player (keeps the world otherwise untouched).
export function place(world, x, y) {
  const p = world.player
  p.x = x
  p.y = y
  p.vx = 0
  p.vy = 0
}

// Centers the player on an entity's box.
export function onto(world, entity) {
  place(world, entity.x + entity.w / 2 - world.player.w / 2, entity.y + entity.h / 2 - world.player.h / 2)
}

// The world without its rng object, for deep-equal comparisons.
export const strip = (world) => ({ ...world, rng: undefined })

export function makeKit({ createWorld, stepWorld }) {
  const make = (rows, over = {}, opts = {}) => createWorld(levelDef(rows, over), { seed: 1, ...opts })
  const step = (world, input = idle()) => stepWorld(world, input, STEP_MS)
  // Runs n steps; input may be a frame or a function (stepIndex) => frame.
  // Returns every event, flattened.
  const run = (world, n, input = idle()) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(...step(world, typeof input === 'function' ? input(i) : input))
    return out
  }
  // Same, but returns one events array per step.
  const runEach = (world, n, input = idle()) => {
    const out = []
    for (let i = 0; i < n; i++) out.push(step(world, typeof input === 'function' ? input(i) : input))
    return out
  }
  const settle = (world, n = 30) => {
    run(world, n)
    return world
  }
  // Moves the player in front of `target` (to its left, feet level with the
  // target's feet), faces right, clears the echo cooldown, taps echo, then
  // steps until no echo projectile is alive (at most maxFrames). Returns the
  // events. `safe` keeps the player invincible so nothing interferes.
  const fireAt = (world, target, { dist = 40, safe = false, maxFrames = 90 } = {}) => {
    const p = world.player
    p.cooldowns.echo = 0
    place(world, target.x - dist, target.y + target.h - p.h)
    p.facing = 1
    if (safe) p.sudoMs = 1e9
    const events = [...step(world, tap('echo'))]
    for (let i = 0; i < maxFrames && alive(world, 'projectile').length > 0; i++) {
      if (safe) p.sudoMs = 1e9
      events.push(...step(world, idle()))
    }
    return events
  }
  return { make, step, run, runEach, settle, fireAt }
}
