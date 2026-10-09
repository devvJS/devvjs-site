import { useEffect, useRef, useState } from 'react'
import { VIEW_W, VIEW_H } from '../constants.js'
import { createInput, bindKeyboard } from '../engine/input.js'
import { createLoop } from '../engine/loop.js'
import { createRenderer } from '../render/renderer.js'
import { createAudio } from '../audio/chiptune.js'
import Hud from './Hud.jsx'
import TouchControls from './TouchControls.jsx'
import { statusText } from './status.js'

const defaultNow = () => performance.now()
const defaultRequestFrame = (cb) => requestAnimationFrame(cb)
const defaultCancelFrame = (id) => cancelAnimationFrame(id)

// The largest whole-number scale at which 320x180 fits the window (at least 1).
function fitScale() {
  const w = window.innerWidth || VIEW_W
  const h = window.innerHeight || VIEW_H
  return Math.max(1, Math.floor(Math.min(w / VIEW_W, h / VIEW_H)))
}

// Gestures that may unlock (or re-resume) WebAudio. Touch browsers only grant audio
// on some of these, so every one of them retries; unlock() is idempotent.
const GESTURES = ['keydown', 'pointerdown', 'pointerup', 'touchend']

// A canvas tap counts as Enter where the screen waits for one, and resumes a pause.
const TAP_ACTION = { title: 'start', 'level-complete': 'start', victory: 'start', paused: 'pause' }

// Keys typed into a text field, or Enter/Space on a link or button, belong to that
// control: the game neither sees them nor prevents their default action.
const TEXT_FIELDS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
const CONTROLS = 'a[href], button, summary, [role="button"], [role="link"]'
function ownedByControl(e) {
  const el = e.target
  if (!el || typeof el.closest !== 'function') return false
  if (el.closest(TEXT_FIELDS)) return true
  return (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') && Boolean(el.closest(CONTROLS))
}

// Window keyboard events for bindKeyboard, minus the keydowns a focused control owns.
// Keyups always pass, so a key held before focus moved is still released.
function gameKeys() {
  const wrapped = new Map()
  return {
    addEventListener(type, fn, opts) {
      const w = type === 'keydown' ? (e) => (ownedByControl(e) ? undefined : fn(e)) : fn
      wrapped.set(fn, w)
      window.addEventListener(type, w, opts)
    },
    removeEventListener(type, fn, opts) {
      window.removeEventListener(type, wrapped.get(fn) ?? fn, opts)
      wrapped.delete(fn)
    },
  }
}

const LINK =
  'pointer-events-auto rounded border border-accent-cyan/40 bg-charcoal/70 px-2 py-1 text-accent-cyan ' +
  'hover:border-accent-cyan hover:bg-accent-cyan/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-cyan'
const CORNER = 'absolute bottom-2 z-30 text-xs opacity-70 hover:opacity-100 focus-visible:opacity-100'

// The game page body: a pixelated, integer-scaled canvas plus the DOM around it.
// makeGame() returns { state, update }. now/requestFrame/cancelFrame drive the loop.
export default function GameView({
  makeGame,
  AudioContextCtor,
  now = defaultNow,
  requestFrame = defaultRequestFrame,
  cancelFrame = defaultCancelFrame,
}) {
  const canvasRef = useRef(null)
  const [input] = useState(createInput)
  const [game] = useState(() => makeGame())
  const [env] = useState(() => ({ AudioContextCtor, now, requestFrame, cancelFrame }))
  const [scale, setScale] = useState(fitScale)
  // What the DOM shows; refreshed after a frame when the status line or mute changes.
  const [view, setView] = useState(() => ({ state: game.state, muted: game.state?.muted !== false }))

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    const renderer = ctx ? createRenderer(ctx) : null
    const audio = createAudio(env.AudioContextCtor)
    let muted = game.state?.muted !== false
    audio.setMuted(muted)

    let shown = null
    const publish = () => {
      const s = game.state
      const key = `${statusText(s)}|${muted}|${s?.screen}`
      if (key === shown) return
      shown = key
      setView({ state: s, muted })
    }

    const route = (events) => {
      if (!Array.isArray(events)) return
      for (const ev of events) {
        if (ev?.type === 'sfx') audio.sfx(ev.name)
        else if (ev?.type === 'mute') {
          muted = Boolean(ev.muted)
          audio.setMuted(muted)
        } else if (ev?.type === 'screen') {
          // Level music while playing (each level's world has its theme); quiet otherwise.
          audio.music(ev.screen === 'playing' ? (game.state?.world?.theme ?? null) : null)
        }
      }
    }

    const loop = createLoop({
      step: (dt) => route(game.update(input.frame(), dt)),
      render: (alpha) => {
        renderer?.draw(game.state, alpha)
        publish()
      },
      now: env.now,
      requestFrame: env.requestFrame,
      cancelFrame: env.cancelFrame,
    })

    const unbindKeys = bindKeyboard(gameKeys(), input)
    const unlock = () => audio.unlock()
    for (const type of GESTURES) window.addEventListener(type, unlock, true)

    // Losing focus or hiding the tab lets go of every key and pauses a running game.
    const autoPause = () => {
      input.releaseAll()
      if (game.state?.screen === 'playing') {
        input.press('pause')
        input.release('pause')
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') autoPause()
    }
    const onResize = () => setScale(fitScale())
    window.addEventListener('blur', autoPause)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', onResize)

    loop.start()
    return () => {
      loop.stop()
      unbindKeys()
      for (const type of GESTURES) window.removeEventListener(type, unlock, true)
      window.removeEventListener('blur', autoPause)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
      input.releaseAll()
      audio.close()
    }
  }, [game, input, env])

  const tap = (action) => {
    input.press(action)
    input.release(action)
  }
  const onCanvasDown = () => {
    const action = TAP_ACTION[game.state?.screen]
    if (action) tap(action)
  }

  const screen = view.state?.screen
  return (
    <div
      data-testid="terminal-chaos"
      className="fixed inset-0 z-50 flex select-none items-center justify-center overflow-hidden bg-charcoal font-mono text-text-primary"
    >
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        role="img"
        aria-label="Devv's Terminal Chaos"
        className="block touch-none shadow-[0_0_48px_rgba(57,255,20,0.10)]"
        style={{ width: `${scale * VIEW_W}px`, height: `${scale * VIEW_H}px`, imageRendering: 'pixelated' }}
        onPointerDown={onCanvasDown}
      />

      {/* Bottom corners, over the floor rather than the HUD. On touch screens the pads
          take the bottom, so the link moves up and the pads' own Mute replaces the toggle. */}
      <a
        href="/"
        className={`${LINK} ${CORNER} left-2 [@media(any-pointer:coarse)]:bottom-auto [@media(any-pointer:coarse)]:top-2`}
      >
        {'<- Back to devvjs.dev'}
      </a>
      <button
        type="button"
        aria-label="Toggle sound"
        aria-pressed={!view.muted}
        className={`${LINK} ${CORNER} right-2 [@media(any-pointer:coarse)]:hidden`}
        onClick={(e) => {
          tap('mute')
          // A mouse click shouldn't leave focus here, or Space would toggle it again.
          if (e.detail > 0) e.currentTarget.blur()
        }}
      >
        {view.muted ? 'sound: off [M]' : 'sound: on [M]'}
      </button>

      {screen === 'victory' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center gap-3 text-sm">
          <button type="button" className={LINK} onClick={() => tap('start')}>
            Play again
          </button>
          <a href="/" className={LINK}>
            Go home
          </a>
        </div>
      )}

      <Hud state={view.state} />
      <TouchControls input={input} />
    </div>
  )
}
