import { useRef } from 'react'

// On-screen buttons for touch devices. Each one holds its action down while touched:
// pointerdown presses it, and pointerup, pointercancel or the finger sliding off releases
// it. The overlay always renders; CSS shows it only where a coarse pointer (a touch
// screen) is present.
const PAD = [
  { label: 'Left', action: 'left', text: '<-' },
  { label: 'Right', action: 'right', text: '->' },
]
const ACTS = [
  { label: 'echo', action: 'echo', text: 'echo' },
  { label: 'sudo', action: 'sudo', text: 'sudo' },
  { label: 'rm -rf', action: 'rmrf', text: 'rm -rf' },
]
const JUMP = { label: 'Jump', action: 'jump', text: 'jump' }
const SYSTEM = [
  { label: 'Pause', action: 'pause', text: '||' },
  { label: 'Mute', action: 'mute', text: 'M' },
]

const BASE =
  'pointer-events-auto touch-none select-none rounded-full border font-mono font-bold backdrop-blur-sm transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan'
// Below 360 px wide everything shrinks a size, so the pads and the actions never meet
// (measured at 320 px in Chromium: the Right pad ends at 112 px, rm -rf starts at 194 px).
const STYLE = {
  pad: `${BASE} h-16 w-16 max-[359px]:h-12 max-[359px]:w-12 border-accent-cyan/60 bg-charcoal/60 text-lg text-accent-cyan active:bg-accent-cyan/25`,
  act: `${BASE} h-12 min-w-12 px-3 max-[359px]:h-10 max-[359px]:min-w-10 max-[359px]:px-2 border-accent-green/60 bg-charcoal/60 text-xs max-[359px]:text-[10px] text-accent-green active:bg-accent-green/25`,
  jump: `${BASE} h-20 w-20 max-[359px]:h-14 max-[359px]:w-14 border-accent-green bg-accent-green/15 text-sm text-accent-green active:bg-accent-green/35`,
  sys: `${BASE} h-10 w-10 border-text-secondary bg-charcoal/60 text-xs text-text-primary active:bg-text-secondary/40`,
}

export default function TouchControls({ input }) {
  // Which actions this overlay is holding, so a stray pointerup never releases a key
  // the keyboard is holding.
  const held = useRef(new Set())

  const bind = ({ label, action, text }, className) => {
    const press = (e) => {
      e.preventDefault()
      // Let the finger slide off (pointerleave) instead of capturing it to this button.
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // Nothing captured: nothing to release.
      }
      if (held.current.has(action)) return
      held.current.add(action)
      input.press(action)
    }
    const release = () => {
      if (!held.current.has(action)) return
      held.current.delete(action)
      input.release(action)
    }
    return (
      <button
        key={action}
        type="button"
        aria-label={label}
        className={className}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        {text}
      </button>
    )
  }

  return (
    <div
      data-testid="tc-touch"
      className="pointer-events-none absolute inset-0 z-20 hidden [@media(any-pointer:coarse)]:block"
    >
      <div className="absolute right-3 top-12 flex gap-2">{SYSTEM.map((b) => bind(b, STYLE.sys))}</div>
      <div className="absolute bottom-5 left-4 flex gap-3 max-[359px]:left-2 max-[359px]:gap-2">{PAD.map((b) => bind(b, STYLE.pad))}</div>
      <div className="absolute bottom-5 right-4 flex items-end gap-3 max-[359px]:right-2 max-[359px]:gap-2">
        <div className="flex flex-col items-end gap-2 max-[359px]:gap-1.5">{ACTS.map((b) => bind(b, STYLE.act))}</div>
        {bind(JUMP, STYLE.jump)}
      </div>
    </div>
  )
}
