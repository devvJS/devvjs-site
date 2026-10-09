// Reachability checker for level maps (a conservative 1x1-cell abstraction).
// See .swarm/tc/reports/test-S2.md for the rules in prose.
import { TILE, MAX_JUMP_TILES_UP, MAX_GAP_TILES } from '../../../src/game/constants.js'
import { tileAt, EMPTY, SOLID, ONEWAY, SPIKES, CONVEYOR_R, CONVEYOR_L } from '../../../src/game/engine/tilemap.js'

const isSupport = (t) => t === SOLID || t === ONEWAY || t === CONVEYOR_R || t === CONVEYOR_L
// A cell a body can pass through while moving (not solid, not hurting).
const isPassable = (t) => t === EMPTY || t === ONEWAY

// A cell where Devv can stand: EMPTY, with SOLID, ONEWAY or a conveyor directly below.
// A cell above SPIKES (or above nothing) is never standable.
export function isStandable(map, x, y) {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false
  return tileAt(map, x, y) === EMPTY && isSupport(tileAt(map, x, y + 1))
}

// Drop straight down column x starting at row y (inclusive). Returns the landing row or -1.
function dropRow(map, x, y) {
  for (let cy = y; cy < map.height; cy++) {
    if (tileAt(map, x, cy) !== EMPTY) return -1
    if (isSupport(tileAt(map, x, cy + 1))) return cy
  }
  return -1
}

function rowClear(map, x0, x1, y) {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  for (let x = lo; x <= hi; x++) if (!isPassable(tileAt(map, x, y))) return false
  return true
}

// Largest horizontal distance for a jump that rises `rise` rows.
export function maxJumpDx(rise) {
  return MAX_GAP_TILES - Math.max(0, rise - 1)
}

export function neighbours(map, x, y) {
  const out = []
  const add = (nx, ny) => out.push([nx, ny])
  // walk
  for (const dx of [-1, 1]) if (isStandable(map, x + dx, y)) add(x + dx, y)
  // fall: step off horizontally by 1..MAX_GAP_TILES columns, then drop
  for (const sign of [-1, 1]) {
    for (let d = 1; d <= MAX_GAP_TILES; d++) {
      if (!rowClear(map, x + sign, x + sign * d, y)) break
      const r = dropRow(map, x + sign * d, y)
      if (r > y) add(x + sign * d, r) // a fall must drop at least one row
    }
  }
  // jump: rise 0..MAX_JUMP_TILES_UP rows, |dx| <= maxJumpDx(rise)
  for (let rise = 0; rise <= MAX_JUMP_TILES_UP; rise++) {
    const ty = y - rise
    for (let dx = -maxJumpDx(rise); dx <= maxJumpDx(rise); dx++) {
      if (dx === 0 && rise === 0) continue
      const tx = x + dx
      if (!isStandable(map, tx, ty)) continue
      let ok = true
      for (let cy = ty; cy < y && ok; cy++) if (!isPassable(tileAt(map, x, cy))) ok = false
      if (ok && !rowClear(map, x, tx, ty)) ok = false
      if (ok && !rowClear(map, x, tx, ty - 1)) ok = false
      if (ok && !isPassable(tileAt(map, x, ty - 1))) ok = false
      if (ok) add(tx, ty)
    }
  }
  return out
}

// Set of reachable standable cells (keys y * width + x), starting from the P spawn
// (dropped straight down to the first standable cell).
export function reachableCells(map) {
  const player = map.spawns.find((s) => s.kind === 'player')
  const px = player.x / TILE
  const py = player.y / TILE
  const seen = new Set()
  const startRow = dropRow(map, px, py)
  if (startRow < 0) return seen
  const queue = [[px, startRow]]
  seen.add(startRow * map.width + px)
  while (queue.length) {
    const [x, y] = queue.pop()
    for (const [nx, ny] of neighbours(map, x, y)) {
      const key = ny * map.width + nx
      if (!seen.has(key)) {
        seen.add(key)
        queue.push([nx, ny])
      }
    }
  }
  return seen
}

