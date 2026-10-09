// What happens when the player touches an entity: damage, freezes, tokens,
// checkpoints and the exit.
import { overlaps } from '../engine/physics.js'
import { hurtPlayer } from './player.js'
import { FREEZE_MS, TOKEN_SCORE, PLAYER_W, PLAYER_H } from './tuning.js'

// Touching these costs a cup (subject to invulnerability and sudo).
const HARMFUL = new Set(['bug', 'mergeConflict', 'crusher'])
// These also break on the hit that lands.
const MISSILES = new Set(['alert', 'bossProjectile'])

export function unlockPower(world, power, out) {
  world.player.powers[power] = true
  for (const e of world.entities) if (e.kind === 'exit') e.locked = false
  out.push({ type: 'power-unlocked', power }, { type: 'sfx', name: 'unlock' })
}

function collectToken(world, token, out) {
  token.alive = false
  world.tokens.collected += 1
  out.push({ type: 'collect', label: token.label, score: TOKEN_SCORE }, { type: 'sfx', name: 'collect' })
  const power = world.power
  if (power && !world.player.powers[power] && world.tokens.collected >= world.tokens.required) {
    unlockPower(world, power, out)
  }
}

// A meeting invite is consumed on contact. It freezes you unless you are
// under sudo (declined) or already stuck in a meeting.
function acceptInvite(world, invite, out) {
  const p = world.player
  invite.alive = false
  if (p.sudoMs > 0 || p.frozenMs > 0) return
  p.frozenMs = FREEZE_MS
  p.vx = 0
  p.jumping = false
  p.jumpBufferMs = 0
  out.push({ type: 'frozen' }, { type: 'sfx', name: 'freeze' })
}

function activateCheckpoint(world, cp, out) {
  if (cp.active) return
  cp.active = true
  // The respawn spot: centered on the post, feet on its base.
  world.checkpoint = { x: cp.x + cp.w / 2 - PLAYER_W / 2, y: cp.y + cp.h - PLAYER_H }
  out.push({ type: 'checkpoint' }, { type: 'sfx', name: 'checkpoint' })
}

// One event per touch: it re-arms once the player has stepped off it.
function touchExit(exit, touching, out) {
  const fresh = touching && !exit.touching
  exit.touching = touching
  if (!fresh) return
  if (exit.locked) out.push({ type: 'exit-locked' })
  else out.push({ type: 'level-complete' }, { type: 'sfx', name: 'win' })
}

export function playerContacts(world, out) {
  const p = world.player
  for (const e of world.entities) {
    if (p.dead) return
    if (!e.alive) continue
    if (e.kind === 'exit') {
      touchExit(e, overlaps(p, e), out)
      continue
    }
    if (!overlaps(p, e)) continue
    if (HARMFUL.has(e.kind) || (e.kind === 'flakyTest' && e.solid) || (e.kind === 'boss' && !e.defeated)) {
      hurtPlayer(world, e, out)
    } else if (MISSILES.has(e.kind)) {
      if (hurtPlayer(world, e, out)) e.alive = false
    } else if (e.kind === 'meetingInvite') {
      acceptInvite(world, e, out)
    } else if (e.kind === 'token') {
      collectToken(world, e, out)
    } else if (e.kind === 'checkpoint') {
      activateCheckpoint(world, e, out)
    }
  }
}
