import { STEP_MS } from '../constants.js'

// Steps per frame at most. Time beyond that is dropped, so a long stall (a
// background tab, a debugger pause) never turns into a spiral of catch-up steps.
const MAX_STEPS = 5

// A fixed-timestep loop. Each frame runs step(STEP_MS) zero or more times from
// an accumulator, then render(alpha) once, alpha being the leftover fraction of
// a step. now, requestFrame and cancelFrame are injected (performance.now and
// requestAnimationFrame in the browser).
export function createLoop({ step, render, now, requestFrame, cancelFrame }) {
  // The token of the frame allowed to run; null while stopped. A callback
  // holding any other token is stale and does nothing.
  let live = null
  let frameId = null
  let paused = false
  let last = 0
  let acc = 0

  function schedule() {
    const token = {}
    live = token
    frameId = requestFrame(() => tick(token))
  }

  function tick(token) {
    if (token !== live) return
    frameId = null
    try {
      runFrame(token)
    } catch (err) {
      // A throwing step or render ends the loop rather than leaving it marked
      // as running with no frame queued; start() can then run it again.
      if (token === live) live = null
      throw err
    }
  }

  function runFrame(token) {
    const t = now()
    const dt = Math.max(0, t - last)
    last = t

    // Nothing fills the accumulator while paused.
    if (!paused) acc += dt
    let steps = 0
    // step() may pause the loop (no further steps this frame), or stop or
    // restart it (this frame is then over).
    while (!paused && acc >= STEP_MS && steps < MAX_STEPS) {
      step(STEP_MS)
      if (token !== live) return
      acc -= STEP_MS
      steps++
    }
    // Paused: keep the accumulator empty. Capped: drop the time beyond the cap.
    if (paused || acc >= STEP_MS) acc = 0

    render(acc / STEP_MS)
    if (token !== live) return
    schedule()
  }

  return {
    start() {
      if (live) return
      last = now()
      acc = 0
      schedule()
    },
    stop() {
      if (!live) return
      live = null
      if (frameId !== null) cancelFrame(frameId)
      frameId = null
    },
    pause() {
      paused = true
      acc = 0
    },
    resume() {
      if (!paused) return
      paused = false
      last = now()
    },
    isPaused() {
      return paused
    },
  }
}