function cellsOf(map, reach) {
  return [...reach].map((k) => [k % map.width, Math.floor(k / map.width)])
}

// A spawn (exit, checkpoint) is reached when a reachable standable cell is within
// one cell of it in both axes (including its own cell).
export function spawnReached(map, reach, spawn) {
  const sx = spawn.x / TILE
  const sy = spawn.y / TILE
  return cellsOf(map, reach).some(([x, y]) => Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1)
}

// A token is collected when it is within one cell of a reachable standable cell, or in
// the same column up to MAX_JUMP_TILES_UP rows above one with the cells between passable.
export function tokenReached(map, reach, spawn) {
  const tx = spawn.x / TILE
  const ty = spawn.y / TILE
  return cellsOf(map, reach).some(([x, y]) => {
    if (Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1) return true
    if (x !== tx) return false
    const rise = y - ty
    if (rise < 0 || rise > MAX_JUMP_TILES_UP) return false
    for (let cy = ty; cy < y; cy++) if (!isPassable(tileAt(map, x, cy))) return false
    return true
  })
}

export function reachableTokenCount(map, reach) {
  return map.spawns.filter((s) => s.kind === 'token' && tokenReached(map, reach, s)).length
}

// The boss arena floor: dropping from B's cell lands on a reachable cell, and at least
// 10 cells of that floor row are reachable.
export function bossFloorReachable(map, reach) {
  const boss = map.spawns.find((s) => s.kind === 'boss')
  const bx = boss.x / TILE
  const row = dropRow(map, bx, boss.y / TILE)
  if (row < 0 || !reach.has(row * map.width + bx)) return false
  return cellsOf(map, reach).filter(([, y]) => y === row).length >= 10
}

// ---- Softlock rule ----------------------------------------------------------
// What happens to a fall step from (x,y) by d columns: the drop ends 'land' (on a
// standable cell strictly lower), 'void' (leaves the map: a death), 'spikes' (ends in a
// spike cell: damage), or 'blocked'.
function dropOutcome(map, x, y) {
  for (let cy = y; cy < map.height; cy++) {
    const t = tileAt(map, x, cy)
    if (t === SPIKES) return 'spikes'
    if (t !== EMPTY) return 'blocked'
    if (isSupport(tileAt(map, x, cy + 1))) return 'land'
  }
  return 'void'
}

// True when the cell has a fall that leaves the map or ends in spikes, or a spike cell
// within Chebyshev distance 1 (damage eventually respawns the player).
function canDieFrom(map, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (tileAt(map, x + dx, y + dy) === SPIKES) return true
  }
  for (const sign of [-1, 1]) {
    for (let d = 1; d <= MAX_GAP_TILES; d++) {
      if (!rowClear(map, x + sign, x + sign * d, y)) break
      const out = dropOutcome(map, x + sign * d, y)
      if (out === 'void' || out === 'spikes') return true
    }
  }
  return false
}

// Reachable standable cells (as [x, y]) from which Devv can neither get near the exit
// (Chebyshev 1 of E, via the same move graph) nor die (fall out of the map, or hit
// spikes). An empty array means no softlock.
export function softlockedCells(map) {
  const reach = reachableCells(map)
  const exit = map.spawns.find((s) => s.kind === 'exit')
  const ex = exit.x / TILE
  const ey = exit.y / TILE
  const cells = cellsOf(map, reach)
  const good = new Set()
  const reverse = new Map()
  for (const [x, y] of cells) {
    const key = y * map.width + x
    if ((Math.abs(x - ex) <= 1 && Math.abs(y - ey) <= 1) || canDieFrom(map, x, y)) good.add(key)
    for (const [nx, ny] of neighbours(map, x, y)) {
      const nk = ny * map.width + nx
      if (!reverse.has(nk)) reverse.set(nk, [])
      reverse.get(nk).push(key)
    }
  }
  const stack = [...good]
  while (stack.length) {
    for (const prev of reverse.get(stack.pop()) ?? []) {
      if (!good.has(prev)) {
        good.add(prev)
        stack.push(prev)
      }
    }
  }
  return cells.filter(([x, y]) => !good.has(y * map.width + x))
}
