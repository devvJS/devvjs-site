// Turns a sprite's pixel grid into a few rectangles per color, so drawing a 16x16 tile
// costs a handful of fillRect calls instead of 256. Results are cached per sprite,
// per mirroring and per palette remap.
import { PALETTE, IDX } from './palette.js'
import { eachPixel, textWidth, GLYPH_H } from './font.js'

// A palette remap swaps colors by name: remap('frozen', { hoodie: 'iceDeep' }).
export function remap(name, swaps) {
  const map = new Map()
  for (const [from, to] of Object.entries(swaps)) map.set(IDX[from], IDX[to])
  return Object.freeze({ name, map })
}

// Greedy merge: horizontal runs of one color, then runs stacked on the next row with
// the same x and width grow downwards.
function build(sprite, mirror, swap) {
  const byColor = new Map()
  const open = new Map() // `${color}:${x}:${w}` -> rect still growing
  for (let y = 0; y < sprite.h; y++) {
    const row = mirror ? [...sprite.rows[y]].reverse() : sprite.rows[y]
    const seen = new Set()
    let x = 0
    while (x < sprite.w) {
      let c = row[x]
      if (swap && swap.map.has(c)) c = swap.map.get(c)
      let end = x + 1
      while (end < sprite.w) {
        let n = row[end]
        if (swap && swap.map.has(n)) n = swap.map.get(n)
        if (n !== c) break
        end++
      }
      if (c !== 0) {
        const key = `${c}:${x}:${end - x}`
        const prev = open.get(key)
        if (prev && prev.y + prev.h === y) {
          prev.h++
        } else {
          const rect = { x, y, w: end - x, h: 1 }
          open.set(key, rect)
          if (!byColor.has(c)) byColor.set(c, [])
          byColor.get(c).push(rect)
        }
        seen.add(key)
      }
      x = end
    }
    // Runs that didn't continue on this row are closed.
    for (const key of open.keys()) if (!seen.has(key)) open.delete(key)
  }
  const layers = [...byColor.entries()].map(([c, rects]) => ({
    color: PALETTE[c],
    rects: rects.flatMap((r) => [r.x, r.y, r.w, r.h]),
  }))
  return { w: sprite.w, h: sprite.h, layers }
}

const cache = new WeakMap()

// compiled = { w, h, layers: [{ color: '#rrggbb', rects: [x, y, w, h, ...] }] }
export function compiled(sprite, mirror = false, swap = null) {
  let perSprite = cache.get(sprite)
  if (!perSprite) {
    perSprite = new Map()
    cache.set(sprite, perSprite)
  }
  const key = `${mirror ? 'm' : ''}:${swap ? swap.name : ''}`
  let out = perSprite.get(key)
  if (!out) {
    out = build(sprite, mirror, swap)
    perSprite.set(key, out)
  }
  return out
}

// Pixel-font text as a compiled sprite in one color.
const textCache = new Map()
export function compiledText(text, colorName) {
  const key = `${colorName}|${text}`
  let out = textCache.get(key)
  if (!out) {
    const w = Math.max(1, textWidth(text))
    const rows = Array.from({ length: GLYPH_H }, () => new Array(w).fill(0))
    const c = IDX[colorName]
    eachPixel(text, (x, y) => {
      rows[y][x] = c
    })
    out = build({ w, h: GLYPH_H, rows }, false, null)
    textCache.set(key, out)
  }
  return out
}

// A tile split for cheap drawing: `rows[y]` is the color that fills row y edge to edge
// (the row's most common color, when the row has no transparent pixel), or null; and
// `detail` holds only the pixels that differ from it. The renderer merges the row fills
// of neighbouring tiles into long rectangles, then draws each tile's detail on top.
const layerCache = new WeakMap()
export function tileLayers(sprite) {
  let out = layerCache.get(sprite)
  if (out) return out
  const rows = []
  const detailRows = sprite.rows.map((row) => {
    if (row.includes(0)) {
      rows.push(null)
      return [...row]
    }
    const counts = new Map()
    for (const c of row) counts.set(c, (counts.get(c) || 0) + 1)
    let mode = row[0]
    for (const [c, n] of counts) if (n > counts.get(mode)) mode = c
    rows.push(PALETTE[mode])
    return row.map((c) => (c === mode ? 0 : c))
  })
  out = { rows, detail: build({ w: sprite.w, h: sprite.h, rows: detailRows }, false, null) }
  layerCache.set(sprite, out)
  return out
}
