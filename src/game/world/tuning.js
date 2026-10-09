// Tuning numbers for the world simulation. Times are milliseconds, speeds px/s.
// The exported names in the first block are part of the world's public
// interface (index.js re-exports them); the rest are internal feel knobs.

export const INVULN_MS = 1000
export const SUDO_MS = 5000
export const FREEZE_MS = 1000
export const ECHO_COOLDOWN_MS = 300
export const SUDO_COOLDOWN_MS = 12000
export const RMRF_COOLDOWN_MS = 20000
export const RESPAWN_MS = 800
export const CONVEYOR_SPEED = 50
export const BUG_SPEED = 30
export const ECHO_SPEED = 300
export const TOKEN_SCORE = 100
export const FLAKY_MS = 1500
export const ALERT_INTERVAL_MS = 2000
export const CRUSHER_CYCLE_MS = 3000
export const BOSS_MAX_HP = 12
export const BOSS_THROW_MS = 2000
export const BOSS_REVERSE_MS = 3000
export const BOSS_REVERSE_INTERVAL_MS = 8000
// The boss is "on a call" (shielded: echo hits are blocked) for BOSS_CALL_MS
// out of every BOSS_CALL_INTERVAL_MS, counted from one call's start to the next.
export const BOSS_CALL_MS = 4500
export const BOSS_CALL_INTERVAL_MS = 6500
// A shot fades after traveling this far: half a screen, so you have to step
// into the boss's throw lanes to reach him (his arena's spawn is 288 px away).
export const ECHO_RANGE = 160
export const KILL_SCORE = Object.freeze({ bug: 50, mergeConflict: 50, flakyTest: 75, meetingInvite: 75 })

// Floating-point slack for timers that should fire "at" a multiple of dt.
export const TIME_EPS = 1e-6

// Player feel.
export const PLAYER_W = 12
export const PLAYER_H = 14
export const GROUND_ACCEL = 2400 // reaches RUN_SPEED in about 3 frames
export const GROUND_FRICTION = 3000
export const AIR_ACCEL = 1600
export const JUMP_CUT = 0.5 // vy multiplier when jump is released while rising
export const HURT_ANIM_MS = 250
export const KNOCK_MS = 180 // horizontal input is ignored while knocked back
export const KNOCK_VX = 150
export const KNOCK_VY = 200
export const SPIKE_HOP_VY = 220 // spikes bounce you straight up
export const SQUASH_MS = 120 // landing squash window exposed for render
export const SQUASH_MIN_VY = 150 // landings softer than this don't squash

// Camera.
export const CAMERA_TAU_MS = 90 // exponential follow time constant
export const CAMERA_LOOKAHEAD = 20 // px ahead of the player in the facing direction
export const CAMERA_MARGIN = 8 // the player is always at least this far inside the view

// Shake: intensities in [0, 1], decaying linearly; punchy rather than long
// (a hurt shakes for 120 ms, rm -rf for 200 ms).
export const SHAKE_DECAY_PER_MS = 1 / 200
export const SHAKE_HURT = 0.6
export const SHAKE_BOSS_HIT = 0.4
export const SHAKE_RMRF = 1

// Enemies.
export const MERGE_SPEED = { 2: 20, 1: 40 }
export const MERGE_SPLIT_VX = 60
export const MERGE_SPLIT_VY = 120 // a 4 px pop, so the halves stay in the line of fire
export const FLAKY_WARN_MS = 300 // `warn` is set this long before a flaky test turns solid
export const INVITE_SPEED = 45
export const INVITE_WAKE_RADIUS = 400 // an invite starts chasing once the player is this close
export const ALERT_WARN_MS = 400 // the dropper blinks this long before a drop
export const ALERT_MAX_FALL = 260
// Crusher cycle, as fractions of CRUSHER_CYCLE_MS.
export const CRUSHER_WARN_AT = 0.3 // rest at the top, then shake as a warning
export const CRUSHER_SLAM_AT = 0.42 // slam down (accelerating)
export const CRUSHER_DOWN_AT = 0.5 // sit at the bottom
export const CRUSHER_RISE_AT = 0.66 // rise back slowly until the cycle ends
export const CRUSHER_DEFAULT_TRAVEL = 3 * 16 // over a pit, with no floor to find

// Boss.
export const BOSS_W = 24
export const BOSS_H = 32
export const BOSS_WINDUP_MS = 350 // `anim: 'windup'` before each beat
export const BOSS_THROW_ANIM_MS = 200
export const BOSS_HIT_ANIM_MS = 150
export const BOSS_REVERSE_WARN_MS = 1000 // `warnReverse` before he changes the requirements
export const BOSS_PHASE3_REVERSE_DELAY_MS = 400 // entering phase 3 by a hit: first reversal this soon
export const BOSS_CALL_START_MS = 1000 // the first call, while you are still walking in
export const BOSS_CALL_WARN_MS = 700 // `callWarn`: the phone rings before a scheduled call
export const BOSS_HITS_PER_WINDOW = 2 // two hits between calls and he takes one at once
// The volley thrown on each beat, by phase: [offset ms into the beat, projectile].
export const BOSS_PATTERNS = Object.freeze({
  1: [[0, 'ticket']],
  2: [[0, 'ticket'], [700, 'ask']],
  3: [[0, 'ask'], [500, 'ticket'], [1000, 'ask']],
})
export const TICKET_SPEED = { 1: 110, 2: 130, 3: 150 }
export const TICKET_TOSS_VY = 250
export const TICKET_BOUNCE_VY = 300
export const TICKET_AIM_JITTER = 20 // px/s of horizontal speed variety, from world.rng
export const ASK_SPEED = 170
export const BOSS_MINION_CAP = { 1: 1, 2: 2, 3: 3 }
