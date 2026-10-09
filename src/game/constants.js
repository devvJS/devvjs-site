// Shared numbers for the game. Distances are pixels, times are milliseconds,
// speeds are px/s and accelerations px/s^2.
export const TILE = 16
export const VIEW_W = 320
export const VIEW_H = 180
export const STEP_MS = 1000 / 60

export const GRAVITY = 1800
// Upward launch speed (vy = -JUMP_VELOCITY): about 3.5 tiles of rise.
export const JUMP_VELOCITY = 450
export const RUN_SPEED = 130
export const MAX_FALL = 420

export const COYOTE_MS = 80
export const JUMP_BUFFER_MS = 100

// Level-design limits checked by the reachability test.
export const MAX_JUMP_TILES_UP = 3
export const MAX_GAP_TILES = 3

export const MAX_COFFEE = 3

export const ACTIONS = Object.freeze([
  'left',
  'right',
  'jump',
  'echo',
  'sudo',
  'rmrf',
  'pause',
  'mute',
  'start',
])
