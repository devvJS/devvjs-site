import { ACTIONS } from '../constants.js'

const KNOWN_ACTIONS = new Set(ACTIONS)

function checkAction(action) {
  if (!KNOWN_ACTIONS.has(action)) throw new Error(`Unknown input action: ${String(action)}`)
}

// Action state from any source (keyboard, touch buttons). frame() is called
// once per simulation step: `held` is what is down now, `pressed` is what went
// from up to down since the previous frame() (a tap between frames still counts).
export function createInput() {
  const down = new Set()
  let edges = new Set()

  return {
    press(action) {
      checkAction(action)
      if (down.has(action)) return
      down.add(action)
      edges.add(action)
    },
    release(action) {
      checkAction(action)
      down.delete(action)
    },
    releaseAll() {
      down.clear()
    },
    frame() {
      const snapshot = { held: new Set(down), pressed: edges }
      edges = new Set()
      return snapshot
    },
  }
}

// KeyboardEvent.code -> action.
export const keyMap = Object.freeze({
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',
  KeyJ: 'echo',
  KeyX: 'echo',
  KeyK: 'sudo',
  KeyC: 'sudo',
  KeyL: 'rmrf',
  KeyV: 'rmrf',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  Enter: 'start',
})

function actionFor(code) {
  return Object.hasOwn(keyMap, code) ? keyMap[code] : null
}

// Feeds key events from `target` (usually window) into `input`. Mapped keys
// have their default prevented, so Space and the arrows don't scroll the page.
// Chords with Ctrl, Alt or Meta are left to the browser (Ctrl+L, Cmd+C...).
// Returns a function that removes the listeners.
export function bindKeyboard(target, input) {
  const onKeyDown = (e) => {
    const action = actionFor(e.code)
    if (!action || e.ctrlKey || e.altKey || e.metaKey) return
    e.preventDefault()
    if (e.repeat) return
    input.press(action)
  }
  const onKeyUp = (e) => {
    const action = actionFor(e.code)
    if (action) input.release(action)
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
  }
}
