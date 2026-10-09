// Entity construction. Every entity is a plain object (no closures), so a world
// can be compared, cloned or inspected as data.
import { TILE } from '../constants.js'
import { groundYBelow } from './body.js'
import {
  BUG_SPEED, MERGE_SPEED, BOSS_MAX_HP, BOSS_W, BOSS_H, CRUSHER_DEFAULT_TRAVEL, BOSS_CALL_START_MS,
} from './tuning.js'

// The kinds an echo shot (and rm -rf) can kill, with KILL_SCORE entries.
export const ENEMY_KINDS = new Set(['bug', 'mergeConflict', 'flakyTest', 'meetingInvite'])

export function nextId(world) {
  world.nextId += 1
  return world.nextId
}

function base(world, kind, x, y, w, h) {
  return { id: nextId(world), kind, x, y, w, h, vx: 0, vy: 0, alive: true }
}

// Adds an entity to the world and returns it.
export function addEntity(world, entity) {
  world.entities.push(entity)
  return entity
}

export function makeBug(world, x, y, dir, extra = {}) {
  const e = base(world, 'bug', x, y, 14, 10)
  return Object.assign(e, { onGround: false, dir, vx: dir * BUG_SPEED }, extra)
}

export function makeMergeConflict(world, x, y, size, dir) {
  const s = size === 2 ? 16 : 10
  const e = base(world, 'mergeConflict', x, y, s, s)
  return Object.assign(e, { size, onGround: false, dir, vx: dir * MERGE_SPEED[size] })
}

// Builds the entity for a parsed spawn ({ kind, x, y } at the cell's top-left).
// `ctx` carries the level-wide bits: the token label for this spawn, the
// player start (enemies first walk toward it) and whether the exit is locked.
export function spawnEntity(world, spawn, ctx) {
  const { x, y } = spawn
  const towardPlayer = ctx.playerX < x ? -1 : 1
  switch (spawn.kind) {
    case 'token':
      return Object.assign(base(world, 'token', x + 3, y + 3, 10, 10), { label: ctx.label })
    case 'checkpoint':
      return Object.assign(base(world, 'checkpoint', x + 2, y, 12, 16), { active: false })
    case 'exit':
      return Object.assign(base(world, 'exit', x + 1, y, 14, 16), { locked: ctx.exitLocked, touching: false })
    case 'bug':
      return makeBug(world, x + 1, y + TILE - 10, towardPlayer)
    case 'mergeConflict':
      return makeMergeConflict(world, x, y, 2, towardPlayer)
    case 'flakyTest':
      return Object.assign(base(world, 'flakyTest', x + 1, y + 2, 14, 14), { solid: true, t: 0, warn: false })
    case 'meetingInvite':
      return Object.assign(base(world, 'meetingInvite', x + 1, y + 3, 14, 10), { awake: false })
    case 'crusher': {
      const row = Math.floor(y / TILE)
      const floorY = groundYBelow(world.map, x, TILE, row + 1, TILE)
      const travel = floorY === null ? CRUSHER_DEFAULT_TRAVEL : Math.max(0, floorY - y)
      return Object.assign(base(world, 'crusher', x, y, TILE, TILE), {
        topY: y, travel, t: 0, stage: 'rest',
      })
    }
    case 'alertDropper':
      return Object.assign(base(world, 'alertDropper', x, y, TILE, 6), { t: 0, warn: false })
    case 'boss': {
      const bx = Math.max(0, x + TILE / 2 - BOSS_W / 2)
      const row = Math.floor(y / TILE)
      const by = groundYBelow(world.map, bx, BOSS_W, row + 1, BOSS_H) ?? y
      return Object.assign(base(world, 'boss', bx, by, BOSS_W, BOSS_H), {
        hp: BOSS_MAX_HP, maxHp: BOSS_MAX_HP, phase: 1, defeated: false,
        facing: towardPlayer, anim: 'idle', animMs: 0,
        throwMs: 0, volley: null, reverseTimerMs: 0, warnReverse: false,
        nextCallMs: BOSS_CALL_START_MS, onCall: false, callWarn: false, callMs: 0, windowHits: 0,
      })
    }
    default:
      throw new Error(`createWorld: unknown spawn kind ${JSON.stringify(spawn.kind)}`)
  }
}
