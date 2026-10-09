// The Product Manager. He stands his ground and throws on a fixed beat
// (BOSS_THROW_MS); each phase adds notes to the volley thrown on that beat, so
// the rhythm stays learnable while the pressure rises:
//   phase 1  ticket
//   phase 2  ticket, then a quick ask
//   phase 3  quick ask, ticket, quick ask, and every BOSS_REVERSE_INTERVAL_MS
//            he "changes the requirements" (left and right swap); the first
//            change comes right as phase 3 begins.
// Bug tickets bounce along the floor and hatch a bug (a minion) where they
// hit a wall; quick asks fly flat at chest height, so you jump them.
// Only echo hurts him, and not while he is on a call: the phone rings
// (`callWarn`) before each scheduled call, and two hits between calls make
// him take one at once ("sorry, I have to take this").
import { TILE } from '../constants.js'
import { stepBody } from '../engine/physics.js'
import { stepHorizontal, overlapsSolid, outOfMap, center } from './body.js'
import { addEntity, makeBug, nextId } from './entities.js'
import { shakeWorld } from './effects.js'
import {
  BOSS_THROW_MS, BOSS_REVERSE_MS, BOSS_REVERSE_INTERVAL_MS, BOSS_REVERSE_WARN_MS, BOSS_PATTERNS,
  BOSS_WINDUP_MS, BOSS_THROW_ANIM_MS, BOSS_HIT_ANIM_MS, BOSS_MINION_CAP, TICKET_SPEED,
  TICKET_TOSS_VY, TICKET_BOUNCE_VY, TICKET_AIM_JITTER, ASK_SPEED, SHAKE_BOSS_HIT, TIME_EPS,
  BOSS_CALL_MS, BOSS_CALL_INTERVAL_MS, BOSS_CALL_WARN_MS, BOSS_HITS_PER_WINDOW,
  BOSS_PHASE3_REVERSE_DELAY_MS,
} from './tuning.js'

const TICKET_LIFE_MS = 10000
const ASK_LIFE_MS = 5000

export function phaseFor(hp) {
  if (hp > 8) return 1
  if (hp > 4) return 2
  return 3
}

function towardPlayer(world, boss) {
  return center(world.player).x < center(boss).x ? -1 : 1
}

function throwProjectile(world, boss, variant) {
  const dir = towardPlayer(world, boss)
  const cx = center(boss).x
  const base = { id: nextId(world), kind: 'bossProjectile', variant, alive: true, onGround: false }
  if (variant === 'ticket') {
    const jitter = (world.rng.next() * 2 - 1) * TICKET_AIM_JITTER
    addEntity(world, {
      ...base, x: cx - 5, y: boss.y + 6, w: 10, h: 10,
      vx: dir * (TICKET_SPEED[boss.phase] + jitter), vy: -TICKET_TOSS_VY,
      lifeMs: TICKET_LIFE_MS,
    })
  } else {
    addEntity(world, {
      ...base, x: cx - 6 + dir * (boss.w / 2), y: boss.y + boss.h - 13, w: 12, h: 8,
      vx: dir * ASK_SPEED, vy: 0, lifeMs: ASK_LIFE_MS,
    })
  }
  boss.anim = 'throw'
  boss.animMs = BOSS_THROW_ANIM_MS
  return { type: 'sfx', name: 'shoot' }
}

function minionCount(world) {
  return world.entities.filter((e) => e.kind === 'bug' && e.minion && e.alive).length
}

// A ticket that hits a wall (on side `wallSide`, -1 or 1) hatches a bug
// there, up to the phase's cap. The bug starts flush with the ticket's
// wall-side edge, so it is never inside the wall, and walks back out.
function hatch(world, ticket, wallSide) {
  const boss = world.entities.find((e) => e.kind === 'boss')
  if (!boss || boss.defeated) return
  if (minionCount(world) >= BOSS_MINION_CAP[boss.phase]) return
  const bug = makeBug(world, 0, ticket.y + ticket.h - 10, -wallSide, { minion: true })
  bug.x = wallSide < 0 ? ticket.x : ticket.x + ticket.w - bug.w
  // For odd geometry: step away from the wall until clear, or don't hatch.
  for (let i = 0; i < TILE && overlapsSolid(world.map, bug); i++) bug.x -= wallSide
  if (overlapsSolid(world.map, bug)) return
  addEntity(world, bug)
}

// Moves a boss projectile; marks it dead when it is done.
export function updateBossProjectile(world, e, dt) {
  e.lifeMs -= dt
  if (e.variant === 'ticket') {
    const vx = e.vx
    stepBody(e, world.map, dt)
    if (vx !== 0 && e.vx === 0) {
      e.alive = false
      hatch(world, e, Math.sign(vx))
      return
    }
    if (e.onGround) {
      e.vy = -TICKET_BOUNCE_VY
      e.onGround = false
    }
  } else if (stepHorizontal(e, world.map, dt)) {
    e.alive = false
    return
  }
  if (e.lifeMs <= 0 || outOfMap(world.map, e)) e.alive = false
}

