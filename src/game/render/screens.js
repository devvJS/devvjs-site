// The title, paused, level-complete and victory screens. `t` is the renderer's own
// clock in ms (frames drawn x STEP_MS), used for blinking and the small animations.
import { VIEW_W, VIEW_H } from '../constants.js'
import { COLOR } from './palette.js'
import { SPRITES } from './sprites.js'
import { compiled } from './compile.js'
import {
  LEVEL_NAMES, POWER_COMMAND, THEME_ORDER, THEME_POWER, formatScore, formatTime, levelNumber, themeOf,
} from './themes.js'

const blinkOn = (t, period = 1000) => t % period < period * 0.65

// Falling bits of green and cyan. They wrap inside the screen, never crossing an edge.
function bits(p, t, count, colors) {
  for (let i = 0; i < count; i++) {
    const x = 3 + ((i * 53 + 11) % (VIEW_W - 6))
    const speed = 0.01 + (i % 5) * 0.006
    const y = 2 + (Math.floor(i * 37 + t * speed) % (VIEW_H - 6))
    p.rect(colors[i % colors.length], x, y, 1, 2)
  }
}

function dim(p, a = 0.65) {
  p.alpha(a)
  p.rect(COLOR.ink, 0, 0, VIEW_W, VIEW_H)
  p.alpha(1)
}

function panel(p, x, y, w, h, edge) {
  p.rect(COLOR.ink, x, y, w, h)
  p.rect(edge, x + 1, y + 1, w - 2, h - 2)
  p.rect(COLOR.panel, x + 2, y + 2, w - 4, h - 4)
}

export function drawTitle(p, state, t) {
  p.rect(COLOR.charcoal, 0, 0, VIEW_W, VIEW_H)
  bits(p, t, 48, [COLOR.codeDim3, COLOR.darkGreen, COLOR.darkCyan, COLOR.codeDim])

  // a terminal window holding the logo
  panel(p, 34, 14, 252, 82, COLOR.panelEdge)
  p.rect(COLOR.panelEdge, 36, 16, 248, 7)
  p.rect(COLOR.red, 39, 18, 3, 3)
  p.rect(COLOR.yellow, 44, 18, 3, 3)
  p.rect(COLOR.green, 49, 18, 3, 3)
  p.pixelText('~/codespace $ ./chaos', 160, 17, 'slate', 'center')

  p.text("DEVV'S", 160, 30, { color: COLOR.cyan, size: 12, bold: true, alignTo: 'center', depth: 2, shadow: COLOR.darkCyan })
  p.text('TERMINAL CHAOS', 160, 46, { color: COLOR.green, size: 22, bold: true, alignTo: 'center', depth: 3, shadow: COLOR.darkGreen })
  p.text('The PM flooded the CodeSpace with tickets.', 160, 78, { color: COLOR.light, size: 7, alignTo: 'center' })

  if (blinkOn(t)) p.text('PRESS ENTER / TAP TO START', 160, 112, { color: COLOR.white, size: 9, bold: true, alignTo: 'center' })
  if (state.best) {
    p.text(`BEST ${formatScore(state.best.score)}  ${formatTime(state.best.timeMs)}`, 160, 128, {
      color: COLOR.cyan,
      size: 7,
      alignTo: 'center',
    })
  }
  p.text('ARROWS/AD MOVE  SPACE JUMP  J ECHO  K SUDO  L RM -RF  M MUTE', 160, 164, {
    color: COLOR.grey,
    size: 6,
    alignTo: 'center',
  })

  // Devv and a bug, squaring up on a code line
  p.rect(COLOR.panelEdge, 22, 128, 46, 2)
  p.rect(COLOR.panelEdge, 252, 128, 46, 2)
  const run = Math.floor(t / 110) % 2
  p.sprite(compiled(run ? SPRITES.playerFrames.run1 : SPRITES.playerFrames.run2), 40, 114)
  p.sprite(compiled(run ? SPRITES.variant.bugStep : SPRITES.entity.bug, true), 268, 116)
}

