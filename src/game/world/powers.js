// Terminal powers: echo (a text projectile), sudo (invincibility) and rm -rf
// (clears every non-boss enemy on screen), plus the echo projectile itself.
import { VIEW_W, VIEW_H } from '../constants.js'
import { overlaps } from '../engine/physics.js'
import { stepHorizontal, overlapsSolid } from './body.js'
import { addEntity, nextId, ENEMY_KINDS } from './entities.js'
import { killEnemy } from './enemies.js'
import { hitBoss } from './boss.js'
import { shakeWorld } from './effects.js'
import {
  ECHO_SPEED, ECHO_COOLDOWN_MS, ECHO_RANGE, SUDO_MS, SUDO_COOLDOWN_MS, RMRF_COOLDOWN_MS,
  SHAKE_RMRF,
} from './tuning.js'

const SHOT_W = 10
const SHOT_H = 6

function fireEcho(world, out) {
  const p = world.player
  const shot = {
    id: nextId(world), kind: 'projectile',
    x: p.facing > 0 ? p.x + p.w - 2 : p.x + 2 - SHOT_W,
    y: p.y + 4,
    w: SHOT_W, h: SHOT_H,
    vx: p.facing * ECHO_SPEED, vy: 0,
    alive: true, onGround: false, traveled: 0,
  }
  // Fired point-blank into a wall: the shot fizzles but the power is spent.
  if (!overlapsSolid(world.map, shot)) addEntity(world, shot)
  p.cooldowns.echo = ECHO_COOLDOWN_MS
  out.push({ type: 'power-used', power: 'echo' }, { type: 'sfx', name: 'shoot' })
}

function castSudo(world, out) {
  const p = world.player
  p.sudoMs = SUDO_MS
  p.cooldowns.sudo = SUDO_COOLDOWN_MS
  out.push({ type: 'power-used', power: 'sudo' }, { type: 'sfx', name: 'power' })
}

export function cameraRect(world) {
  return { x: world.camera.x, y: world.camera.y, w: VIEW_W, h: VIEW_H }
}

// Deletes every non-boss enemy, boss projectile and falling alert in view.
// Merge conflicts go whole (no split). One kill event per enemy, one kill sound.
function castRmrf(world, out) {
  const p = world.player
  p.cooldowns.rmrf = RMRF_COOLDOWN_MS
  out.push({ type: 'power-used', power: 'rmrf' }, { type: 'sfx', name: 'power' })
  shakeWorld(world, SHAKE_RMRF)
  const view = cameraRect(world)
  let kills = 0
  for (const e of world.entities) {
    if (!e.alive || !overlaps(e, view)) continue
    if (ENEMY_KINDS.has(e.kind)) {
      killEnemy(world, e, out, { split: false, sfx: false })
      kills++
    } else if (e.kind === 'bossProjectile' || e.kind === 'alert') {
      e.alive = false
    }
  }
  if (kills > 0) out.push({ type: 'sfx', name: 'kill' })
}

const POWERS = [
  ['echo', fireEcho],
  ['sudo', castSudo],
  ['rmrf', castRmrf],
]

// Uses each power pressed this frame that is unlocked and off cooldown.
// Anything else does nothing at all (no events).
export function applyPowers(world, input, out) {
  const p = world.player
  for (const [name, cast] of POWERS) {
    if (input.pressed.has(name) && p.powers[name] && p.cooldowns[name] <= 0) cast(world, out)
  }
}

// What an echo shot can hit: live enemies (a flaky test only while solid) and
// the boss until he is beaten.
function shotTarget(world, shot) {
  for (const e of world.entities) {
    if (!e.alive || e === shot) continue
    const hittable =
      (ENEMY_KINDS.has(e.kind) && (e.kind !== 'flakyTest' || e.solid)) ||
      (e.kind === 'boss' && !e.defeated)
    if (hittable && overlaps(shot, e)) return e
  }
  return null
}

// Moves an echo shot; it is consumed by the first thing it hits and removed
// by a wall (the map edges included) or once it has traveled ECHO_RANGE.
export function updateShot(world, shot, dt, out) {
  const x0 = shot.x
  const blocked = stepHorizontal(shot, world.map, dt)
  shot.traveled += Math.abs(shot.x - x0)
  // Out of range: the text fades before it reaches anything further away.
  if (shot.traveled > ECHO_RANGE) {
    shot.alive = false
    return
  }
  const target = shotTarget(world, shot)
  if (target) {
    shot.alive = false
    if (target.kind === 'boss') hitBoss(world, target, out)
    else killEnemy(world, target, out)
    return
  }
  if (blocked) shot.alive = false
}
