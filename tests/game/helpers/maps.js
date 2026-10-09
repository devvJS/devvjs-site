import { parseLevel } from '../../../src/game/engine/tilemap.js'

// Build a map from rows; rows must include exactly one P.
export function mapOf(rows) {
  return parseLevel(rows)
}

// A body 12x14 (the player's size) at pixel x, y.
export function bodyAt(x, y, over = {}) {
  return { x, y, w: 12, h: 14, vx: 0, vy: 0, onGround: false, ...over }
}

// n rows of the same string.
export function rep(row, n) {
  return Array.from({ length: n }, () => row)
}