export function drawPaused(p, state, t) {
  dim(p)
  panel(p, 90, 52, 140, 72, COLOR.darkCyan)
  p.text('PAUSED', 160, 62, { color: COLOR.cyan, size: 20, bold: true, alignTo: 'center', depth: 2, shadow: COLOR.darkCyan })
  if (blinkOn(t, 1200)) p.text('PRESS ESC / P TO RESUME', 160, 92, { color: COLOR.light, size: 7, alignTo: 'center' })
  p.text(`SOUND ${state.muted === false ? 'ON' : 'OFF'} (M)`, 160, 106, { color: COLOR.grey, size: 7, alignTo: 'center' })
}

export function drawLevelComplete(p, state, t) {
  dim(p, 0.72)
  panel(p, 40, 24, 240, 132, COLOR.darkGreen)
  const theme = themeOf(state)
  const n = levelNumber(state)
  p.text('LEVEL COMPLETE', 160, 34, { color: COLOR.green, size: 18, bold: true, alignTo: 'center', depth: 2, shadow: COLOR.darkGreen })
  p.text(`L${n} ${LEVEL_NAMES[theme].toUpperCase()} CLEARED`, 160, 60, { color: COLOR.light, size: 7, alignTo: 'center' })

  const power = THEME_POWER[theme]
  if (power) {
    p.rect(COLOR.ink, 92, 74, 136, 16)
    p.text(`$ ${POWER_COMMAND[power]} unlocked`, 160, 78, { color: COLOR.green, size: 9, bold: true, alignTo: 'center', shadow: false })
  }
  const next = THEME_ORDER[THEME_ORDER.indexOf(theme) + 1]
  if (next) {
    p.text(`NEXT: L${n + 1} ${LEVEL_NAMES[next].toUpperCase()}`, 160, 100, { color: COLOR.cyan, size: 7, alignTo: 'center' })
  }
  p.text(`SCORE ${formatScore(state.score)}   TIME ${formatTime(state.timeMs)}`, 160, 114, {
    color: COLOR.light,
    size: 7,
    alignTo: 'center',
  })
  if (blinkOn(t)) p.text('PRESS ENTER / TAP TO CONTINUE', 160, 136, { color: COLOR.white, size: 8, bold: true, alignTo: 'center' })
}

export function drawVictory(p, state, t) {
  p.rect(COLOR.charcoal, 0, 0, VIEW_W, VIEW_H)
  bits(p, t * 2, 70, [COLOR.green, COLOR.cyan, COLOR.yellow, COLOR.purple, COLOR.orange])

  p.text('Shipped. CodeSpace saved.', 160, 22, { color: COLOR.green, size: 14, bold: true, alignTo: 'center', depth: 2, shadow: COLOR.darkGreen })
  p.text('The backlog is empty. The PM is out of asks.', 160, 44, { color: COLOR.light, size: 7, alignTo: 'center' })

  panel(p, 90, 58, 140, 66, COLOR.darkGreen)
  const best = state.best
  const isBest = best && best.score === state.score && best.timeMs === state.timeMs
  const rows = [
    [`SCORE  ${formatScore(state.score)}`, COLOR.green],
    [`TIME   ${formatTime(state.timeMs)}`, COLOR.light],
    [`DEATHS ${Math.max(0, state.deaths | 0)}`, COLOR.light],
    [best ? `BEST   ${formatScore(best.score)}  ${formatTime(best.timeMs)}` : 'BEST   ------', COLOR.cyan],
  ]
  rows.forEach(([text, color], i) => p.text(text, 100, 64 + i * 13, { color, size: 8, bold: i === 0 }))
  if (isBest && blinkOn(t, 600)) p.text('NEW BEST!', 160, 128, { color: COLOR.yellow, size: 8, bold: true, alignTo: 'center' })

  // Devv celebrating on either side
  const hop = Math.floor(t / 160) % 2
  p.sprite(compiled(hop ? SPRITES.playerFrames.jump : SPRITES.playerFrames.idle), 52, 92 - hop * 4)
  p.sprite(compiled(hop ? SPRITES.playerFrames.idle : SPRITES.playerFrames.jump, true), 256, 92 - (1 - hop) * 4)

  if (blinkOn(t)) p.text('PRESS ENTER / TAP TO PLAY AGAIN', 160, 150, { color: COLOR.white, size: 8, bold: true, alignTo: 'center' })
}
