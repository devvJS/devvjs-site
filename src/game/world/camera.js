// The camera: eases toward the player (a little ahead of where they face),
// never lets them leave the view, and is clamped to the map.
import { TILE, VIEW_W, VIEW_H } from '../constants.js'
import { CAMERA_TAU_MS, CAMERA_LOOKAHEAD, CAMERA_MARGIN } from './tuning.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function bounds(map) {
  return { maxX: Math.max(0, map.width * TILE - VIEW_W), maxY: Math.max(0, map.height * TILE - VIEW_H) }
}

function target(world) {
  const p = world.player
  return {
    x: p.x + p.w / 2 - VIEW_W / 2 + p.facing * CAMERA_LOOKAHEAD,
    y: p.y + p.h / 2 - VIEW_H / 2,
  }
}

// Keeps the player inside the view, then the view inside the map.
function constrain(world, cam) {
  const p = world.player
  const { maxX, maxY } = bounds(world.map)
  const x = clamp(cam.x, p.x + p.w + CAMERA_MARGIN - VIEW_W, p.x - CAMERA_MARGIN)
  const y = clamp(cam.y, p.y + p.h + CAMERA_MARGIN - VIEW_H, p.y - CAMERA_MARGIN)
  return { x: clamp(x, 0, maxX), y: clamp(y, 0, maxY) }
}

export function snapCamera(world) {
  world.camera = constrain(world, target(world))
}

export function followCamera(world, dt) {
  const t = target(world)
  const k = 1 - Math.exp(-dt / CAMERA_TAU_MS)
  const cam = world.camera
  const next = constrain(world, { x: cam.x + (t.x - cam.x) * k, y: cam.y + (t.y - cam.y) * k })
  cam.x = next.x
  cam.y = next.y
}
