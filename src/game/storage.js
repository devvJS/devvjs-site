// The game's storage port ({ get, set }) over window.localStorage. Storage may be
// missing, blocked (a SecurityError just from touching window.localStorage), full or
// in private mode: every access is guarded, a failed read is null and a failed write
// is dropped, so the game always runs.
function store() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const localStorageAdapter = Object.freeze({
  get(key) {
    try {
      const s = store()
      return s ? s.getItem(key) : null
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      store()?.setItem(key, String(value))
    } catch {
      // Not persisted this time; the game keeps the value in memory.
    }
  },
})
