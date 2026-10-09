// Enemy and hazard behavior: walkers (bugs, merge conflicts), flaky tests,
// meeting invites, crushers and alert droppers, plus killing and splitting.
import { stepBody } from '../engine/physics.js'
import { stepWithBelt, beltPush, blockedAhead, overlapsSolid, outOfMap, center } from './body.js'
import { addEntity, makeMergeConflict, nextId } from './entities.js'
import {
  BUG_SPEED, MERGE_SPEED, MERGE_SPLIT_VX, MERGE_SPLIT_VY, KILL_SCORE, FLAKY_MS, FLAKY_WARN_MS,
  INVITE_SPEED, INVITE_WAKE_RADIUS, ALERT_INTERVAL_MS, ALERT_WARN_MS, ALERT_MAX_FALL,
  CRUSHER_CYCLE_MS, CRUSHER_WARN_AT, CRUSHER_SLAM_AT, CRUSHER_DOWN_AT, CRUSHER_RISE_AT, TIME_EPS,
} from './tuning.js'

// True when a belt is carrying the walker, center first, off its end: the
// tile under the middle of its feet after this step's net move is not a belt.
function leavingBelt(e, map, netDir, step) {
  const probe = { ...e, x: e.x + netDir * step }
  return beltPush(probe, map) === 0
}

// Patrols at `speed`, turning at walls and ledges. Airborne walkers (spawned
// mid-air, or popped out of a split) keep their velocity until they land.
// Conveyors carry them on top of the patrol. A belt faster than the walker's
// legs, running against it, pushes it back toward where it came from: rather
// than tread water at the belt's end, it turns around and rides the belt.
// Only when the belt would carry it off a ledge does it dig in.
function updateWalker(world, e, dt, speed) {
  const map = world.map
  const s = dt / 1000
  if (e.onGround) {
    const push = beltPush(e, map)
    const net = e.dir * speed + push
    if (push !== 0 && Math.sign(net) === -e.dir && leavingBelt(e, map, Math.sign(net), Math.abs(net) * s)) {
      e.dir = -e.dir
    }
    if (blockedAhead(e, map, e.dir, speed * s)) {
      e.dir = -e.dir
      e.vx = blockedAhead(e, map, e.dir, speed * s) ? 0 : e.dir * speed
    } else {
      e.vx = e.dir * speed
    }
    const netDir = Math.sign(e.vx + push)
    if (netDir !== 0 && netDir !== e.dir && blockedAhead(e, map, netDir, Math.abs(e.vx + push) * s)) {
      e.vx = -push
    }
  }
  const moving = e.vx
  stepWithBelt(e, map, dt)
  // Stopped by a wall in its own direction (e.g. it landed against one).
  if (moving !== 0 && e.vx === 0 && Math.sign(moving) === e.dir) e.dir = -e.dir
  if (outOfMap(map, e)) e.alive = false
}

function updateFlaky(e, dt) {
  e.t += dt
  while (e.t >= FLAKY_MS - TIME_EPS) {
    e.t -= FLAKY_MS
    e.solid = !e.solid
  }
  e.warn = !e.solid && e.t >= FLAKY_MS - FLAKY_WARN_MS
}

// Flies straight at the player once woken, through walls: meetings find you.
function updateInvite(world, e, dt) {
  const p = world.player
  const from = center(e)
  const to = center(p)
  const dx = to.x - from.x
  const dy = to.y - from.y
  const d = Math.hypot(dx, dy)
  if (!e.awake && d <= INVITE_WAKE_RADIUS) e.awake = true
  if (!e.awake || p.dead || d === 0) {
    e.vx = 0
    e.vy = 0
    return
  }
  e.vx = (dx / d) * INVITE_SPEED
  e.vy = (dy / d) * INVITE_SPEED
  const stepLen = Math.min(d, INVITE_SPEED * (dt / 1000))
  e.x += (dx / d) * stepLen
  e.y += (dy / d) * stepLen
}

