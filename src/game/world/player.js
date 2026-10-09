// The player: input to motion (run, coyote jump, jump buffer, variable jump),
// damage, death and respawn, and the animation state render reads.
import { MAX_COFFEE, RUN_SPEED, JUMP_VELOCITY, COYOTE_MS, JUMP_BUFFER_MS } from '../constants.js'
import { stepWithBelt, touchesSpikes, outOfMap, center } from './body.js'
import { shakeWorld } from './effects.js'
import {
  PLAYER_W, PLAYER_H, INVULN_MS, RESPAWN_MS, GROUND_ACCEL, GROUND_FRICTION, AIR_ACCEL, JUMP_CUT,
  HURT_ANIM_MS, KNOCK_MS, KNOCK_VX, KNOCK_VY, SPIKE_HOP_VY, SQUASH_MS, SQUASH_MIN_VY,
  SHAKE_HURT, TIME_EPS,
} from './tuning.js'

export function makePlayer(spawn, powers) {
  return {
    // Feet on the bottom of the P cell, centered in it.
    x: spawn.x + 2,
    y: spawn.y + 16 - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    coffee: MAX_COFFEE,
    invulnMs: 0,
    frozenMs: 0,
    sudoMs: 0,
    dead: false,
    cooldowns: { echo: 0, sudo: 0, rmrf: 0 },
    powers: { echo: !!powers.echo, sudo: !!powers.sudo, rmrf: !!powers.rmrf },
    anim: 'idle',
    // Internal timers (ms left).
    coyoteMs: 0,
    jumpBufferMs: 0,
    jumping: false, // rising from a jump that can still be cut short
    knockMs: 0,
    hurtMs: 0,
    squashMs: 0, // > 0 just after a hard landing (render squashes the sprite)
    respawnMs: 0,
  }
}

const down = (ms, dt) => Math.max(0, ms - dt)

// Counts the player's timers down at the start of a step.
export function tickPlayerTimers(p, dt) {
  p.invulnMs = down(p.invulnMs, dt)
  p.frozenMs = down(p.frozenMs, dt)
  p.sudoMs = down(p.sudoMs, dt)
  p.jumpBufferMs = down(p.jumpBufferMs, dt)
  p.knockMs = down(p.knockMs, dt)
  p.hurtMs = down(p.hurtMs, dt)
  p.squashMs = down(p.squashMs, dt)
  p.respawnMs = down(p.respawnMs, dt)
  for (const k of Object.keys(p.cooldowns)) p.cooldowns[k] = down(p.cooldowns[k], dt)
}

// The horizontal direction held this frame (-1, 0 or 1), with left and right
// swapped while the boss has changed the requirements.
function inputDir(world, held) {
  let dir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0)
  if (world.reversedMs > 0) dir = -dir
  return dir
}

function approach(v, target, maxDelta) {
  if (v < target) return Math.min(target, v + maxDelta)
  return Math.max(target, v - maxDelta)
}

// Reads input into the player's velocity and handles the jump. Returns the
// events it causes (the jump sfx). The caller skips this while frozen or dead.
export function controlPlayer(world, input, dt, out) {
  const p = world.player
  const s = dt / 1000
  const dir = inputDir(world, input.held)

  if (p.knockMs <= 0) {
    if (dir !== 0) p.facing = dir
    const accel = dir !== 0 ? (p.onGround ? GROUND_ACCEL : AIR_ACCEL) : p.onGround ? GROUND_FRICTION : AIR_ACCEL / 2
    p.vx = approach(p.vx, dir * RUN_SPEED, accel * s)
  }

  if (input.pressed.has('jump')) p.jumpBufferMs = JUMP_BUFFER_MS
  if (p.jumpBufferMs > 0 && p.coyoteMs > 0) {
    p.vy = -JUMP_VELOCITY
    p.onGround = false
    p.jumping = true
    p.coyoteMs = 0
    p.jumpBufferMs = 0
    out.push({ type: 'sfx', name: 'jump' })
  } else if (p.jumping && !input.held.has('jump') && p.vy < 0) {
    p.vy *= JUMP_CUT
    p.jumping = false
  }
}

