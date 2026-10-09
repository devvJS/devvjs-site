// Fake game states and worlds that follow the spec's world shape and game.state shape.
// S3 never imports S1 or S2 modules, so these are built by hand.
import { vi } from 'vitest'

// Dynamic import that doesn't fail at transform time when the module is missing, so each
// test fails on its own. `rel` is relative to src/.
export const loadSrc = (rel) => import(/* @vite-ignore */ `../../../src/${rel}`)

export const TILE_IDS = { EMPTY: 0, SOLID: 1, ONEWAY: 2, SPIKES: 3, CONVEYOR_R: 4, CONVEYOR_L: 5 }

// 60 x 14 tiles = 960 x 224 px, taller than the 180 px view so the renderer has to cull.
// Rows 9 to 13 are SOLID: the floor top is at y = 144.
export function makeMap(width = 60, height = 14) {
  const tiles = new Uint8Array(width * height)
  for (let ty = 9; ty < height; ty++) for (let tx = 0; tx < width; tx++) tiles[ty * width + tx] = 1
  return { width, height, tiles, spawns: [] }
}
export function setTile(map, tx, ty, id) {
  map.tiles[ty * map.width + tx] = id
}

export function makePlayer(over = {}) {
  return {
    x: 40, y: 130, w: 12, h: 14, vx: 0, vy: 0, onGround: true, facing: 1,
    coffee: 3, invulnMs: 0, frozenMs: 0, sudoMs: 0, dead: false,
    cooldowns: { echo: 0, sudo: 0, rmrf: 0 },
    powers: { echo: false, sudo: false, rmrf: false },
    anim: 'idle',
    ...over,
  }
}

export const KIND_SIZE = {
  bug: [14, 12], mergeConflict: [20, 20], flakyTest: [16, 16], meetingInvite: [14, 12],
  crusher: [16, 32], alert: [8, 12], alertDropper: [16, 8], token: [10, 10], checkpoint: [12, 24],
  exit: [16, 32], projectile: [8, 6], bossProjectile: [10, 10], boss: [32, 40],
}
export const ENTITY_KINDS = Object.keys(KIND_SIZE)

let nextId = 1
export function makeEntity(kind, over = {}) {
  const [w, h] = KIND_SIZE[kind]
  const extra = {
    token: { label: '=>' },
    flakyTest: { solid: true },
    exit: { locked: false },
    checkpoint: { active: false },
    mergeConflict: { size: 2 },
    boss: { hp: 30, maxHp: 30, phase: 1 },
  }[kind]
  return { id: nextId++, kind, x: 100, y: 60, w, h, vx: 0, vy: 0, alive: true, ...extra, ...over }
}

export function makeWorld(over = {}) {
  return {
    levelId: 'editor', theme: 'editor', map: makeMap(), time: 1234,
    rng: { next: () => 0.5, int: () => 0 },
    player: makePlayer(),
    entities: [],
    tokens: { collected: 1, required: 3 },
    checkpoint: { x: 20, y: 130 },
    reversedMs: 0, shake: 0, camera: { x: 0, y: 0 },
    ...over,
  }
}

export function makeState(screen, over = {}) {
  const needsWorld = screen === 'playing' || screen === 'paused' || screen === 'level-complete'
  return {
    screen, levelIndex: 0, score: 0, timeMs: 0, deaths: 0,
    powers: { echo: false, sudo: false, rmrf: false },
    muted: true, best: null,
    world: needsWorld ? makeWorld() : null,
    ...over,
  }
}

// Frozen deeply (except typed arrays), so a renderer that writes to the state throws.
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !ArrayBuffer.isView(o) && !Object.isFrozen(o)) {
    Object.freeze(o)
    for (const k of Object.keys(o)) deepFreeze(o[k])
  }
  return o
}

// A scripted game for GameView: `state` is mutable by the test, `queue(events)` makes the
// next update() return those events, `calls` records each update's frame input.
export function makeScriptedGame(state = makeState('title')) {
  const script = []
  const calls = []
  return {
    state,
    calls,
    queue: (events) => script.push(events),
    update: vi.fn((frameInput, dt) => {
      calls.push({ held: new Set(frameInput.held), pressed: new Set(frameInput.pressed), dt })
      return script.length ? script.shift() : []
    }),
  }
}
