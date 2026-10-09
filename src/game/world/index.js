// The world simulation (slice S1): entities, powers and the boss.
//   createWorld(levelDef, { seed = 1, powers = {} }) -> world
//   stepWorld(world, frameInput, dt) -> events[]
// plus the tuning constants other slices and tests rely on.
export { createWorld, stepWorld } from './world.js'
export {
  INVULN_MS, SUDO_MS, FREEZE_MS, ECHO_COOLDOWN_MS, SUDO_COOLDOWN_MS, RMRF_COOLDOWN_MS, RESPAWN_MS,
  CONVEYOR_SPEED, BUG_SPEED, ECHO_SPEED, TOKEN_SCORE, FLAKY_MS, ALERT_INTERVAL_MS, CRUSHER_CYCLE_MS,
  BOSS_MAX_HP, BOSS_THROW_MS, BOSS_REVERSE_MS, BOSS_REVERSE_INTERVAL_MS, KILL_SCORE,
  ECHO_RANGE, BOSS_CALL_MS, BOSS_CALL_INTERVAL_MS,
} from './tuning.js'
