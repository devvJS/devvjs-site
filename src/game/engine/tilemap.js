import { TILE } from '../constants.js'

// Tile ids, as stored in map.tiles.
export const EMPTY = 0
export const SOLID = 1
export const ONEWAY = 2 // solid only when landed on from above
export const SPIKES = 3 // not solid; hurts on contact
export const CONVEYOR_R = 4 // solid; the entity layer applies the push
export const CONVEYOR_L = 5

// Level character -> tile id (a number) or spawn kind (a string). A spawn's
// cell becomes EMPTY.
export const LEGEND = Object.freeze({
  '.': EMPTY,
  '#': SOLID,
  '=': ONEWAY,
  '^': SPIKES,
  '>': CONVEYOR_R,
  '<': CONVEYOR_L,
  P: 'player',
  C: 'checkpoint',
  E: 'exit',
  t: 'token',
  b: 'bug',
  m: 'mergeConflict',
  f: 'flakyTest',
  i: 'meetingInvite',
  x: 'crusher',
  a: 'alertDropper',
  B: 'boss',
})

// rows: equal-width strings, top row first. Returns { width, height, tiles,
// spawns }, tiles row-major (index y * width + x) and spawns row by row with
// pixel coordinates at the cell's top-left.
export function parseLevel(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('parseLevel: rows must be a non-empty array')
  const height = rows.length
  const width = typeof rows[0] === 'string' ? rows[0].length : 0
  if (width === 0) throw new Error('parseLevel: rows must be non-empty strings')

  const tiles = new Uint8Array(width * height)
  const spawns = []
  let players = 0

  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== width) {
      throw new Error(`parseLevel: row ${y} is ${row?.length} wide, expected ${width}`)
    }
    for (let x = 0; x < width; x++) {
      const ch = row[x]
      if (!Object.hasOwn(LEGEND, ch)) throw new Error(`parseLevel: unknown character ${JSON.stringify(ch)} at ${x},${y}`)
      const value = LEGEND[ch]
      if (typeof value === 'number') {
        tiles[y * width + x] = value
      } else {
        tiles[y * width + x] = EMPTY
        if (value === 'player') players++
        spawns.push({ kind: value, x: x * TILE, y: y * TILE })
      }
    }
  })

  if (players !== 1) throw new Error(`parseLevel: expected exactly one player (P), found ${players}`)
  return { width, height, tiles, spawns }
}

// The tile at tile coordinates. Past the left or right edge, or above the top,
// is SOLID (walls you can't leave through); below the bottom is EMPTY, so a
// body can fall out of the map.
export function tileAt(map, tx, ty) {
  if (tx < 0 || tx >= map.width || ty < 0) return SOLID
  if (ty >= map.height) return EMPTY
  return map.tiles[ty * map.width + tx]
}
