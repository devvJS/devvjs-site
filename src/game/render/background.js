// The far layers behind each level, scrolled slower than the camera for a bit of depth.
// Everything is derived from the camera position and world time, so the same world
// always draws the same picture.
import { VIEW_W, VIEW_H } from '../constants.js'
import { COLOR } from './palette.js'

// A small integer hash, for placing things without randomness.
export function hash(a, b = 0, c = 0) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

const floorMod = (a, n) => ((a % n) + n) % n

// The editor: dim code lines at half speed and a line-number gutter.
function editor(p, cx, cy) {
  p.rect(COLOR.charcoal, 0, 0, VIEW_W, VIEW_H)
  const bx = Math.round(cx * 0.5)
  const by = Math.round(cy * 0.5)
  const LINE = 8
  const PAGE = 160
  const dims = [COLOR.codeDim, COLOR.codeDim2, COLOR.codeDim3]
  const first = Math.floor(by / LINE)
  for (let line = first; line * LINE - by < VIEW_H; line++) {
    const y = line * LINE - by
    for (let page = Math.floor(bx / PAGE); page * PAGE - bx < VIEW_W; page++) {
      const h = hash(line, page)
      if (h % 5 === 0) continue
      let x = page * PAGE - bx + 24 + ((h >>> 3) % 5) * 8
      const n = 1 + ((h >>> 7) % 3)
      for (let k = 0; k < n; k++) {
        const w = 6 + (hash(line, page, k) % 34)
        p.rect(dims[((h >>> 11) + k) % 3], x, y + 3, w, 2)
        x += w + 4
      }
    }
  }
  p.rect(COLOR.gutter, 0, 0, 18, VIEW_H)
  p.rect(COLOR.panelDark, 18, 0, 1, VIEW_H)
  for (let line = Math.max(0, first); line * LINE - by < VIEW_H; line++) {
    const y = line * LINE - by + 2
    if (y >= 0 && y + 5 <= VIEW_H) p.pixelText(String(line + 1), 16, y, 'gutterText', 'right')
  }
}

// The CI pipeline: stage boxes far back, big pipes in the middle, packets moving along.
function ci(p, cx, cy, time) {
  p.rect(COLOR.panelDark, 0, 0, VIEW_W, VIEW_H)
  const fx = Math.round(cx * 0.15)
  const fy = Math.round(cy * 0.15)
  const STAGE = 120
  const stages = ['build', 'test', 'deploy']
  for (let i = Math.floor(fx / STAGE); i * STAGE - fx < VIEW_W; i++) {
    const x = i * STAGE - fx + 20
    const y = 26 - fy
    p.rect(COLOR.pipeHi, x, y, 64, 22)
    p.rect(COLOR.pipe, x + 1, y + 1, 62, 20)
    const ok = floorMod(i, 4) !== 3
    p.rect(ok ? COLOR.darkGreen : COLOR.darkRed, x + 4, y + 8, 6, 6)
    p.pixelText(stages[floorMod(i, 3)], x + 14, y + 9, 'slate')
    p.rect(COLOR.steelDeep, x + 64, y + 10, STAGE - 64, 2)
    const run = Math.floor(time / 20 + i * 17) % (STAGE - 64)
    p.rect(COLOR.green, x + 64 + run, y + 10, 3, 2)
  }
  const mx = Math.round(cx * 0.35)
  const my = Math.round(cy * 0.35)
  for (const [py, flange] of [[86, 56], [118, 72]]) {
    const y = py - my
    p.rect(COLOR.pipe, 0, y, VIEW_W, 9)
    p.rect(COLOR.pipeHi, 0, y + 1, VIEW_W, 2)
    p.rect(COLOR.ink, 0, y + 9, VIEW_W, 1)
    for (let x = -floorMod(mx, flange); x < VIEW_W; x += flange) p.rect(COLOR.steelDeep, x, y - 2, 4, 13)
  }
}

// Production: rows of server racks with blinking status LEDs.
function prod(p, cx, cy, time) {
  p.rect(COLOR.rackDeep, 0, 0, VIEW_W, VIEW_H)
  const fx = Math.round(cx * 0.3)
  const fy = Math.round(cy * 0.3)
  const RACK = 44
  const leds = [COLOR.green, COLOR.green, COLOR.amber, COLOR.ledOff, COLOR.green, COLOR.red]
  for (let r = Math.floor(fx / RACK); r * RACK - fx < VIEW_W; r++) {
    const x = r * RACK - fx
    const top = 12 - fy
    p.rect(COLOR.ink, x, top, 34, VIEW_H)
    p.rect(COLOR.rack, x + 1, top + 1, 32, VIEW_H)
    for (let u = 0; top + 3 + u * 8 < VIEW_H; u++) {
      const y = top + 3 + u * 8
      p.rect(COLOR.rackLight, x + 2, y, 30, 1)
      const h = hash(r, u)
      const phase = Math.floor((time + (h % 997)) / (400 + (h % 5) * 150))
      p.rect(leds[(h + phase) % leds.length], x + 4, y + 3, 2, 1)
      p.rect(leds[(h + phase * 3 + 1) % leds.length], x + 8, y + 3, 2, 1)
    }
  }
}

// The boss arena: an office wall, ceiling lights and a whiteboard with the roadmap.
function boss(p, cx, cy) {
  p.rect(COLOR.wall, 0, 0, VIEW_W, VIEW_H)
  const fx = Math.round(cx * 0.2)
  const fy = Math.round(cy * 0.2)
  for (let x = -floorMod(fx, 80) + 20; x < VIEW_W; x += 80) {
    p.rect(COLOR.wallHi, x - 4, 0, 40, 6 - fy)
    p.rect(COLOR.board, x, 2 - fy, 32, 2)
  }
  p.rect(COLOR.wallHi, 0, 150 - fy, VIEW_W, 2)
  const BOARD = 300
  for (let i = Math.floor(fx / BOARD); i * BOARD - fx < VIEW_W; i++) {
    const x = i * BOARD - fx + 90
    const y = 26 - fy
    p.rect(COLOR.boardFrame, x, y, 124, 68)
    p.rect(COLOR.board, x + 2, y + 2, 120, 64)
    p.pixelText('q4 roadmap', x + 6, y + 6, 'tie')
    p.rect(COLOR.tie, x + 6, y + 12, 40, 1)
    for (let k = 0; k < 4; k++) {
      p.rect(COLOR.hoodie, x + 8, y + 20 + k * 9, 4, 4)
      p.rect(COLOR.slate, x + 15, y + 21 + k * 9, 20 + ((k * 13) % 17), 2)
    }
    // the chart only goes up and to the right
    const pts = [[64, 54], [76, 48], [86, 50], [98, 36], [112, 22]]
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1]
      const [x1, y1] = pts[k]
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let s = 0; s <= steps; s += 2) {
        p.rect(COLOR.darkGreen, x + Math.round(x0 + ((x1 - x0) * s) / steps), y + Math.round(y0 + ((y1 - y0) * s) / steps), 2, 2)
      }
    }
    p.rect(COLOR.yellow, x + 100, y + 44, 10, 10)
    p.rect(COLOR.peach, x + 88, y + 8, 10, 10)
  }
}

const LAYERS = { editor, ci, prod, boss }

export function drawBackground(p, theme, cx, cy, time) {
  ;(LAYERS[theme] ?? editor)(p, cx, cy, time)
}
