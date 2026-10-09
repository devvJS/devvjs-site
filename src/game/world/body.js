// Collision helpers for the entity layer, built on the engine's stepBody,
// groundTileUnder and tileAt so every entity resolves against tiles the same way.
import { TILE, GRAVITY } from '../constants.js'
import { stepBody, groundTileUnder } from '../engine/physics.js'
import { tileAt, SOLID, ONEWAY, SPIKES, CONVEYOR_R, CONVEYOR_L } from '../engine/tilemap.js'
import { CONVEYOR_SPEED } from './tuning.js'

// Tiles that block movement from every side (the engine treats conveyors as solid).
export function isSolidTile(tile) {
  return tile === SOLID || tile === CONVEYOR_R || tile === CONVEYOR_L
}

// Tiles something can stand on.
export function isGroundTile(tile) {
  return isSolidTile(tile) || tile === ONEWAY
}

// The tile rows (or columns) a span [start, start + size) overlaps.
const firstCell = (start) => Math.floor(start / TILE)
const lastCell = (start, size) => Math.ceil((start + size) / TILE) - 1

// Calls fn(tile) for each tile the box overlaps; stops early when fn returns true.
function someTile(map, box, fn) {
  for (let ty = firstCell(box.y); ty <= lastCell(box.y, box.h); ty++) {
    for (let tx = firstCell(box.x); tx <= lastCell(box.x, box.w); tx++) {
      if (fn(tileAt(map, tx, ty))) return true
    }
  }
  return false
}

export function touchesSpikes(map, box) {
  return someTile(map, box, (t) => t === SPIKES)
}

export function overlapsSolid(map, box) {
  return someTile(map, box, isSolidTile)
}

// The conveyor push (px/s) on a grounded body, 0 elsewhere.
export function beltPush(body, map) {
  if (!body.onGround) return 0
  const tile = groundTileUnder(body, map)
  if (tile === CONVEYOR_R) return CONVEYOR_SPEED
  if (tile === CONVEYOR_L) return -CONVEYOR_SPEED
  return 0
}

// stepBody with the conveyor push added to this step's horizontal motion only:
// body.vx keeps the body's own speed. Returns true if a wall stopped it.
export function stepWithBelt(body, map, dt) {
  const own = body.vx
  const total = own + beltPush(body, map)
  body.vx = total
  stepBody(body, map, dt)
  const blocked = total !== 0 && body.vx === 0
  body.vx = blocked ? 0 : own
  return blocked
}

// Moves a body horizontally only, ignoring gravity (projectiles), through
// stepBody: vy is set to -g*dt so the engine's gravity term brings it to exactly
// 0 and there is no vertical move. Returns true if a wall stopped it.
export function stepHorizontal(body, map, dt) {
  const vx = body.vx
  body.vy = -(GRAVITY * (dt / 1000))
  stepBody(body, map, dt)
  body.vy = 0
  return vx !== 0 && body.vx === 0
}

// Feet row helpers for walkers. A grounded body's feet sit on a tile edge.
function feetRow(body) {
  return Math.round((body.y + body.h) / TILE)
}

// True when a walker moving `dir` by `step` px would have a wall in its body
// rows, or no ground under its leading foot.
export function blockedAhead(body, map, dir, step) {
  const lead = dir > 0 ? body.x + body.w + step : body.x - step
  const tx = Math.floor((dir > 0 ? lead - 1e-6 : lead) / TILE)
  for (let ty = firstCell(body.y); ty <= lastCell(body.y, body.h); ty++) {
    if (isSolidTile(tileAt(map, tx, ty))) return true
  }
  if (!body.onGround) return false
  return !isGroundTile(tileAt(map, tx, feetRow(body)))
}

// The y that puts a box of height h standing on the first ground below the
// cell row `fromRow`, across the box's columns; null over a bottomless pit.
export function groundYBelow(map, x, w, fromRow, h) {
  for (let ty = fromRow; ty < map.height; ty++) {
    for (let tx = firstCell(x); tx <= lastCell(x, w); tx++) {
      if (isGroundTile(tileAt(map, tx, ty))) return ty * TILE - h
    }
  }
  return null
}

export function outOfMap(map, body) {
  return body.y > map.height * TILE
}

export function center(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
}