// Gravity, motion against the map and the conveyor push. A frozen player
// still falls and rides belts but has no own horizontal speed.
export function movePlayer(world, dt) {
  const p = world.player
  if (p.frozenMs > 0) p.vx = 0
  const fallSpeed = p.vy
  const wasGround = p.onGround
  stepWithBelt(p, world.map, dt)
  if (p.onGround) {
    p.coyoteMs = COYOTE_MS
    p.jumping = false
    if (!wasGround && fallSpeed >= SQUASH_MIN_VY) p.squashMs = SQUASH_MS
  } else {
    p.coyoteMs = Math.max(0, p.coyoteMs - dt)
    if (p.vy >= 0) p.jumping = false
  }
}

// One point of damage from `source` (an entity, or null for spikes). Does
// nothing while invulnerable, under sudo or dead. Returns true if it landed.
export function hurtPlayer(world, source, out) {
  const p = world.player
  if (p.dead || p.invulnMs > 0 || p.sudoMs > 0) return false
  p.coffee = Math.max(0, p.coffee - 1)
  out.push({ type: 'hurt', coffee: p.coffee }, { type: 'sfx', name: 'hurt' })
  p.hurtMs = HURT_ANIM_MS
  shakeWorld(world, SHAKE_HURT)
  if (p.coffee === 0) {
    killPlayer(world, out)
    return true
  }
  p.invulnMs = INVULN_MS
  p.jumping = false
  if (source) {
    // Knocked away from what hit you, with a small hop.
    const away = Math.sign(center(p).x - center(source).x) || -p.facing
    p.vx = away * KNOCK_VX
    p.vy = -KNOCK_VY
    p.knockMs = KNOCK_MS
  } else {
    // Spikes bounce you straight up, so you can steer out.
    p.vy = -SPIKE_HOP_VY
  }
  p.onGround = false
  return true
}

export function killPlayer(world, out) {
  const p = world.player
  p.dead = true
  p.coffee = 0
  p.vx = 0
  p.vy = 0
  p.frozenMs = 0
  p.knockMs = 0
  p.jumping = false
  p.jumpBufferMs = 0
  p.respawnMs = RESPAWN_MS
  out.push({ type: 'died' })
}

// Brings a dead player back at the checkpoint once the respawn delay is over.
// Returns true on the step it happens.
export function maybeRespawn(world, out) {
  const p = world.player
  if (!p.dead || p.respawnMs > TIME_EPS) return false
  Object.assign(p, {
    x: world.checkpoint.x,
    y: world.checkpoint.y,
    vx: 0,
    vy: 0,
    onGround: false,
    dead: false,
    coffee: MAX_COFFEE,
    invulnMs: INVULN_MS, // a moment of grace to get your bearings
    frozenMs: 0,
    knockMs: 0,
    hurtMs: 0,
    respawnMs: 0,
    coyoteMs: 0,
  })
  out.push({ type: 'respawn' })
  return true
}

// Spikes and falling out of the map. Falling out kills even through sudo.
export function checkTerrain(world, out) {
  const p = world.player
  if (p.dead) return
  if (outOfMap(world.map, p)) {
    killPlayer(world, out)
    return
  }
  if (touchesSpikes(world.map, p)) hurtPlayer(world, null, out)
}

export function updateAnim(p) {
  if (p.dead || p.hurtMs > 0) p.anim = 'hurt'
  else if (p.frozenMs > 0) p.anim = 'frozen'
  else if (!p.onGround) p.anim = p.vy < 0 ? 'jump' : 'fall'
  else if (Math.abs(p.vx) > 1) p.anim = 'run'
  else p.anim = 'idle'
}
