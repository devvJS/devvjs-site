// Camera shake: an intensity in [0, 1] that decays linearly to exactly 0.
import { SHAKE_DECAY_PER_MS } from './tuning.js'

export function shakeWorld(world, amount) {
  world.shake = Math.min(1, Math.max(world.shake, amount))
}

export function decayShake(world, dt) {
  world.shake = Math.max(0, world.shake - dt * SHAKE_DECAY_PER_MS)
}
