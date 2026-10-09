// Every draw goes through the painter. It clips rectangles to the 320x180 view (or a
// smaller clip box), keeps text anchors on screen, and only touches ctx state when
// it changes. It uses fillRect and fillText only: no paths, no scaling (the canvas is
// scaled up by CSS).
import { VIEW_W, VIEW_H } from '../constants.js'
import { COLOR } from './palette.js'
import { compiledText } from './compile.js'
import { textWidth } from './font.js'

export const VIEW = Object.freeze({ x0: 0, y0: 0, x1: VIEW_W, y1: VIEW_H })

export const FONT_FAMILY = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function intersect(a, b) {
  return { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) }
}

export function createPainter(ctx) {
  let fill = null
  let alpha = null
  let font = null
  let align = null
  let baseline = null

  const p = {
    // Called at the start of every frame: ctx state may have been reset (a resize clears it).
    begin() {
      fill = null
      font = null
      align = null
      baseline = null
      alpha = null
      ctx.imageSmoothingEnabled = false
      p.alpha(1)
    },

    alpha(a) {
      if (a !== alpha) {
        ctx.globalAlpha = a
        alpha = a
      }
    },

    // A filled rectangle, clipped. `color` is a hex string.
    rect(color, x, y, w, h, clip = VIEW) {
      const x0 = Math.max(x, clip.x0)
      const y0 = Math.max(y, clip.y0)
      const x1 = Math.min(x + w, clip.x1)
      const y1 = Math.min(y + h, clip.y1)
      if (x1 <= x0 || y1 <= y0) return
      if (color !== fill) {
        ctx.fillStyle = color
        fill = color
      }
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    },

    // A compiled sprite with its top-left at (x, y).
    sprite(c, x, y, clip = VIEW) {
      if (x >= clip.x1 || y >= clip.y1 || x + c.w <= clip.x0 || y + c.h <= clip.y0) return
      for (const layer of c.layers) {
        const r = layer.rects
        for (let i = 0; i < r.length; i += 4) p.rect(layer.color, x + r[i], y + r[i + 1], r[i + 2], r[i + 3], clip)
      }
    },

    // Pixel-font text (3x5 glyphs). align: 'left' | 'center' | 'right'.
    pixelText(text, x, y, colorName, alignTo = 'left') {
      const w = textWidth(text)
      const left = alignTo === 'center' ? x - Math.floor(w / 2) : alignTo === 'right' ? x - w : x
      p.sprite(compiledText(text, colorName), left, y)
    },

    // Canvas text, anchored at (x, y) with the given alignment; baseline is 'top'.
    // A drop shadow `depth` px deep is drawn first: ink, except the layer nearest the
    // text, which takes `shadow` when it is a color (true means plain ink).
    text(str, x, y, { color = COLOR.light, size = 8, bold = false, alignTo = 'left', shadow = true, depth = 1 } = {}) {
      const ax = clamp(Math.round(x), 0, VIEW_W - 1)
      const ay = clamp(Math.round(y), 0, VIEW_H - 1)
      const f = `${bold ? 'bold ' : ''}${size}px ${FONT_FAMILY}`
      if (f !== font) {
        ctx.font = f
        font = f
      }
      if (alignTo !== align) {
        ctx.textAlign = alignTo
        align = alignTo
      }
      if (baseline !== 'top') {
        ctx.textBaseline = 'top'
        baseline = 'top'
      }
      if (shadow) {
        for (let d = depth; d >= 1; d--) {
          const sx = clamp(ax + d, 0, VIEW_W - 1)
          const sy = clamp(ay + d, 0, VIEW_H - 1)
          p.fillText(str, sx, sy, d === 1 && typeof shadow === 'string' ? shadow : COLOR.ink)
        }
      }
      p.fillText(str, ax, ay, color)
    },

    fillText(str, x, y, color) {
      if (color !== fill) {
        ctx.fillStyle = color
        fill = color
      }
      ctx.fillText(str, x, y)
    },
  }
  return p
}
