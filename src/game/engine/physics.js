import { TILE, GRAVITY, MAX_FALL } from '../constants.js'
import { tileAt, EMPTY, SOLID, ONEWAY, CONVEYOR_R, CONVEYOR_L } from './tilemap.js'

// Tiles that block from every side. Conveyors are solid; their push belongs to
// the entity layer.
function isSolid(tile) {
  return tile === SOLID || tile === CONVEYOR_R || tile === CONVEYOR_L
}

// The tile rows (or columns) a span [start, start + size) overlaps.
function firstCell(start) {
  return Math.floor(start / TILE)
}
function lastCell(start, size) {
  return Math.ceil((start + size) / TILE) - 1
}

function solidInColumn(map, tx, body) {
  for (let ty = firstCell(body.y); ty <= lastCell(body.y, body.h); ty++) {
    if (isSolid(tileAt(map, tx, ty))) return true
  }
  return false
}

function moveX(body, map, dx) {
  if (dx > 0) {
    const right = body.x + body.w
    for (let tx = Math.ceil(right / TILE); tx <= lastCell(right, dx); tx++) {
      if (solidInColumn(map, tx, body)) {
        body.x = tx * TILE - body.w
        body.vx = 0
        return
      }
    }
  } else if (dx < 0) {
    for (let tx = firstCell(body.x) - 1; tx >= firstCell(body.x + dx); tx--) {
      if (solidInColumn(map, tx, body)) {
        body.x = (tx + 1) * TILE
        body.vx = 0
        return
      }
    }
  }
  body.x += dx
}

function rowBlocks(map, ty, body, falling) {
  for (let tx = firstCell(body.x); tx <= lastCell(body.x, body.w); tx++) {
    const tile = tileAt(map, tx, ty)
    if (isSolid(tile) || (falling && tile === ONEWAY)) return true
  }
  return false
}

function moveY(body, map, dy) {
  if (dy === 0) return
  body.onGround = false
  if (dy > 0) {
    const bottom = body.y + body.h
    // Only rows the feet newly enter are checked: a ONEWAY row the body is
    // already inside (it jumped up through it) lets it keep falling.
    for (let ty = Math.ceil(bottom / TILE); ty <= lastCell(bottom, dy); ty++) {
      if (rowBlocks(map, ty, body, true)) {
        body.y = ty * TILE - body.h
        body.vy = 0
        body.onGround = true
        return
      }
    }
  } else {
    for (let ty = firstCell(body.y) - 1; ty >= firstCell(body.y + dy); ty--) {
      if (rowBlocks(map, ty, body, false)) {
        body.y = (ty + 1) * TILE
        body.vy = 0
        return
      }
    }
  }
  body.y += dy
}

// Advances a body { x, y, w, h, vx, vy, onGround } by dt milliseconds against
// the map: gravity (clamped to MAX_FALL), then x, then y, stopping flush
// against what it hits and zeroing that velocity. Mutates the body.
export function stepBody(body, map, dt) {
  const s = dt / 1000
  body.vy = Math.min(body.vy + GRAVITY * s, MAX_FALL)
  moveX(body, map, body.vx * s)
  moveY(body, map, body.vy * s)
  return body
}

// AABB overlap; boxes that only share an edge don't overlap.
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

const FEET_EPSILON = 1e-6

// The tile the body stands on: the one under the middle of its feet, else the
// first non-empty one under the rest of them. EMPTY when the feet aren't
// resting on a tile edge (mid-air) or there is nothing below.
export function groundTileUnder(body, map) {
  const feet = body.y + body.h
  const ty = Math.round(feet / TILE)
  if (Math.abs(feet - ty * TILE) > FEET_EPSILON) return EMPTY
  const middle = tileAt(map, Math.floor((body.x + body.w / 2) / TILE), ty)
  if (middle !== EMPTY) return middle
  for (let tx = firstCell(body.x); tx <= lastCell(body.x, body.w); tx++) {
    const tile = tileAt(map, tx, ty)
    if (tile !== EMPTY) return tile
  }
  return EMPTY
}
