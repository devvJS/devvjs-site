// createWorld and stepWorld: the deterministic simulation of one level.
// Time only comes from dt and randomness only from world.rng.
import { parseLevel } from '../engine/tilemap.js'
import { createRng } from '../engine/rng.js'
import { spawnEntity } from './entities.js'
import {
  makePlayer, tickPlayerTimers, controlPlayer, movePlayer, maybeRespawn, checkTerrain, updateAnim,
} from './player.js'
import { updateEnemy } from './enemies.js'
import { applyPowers, updateShot } from './powers.js'
import { updateBoss, updateBossProjectile } from './boss.js'
import { playerContacts } from './contacts.js'
import { snapCamera, followCamera } from './camera.js'
import { decayShake } from './effects.js'

const POWER_NAMES = ['echo', 'sudo', 'rmrf']

export function createWorld(levelDef, { seed = 1, powers = {} } = {}) {
  const map = parseLevel(levelDef.rows)
  const playerSpawn = map.spawns.find((s) => s.kind === 'player')
  const carried = {}
  for (const name of POWER_NAMES) carried[name] = !!powers?.[name]
  const power = levelDef.power ?? null
  const required = levelDef.tokensRequired ?? 0
  // A level that asks for no tokens hands its power over at the start, so its
  // exit can never be locked for good.
  if (power && required <= 0) carried[power] = true

  const player = makePlayer(playerSpawn, carried)
  const world = {
    levelId: levelDef.id,
    theme: levelDef.theme,
    power,
    map,
    time: 0,
    rng: createRng(seed),
    player,
    entities: [],
    tokens: { collected: 0, required },
    checkpoint: { x: player.x, y: player.y },
    reversedMs: 0,
    shake: 0,
    camera: { x: 0, y: 0 },
    nextId: 0,
  }

  const kinds = levelDef.tokenKinds ?? []
  let tokenIndex = 0
  const ctx = { playerX: playerSpawn.x, exitLocked: !(power && carried[power]), label: null }
  for (const spawn of map.spawns) {
    if (spawn.kind === 'player') continue
    if (spawn.kind === 'token') {
      ctx.label = kinds.length ? kinds[tokenIndex % kinds.length] : null
      tokenIndex++
    }
    world.entities.push(spawnEntity(world, spawn, ctx))
  }
  snapCamera(world)
  return world
}

const NO_KEYS = new Set()

function updateEntities(world, dt, out) {
  // Entities spawned during this pass (alerts, split halves, boss throws) start
  // moving next step.
  const n = world.entities.length
  for (let i = 0; i < n; i++) {
    const e = world.entities[i]
    if (!e.alive) continue
    if (e.kind === 'projectile') updateShot(world, e, dt, out)
    else if (e.kind === 'bossProjectile') updateBossProjectile(world, e, dt)
    else if (e.kind === 'boss') updateBoss(world, e, dt, out)
    else updateEnemy(world, e, dt)
  }
}

// Drops dead entities, keeping the array (and every live entity object) in place.
function sweep(world) {
  const list = world.entities
  let j = 0
  for (let i = 0; i < list.length; i++) if (list[i].alive) list[j++] = list[i]
  list.length = j
}

export function stepWorld(world, frameInput, dt) {
  const out = []
  const input = { held: frameInput?.held ?? NO_KEYS, pressed: frameInput?.pressed ?? NO_KEYS }
  const p = world.player

  world.time += dt
  tickPlayerTimers(p, dt)
  world.reversedMs = Math.max(0, world.reversedMs - dt)
  decayShake(world, dt)

  const respawned = maybeRespawn(world, out)
  const active = !p.dead && !respawned
  if (active) {
    if (p.frozenMs <= 0) {
      controlPlayer(world, input, dt, out)
      applyPowers(world, input, out)
    }
    movePlayer(world, dt)
  }

  updateEntities(world, dt, out)

  if (active) {
    checkTerrain(world, out)
    playerContacts(world, out)
  }

  sweep(world)
  followCamera(world, dt)
  updateAnim(p)
  return out
}