// The crusher's drop as a fraction of its travel, and its stage, at cycle
// position u in [0, 1): rest, a shaking warning, a fast slam, a pause at the
// bottom, then a slow rise.
function crusherPose(u) {
  if (u < CRUSHER_WARN_AT) return { f: 0, stage: 'rest' }
  if (u < CRUSHER_SLAM_AT) return { f: 0, stage: 'warn' }
  if (u < CRUSHER_DOWN_AT) {
    const k = (u - CRUSHER_SLAM_AT) / (CRUSHER_DOWN_AT - CRUSHER_SLAM_AT)
    return { f: k * k, stage: 'slam' }
  }
  if (u < CRUSHER_RISE_AT) return { f: 1, stage: 'down' }
  return { f: 1 - (u - CRUSHER_RISE_AT) / (1 - CRUSHER_RISE_AT), stage: 'rise' }
}

function updateCrusher(e, dt) {
  e.t = (e.t + dt) % CRUSHER_CYCLE_MS
  const { f, stage } = crusherPose(e.t / CRUSHER_CYCLE_MS)
  const y = e.topY + e.travel * f
  e.vy = dt > 0 ? ((y - e.y) * 1000) / dt : 0
  e.y = y
  e.stage = stage
}

function updateDropper(world, e, dt) {
  e.t += dt
  if (e.t >= ALERT_INTERVAL_MS - TIME_EPS) {
    e.t -= ALERT_INTERVAL_MS
    addEntity(world, {
      id: nextId(world), kind: 'alert',
      x: e.x + (e.w - 10) / 2, y: e.y + e.h, w: 10, h: 12,
      vx: 0, vy: 0, alive: true, onGround: false,
    })
  }
  e.warn = e.t >= ALERT_INTERVAL_MS - ALERT_WARN_MS
}

// Falls (a little slower than the player can) and breaks on whatever it lands on.
function updateAlert(world, e, dt) {
  stepBody(e, world.map, dt)
  e.vy = Math.min(e.vy, ALERT_MAX_FALL)
  if (e.onGround || outOfMap(world.map, e)) e.alive = false
}

export function updateEnemy(world, e, dt) {
  switch (e.kind) {
    case 'bug':
      return updateWalker(world, e, dt, BUG_SPEED)
    case 'mergeConflict':
      return updateWalker(world, e, dt, MERGE_SPEED[e.size])
    case 'flakyTest':
      return updateFlaky(e, dt)
    case 'meetingInvite':
      return updateInvite(world, e, dt)
    case 'crusher':
      return updateCrusher(e, dt)
    case 'alertDropper':
      return updateDropper(world, e, dt)
    case 'alert':
      return updateAlert(world, e, dt)
    default:
      return undefined
  }
}

// A size-2 merge conflict pops into two size-1 halves that hop apart.
function splitMerge(world, e) {
  e.alive = false
  const bottom = e.y + e.h
  for (const dir of [-1, 1]) {
    const kid = makeMergeConflict(world, 0, 0, 1, dir)
    kid.x = dir < 0 ? e.x - 2 : e.x + e.w - kid.w + 2
    kid.y = bottom - kid.h
    if (overlapsSolid(world.map, kid)) kid.x = e.x + (e.w - kid.w) / 2
    kid.vx = dir * MERGE_SPLIT_VX
    kid.vy = -MERGE_SPLIT_VY
    addEntity(world, kid)
  }
}

// Kills (or, for a size-2 merge conflict hit by echo, splits) an enemy.
// `split: false` (rm -rf) deletes it outright; `sfx: false` lets a sweep
// play one kill sound for many kills.
export function killEnemy(world, e, out, { split = true, sfx = true } = {}) {
  if (e.kind === 'mergeConflict' && e.size === 2 && split) {
    splitMerge(world, e)
    out.push({ type: 'sfx', name: 'kill' })
    return
  }
  e.alive = false
  out.push({ type: 'kill', kind: e.kind, score: KILL_SCORE[e.kind] })
  if (sfx) out.push({ type: 'sfx', name: 'kill' })
}
