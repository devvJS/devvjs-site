// createRenderer(ctx) -> { draw(gameState) }
// Draws one frame of the game into a 320x180 2D context, with smoothing off. It only
// reads the state. The interpolation alpha the loop passes is not used: the world
// keeps no previous positions, and the fixed 60 Hz step is smooth enough.
import { STEP_MS, VIEW_W, VIEW_H } from '../constants.js'
import { COLOR } from './palette.js'
import { createPainter } from './painter.js'
import { drawWorld } from './world.js'
import { createHud } from './hud.js'
import { drawTitle, drawPaused, drawLevelComplete, drawVictory } from './screens.js'

const SHAKE_PX = 4

// Camera shake is the one place randomness is used, and only while shaking.
function shakeOffset(world) {
  const s = Math.max(0, Math.min(1, Number(world.shake) || 0))
  if (s === 0) return { x: 0, y: 0 }
  return { x: Math.round((Math.random() * 2 - 1) * s * SHAKE_PX), y: Math.round((Math.random() * 2 - 1) * s * SHAKE_PX) }
}

export function createRenderer(ctx) {
  ctx.imageSmoothingEnabled = false
  const p = createPainter(ctx)
  const hud = createHud()
  let frames = 0

  // The world and the HUD. Paused frames hold still: no shake.
  function playing(state, shake) {
    const world = state.world
    if (!world) {
      p.rect(COLOR.charcoal, 0, 0, VIEW_W, VIEW_H)
      return
    }
    drawWorld(p, world, shake ? shakeOffset(world) : { x: 0, y: 0 })
    hud.draw(p, state)
  }

  return {
    draw(state) {
      const t = frames++ * STEP_MS
      p.begin()
      switch (state?.screen) {
        case 'title':
          drawTitle(p, state, t)
          break
        case 'playing':
          playing(state, true)
          break
        case 'paused':
          playing(state, false)
          drawPaused(p, state, t)
          break
        case 'level-complete':
          if (state.world) drawWorld(p, state.world, { x: 0, y: 0 })
          else p.rect(COLOR.charcoal, 0, 0, VIEW_W, VIEW_H)
          drawLevelComplete(p, state, t)
          break
        case 'victory':
          drawVictory(p, state, t)
          break
        default:
          p.rect(COLOR.charcoal, 0, 0, VIEW_W, VIEW_H)
      }
    },
  }
}
