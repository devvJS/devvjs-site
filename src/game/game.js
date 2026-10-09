// Game progression: screens, levels, score, time, deaths, powers carried
// between levels, the best run and the mute choice. The world simulation is
// injected (createWorld, stepWorld), so this module only drives it.
//
// Screens: title -> playing <-> paused -> level-complete -> playing ... -> victory -> title.
// Only pressed edges (frameInput.pressed) trigger start, pause and mute; held keys never do.

const MUTED_KEY = 'tc:muted'
const BEST_KEY = 'tc:best'

const noPowers = () => ({ echo: false, sudo: false, rmrf: false })

// Storage may be missing or throw (private mode, quota, disabled). Every access
// is guarded, and the game keeps working from memory.
function safeGet(storage, key) {
  try {
    return storage ? (storage.get(key) ?? null) : null
  } catch {
    return null
  }
}

function safeSet(storage, key, value) {
  try {
    if (storage) storage.set(key, value)
  } catch {
    // Not persisted; the in-memory state already holds the value.
  }
}

function readBest(storage) {
  const raw = safeGet(storage, BEST_KEY)
  if (typeof raw !== 'string') return null
  try {
    const best = JSON.parse(raw)
    if (best && Number.isFinite(best.score) && Number.isFinite(best.timeMs)) {
      return { score: best.score, timeMs: best.timeMs }
    }
  } catch {
    // Corrupt value: treat it as no best.
  }
  return null
}

// A higher score wins; on an equal score, a strictly lower time wins.
function isBetter(run, best) {
  if (!best) return true
  if (run.score !== best.score) return run.score > best.score
  return run.timeMs < best.timeMs
}

export function createGame({ levels, createWorld, stepWorld, storage }) {
  if (!Array.isArray(levels) || levels.length === 0) throw new Error('createGame: levels must be a non-empty array')
  if (typeof createWorld !== 'function' || typeof stepWorld !== 'function') {
    throw new Error('createGame: createWorld and stepWorld must be functions')
  }

  const state = {
    screen: 'title',
    levelIndex: 0,
    score: 0,
    timeMs: 0,
    deaths: 0,
    powers: noPowers(),
    muted: safeGet(storage, MUTED_KEY) !== 'false',
    best: readBest(storage),
    world: null,
  }

  const lastIndex = levels.length - 1

  function enterLevel(index) {
    state.levelIndex = index
    state.world = createWorld(levels[index], { powers: { ...state.powers } })
    state.screen = 'playing'
  }

  function resetRun() {
    state.screen = 'title'
    state.levelIndex = 0
    state.score = 0
    state.timeMs = 0
    state.deaths = 0
    state.powers = noPowers()
    state.world = null
  }

  // Applies one world event to the run. Returns the screen it moves to, or null.
  function applyWorldEvent(event) {
    switch (event.type) {
      case 'collect':
      case 'kill':
        if (Number.isFinite(event.score)) state.score += event.score
        return null
      case 'died':
        state.deaths += 1
        return null
      case 'power-unlocked':
        if (Object.hasOwn(state.powers, event.power)) state.powers[event.power] = true
        return null
      case 'level-complete':
        return state.levelIndex >= lastIndex ? 'victory' : 'level-complete'
      case 'boss-defeated':
        return state.levelIndex >= lastIndex ? 'victory' : null
      default:
        return null
    }
  }

  // Steps the world one frame and returns its events plus the game's own.
  function playFrame(frameInput, dt) {
    const worldEvents = stepWorld(state.world, frameInput, dt) ?? []
    state.timeMs += dt
    const out = [...worldEvents]
    let next = null
    for (const event of worldEvents) {
      const screen = applyWorldEvent(event)
      // The first screen change of the frame wins; one screen event per frame.
      if (screen && !next) next = screen
    }
    if (next) {
      state.screen = next
      out.push({ type: 'screen', screen: next })
      if (next === 'victory') {
        const run = { score: state.score, timeMs: state.timeMs }
        if (isBetter(run, state.best)) {
          state.best = run
          safeSet(storage, BEST_KEY, JSON.stringify(run))
          out.push({ type: 'new-best' })
        }
      }
    }
    return out
  }

  function update(frameInput, dt) {
    const pressed = frameInput?.pressed ?? new Set()
    let events = []

    switch (state.screen) {
      case 'title':
        if (pressed.has('start')) {
          enterLevel(0)
          events.push({ type: 'screen', screen: 'playing' })
        }
        break
      case 'playing':
        if (pressed.has('pause')) {
          state.screen = 'paused'
          events.push({ type: 'screen', screen: 'paused' })
        } else {
          events = playFrame(frameInput, dt)
        }
        break
      case 'paused':
        if (pressed.has('pause')) {
          state.screen = 'playing'
          events.push({ type: 'screen', screen: 'playing' })
        }
        break
      case 'level-complete':
        if (pressed.has('start')) {
          enterLevel(state.levelIndex + 1)
          events.push({ type: 'screen', screen: 'playing' })
        }
        break
      case 'victory':
        if (pressed.has('start')) {
          resetRun()
          events.push({ type: 'screen', screen: 'title' })
        }
        break
    }

    // Mute works on every screen and always comes last.
    if (pressed.has('mute')) {
      state.muted = !state.muted
      safeSet(storage, MUTED_KEY, state.muted ? 'true' : 'false')
      events.push({ type: 'mute', muted: state.muted })
    }

    return events
  }

  return { state, update }
}