// The call schedule. The first call comes at BOSS_CALL_START_MS (set at
// spawn), then one every BOSS_CALL_INTERVAL_MS (start to start), each
// BOSS_CALL_MS long. `callMs` is the time left on a call.
function startCall(boss) {
  boss.onCall = true
  boss.callWarn = false
  boss.callMs = BOSS_CALL_MS
  boss.nextCallMs = BOSS_CALL_INTERVAL_MS
  boss.windowHits = 0
}

function updateCall(boss, dt) {
  if (boss.onCall) {
    boss.callMs = Math.max(0, boss.callMs - dt)
    if (boss.callMs <= TIME_EPS) {
      boss.onCall = false
      boss.callMs = 0
    }
  }
  boss.nextCallMs -= dt
  if (boss.nextCallMs <= TIME_EPS) startCall(boss)
  boss.callWarn = !boss.onCall && boss.nextCallMs <= BOSS_CALL_WARN_MS
}

export function updateBoss(world, boss, dt, out) {
  boss.animMs = Math.max(0, boss.animMs - dt)
  if (boss.defeated) {
    boss.anim = 'defeated'
    return
  }
  boss.facing = towardPlayer(world, boss)
  updateCall(boss, dt)

  // The beat, and the volley it starts.
  let started = false
  boss.throwMs += dt
  if (boss.throwMs >= BOSS_THROW_MS - TIME_EPS) {
    boss.throwMs -= BOSS_THROW_MS
    boss.volley = { ms: 0, next: 0, phase: boss.phase }
    started = true
  }
  if (boss.volley) {
    if (!started) boss.volley.ms += dt
    const pattern = BOSS_PATTERNS[boss.volley.phase]
    while (boss.volley.next < pattern.length && boss.volley.ms >= pattern[boss.volley.next][0] - TIME_EPS) {
      out.push(throwProjectile(world, boss, pattern[boss.volley.next][1]))
      boss.volley.next += 1
    }
    if (boss.volley.next >= pattern.length) boss.volley = null
  }

  // Phase 3: change the requirements on a slower beat of its own.
  if (boss.phase === 3) {
    boss.reverseTimerMs += dt
    if (boss.reverseTimerMs >= BOSS_REVERSE_INTERVAL_MS - TIME_EPS) {
      boss.reverseTimerMs -= BOSS_REVERSE_INTERVAL_MS
      world.reversedMs = BOSS_REVERSE_MS
    }
    boss.warnReverse = boss.reverseTimerMs >= BOSS_REVERSE_INTERVAL_MS - BOSS_REVERSE_WARN_MS
  } else {
    boss.warnReverse = false
  }

  if (boss.animMs <= 0) {
    if (boss.throwMs >= BOSS_THROW_MS - BOSS_WINDUP_MS) boss.anim = 'windup'
    else boss.anim = boss.onCall ? 'call' : 'idle'
  }
}

function defeat(world, boss, out) {
  boss.defeated = true
  boss.anim = 'defeated'
  boss.volley = null
  boss.warnReverse = false
  boss.onCall = false
  boss.callWarn = false
  boss.callMs = 0
  world.reversedMs = 0
  // Shipped: his projectiles and minions go with him.
  for (const e of world.entities) {
    if (e.kind === 'bossProjectile' || (e.kind === 'bug' && e.minion)) e.alive = false
  }
  out.push({ type: 'boss-defeated' }, { type: 'sfx', name: 'win' })
}

// One echo hit. Blocked while he is on a call; otherwise 1 hp, a phase change
// at the hp thirds, and defeat at 0. Entering phase 3 changes the requirements
// almost at once (BOSS_PHASE3_REVERSE_DELAY_MS), then on the usual interval.
export function hitBoss(world, boss, out) {
  if (boss.defeated) return
  if (boss.onCall) {
    out.push({ type: 'blocked' })
    return
  }
  boss.hp = Math.max(0, boss.hp - 1)
  boss.anim = 'hit'
  boss.animMs = BOSS_HIT_ANIM_MS
  shakeWorld(world, SHAKE_BOSS_HIT)
  out.push({ type: 'boss-hit', hp: boss.hp }, { type: 'sfx', name: 'boss-hit' })
  const phase = phaseFor(boss.hp)
  if (boss.hp > 0 && phase > boss.phase) {
    boss.phase = phase
    out.push({ type: 'boss-phase', phase })
    if (phase === 3) {
      boss.reverseTimerMs = BOSS_REVERSE_INTERVAL_MS - BOSS_PHASE3_REVERSE_DELAY_MS
      boss.warnReverse = true
    }
  }
  if (boss.hp === 0) {
    defeat(world, boss, out)
    return
  }
  boss.windowHits += 1
  if (boss.windowHits >= BOSS_HITS_PER_WINDOW) startCall(boss)
}
