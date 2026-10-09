// Injectable doubles for createLoop: a manual clock plus requestFrame/cancelFrame.
export function createFrameClock(start = 1000) {
  let t = start
  let nextId = 1
  let pending = null // { id, cb }
  const cancelled = []
  const requested = []
  return {
    now: () => t,
    requestFrame(cb) {
      const id = nextId++
      pending = { id, cb }
      requested.push(id)
      return id
    },
    cancelFrame(id) {
      cancelled.push(id)
      if (pending && pending.id === id) pending = null
    },
    cancelled,
    requested,
    hasPending: () => pending !== null,
    pendingId: () => pending?.id ?? null,
    // Move time forward and run the pending frame callback, if any.
    advance(ms) {
      t += ms
      const p = pending
      if (!p) return false
      pending = null
      p.cb(t)
      return true
    },
    // Run a callback captured earlier even though it was cancelled.
    capturePending: () => pending,
    time: () => t,
  }
}
