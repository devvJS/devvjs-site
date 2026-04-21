import { useEffect, useState } from 'react'

const NAME = 'devvJS'
const TYPE_SPEED = 90      // ms per character
const HOLD_AFTER = 600     // ms to hold the full name before fade
const FADE_DURATION = 400  // ms for fade-out

function LoadingScreen({ onComplete }) {
  const [typed, setTyped] = useState('')
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (typed.length < NAME.length) {
      const timer = setTimeout(() => {
        setTyped(NAME.slice(0, typed.length + 1))
      }, TYPE_SPEED)
      return () => clearTimeout(timer)
    }
    // Name fully typed — hold, then fade
    const holdTimer = setTimeout(() => {
      setFading(true)
      const fadeTimer = setTimeout(() => {
        onComplete?.()
      }, FADE_DURATION)
      return () => clearTimeout(fadeTimer)
    }, HOLD_AFTER)
    return () => clearTimeout(holdTimer)
  }, [typed, onComplete])

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-charcoal transition-opacity duration-400 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden={fading}
    >
      <div className="font-mono text-5xl sm:text-6xl md:text-7xl font-bold flex items-center">
        <span className="text-accent-green">{'{'}</span>
        <span className="text-text-primary px-1">{typed}</span>
        <span className="animate-pulse text-accent-green">█</span>
        <span className="text-accent-green">{'}'}</span>
      </div>
    </div>
  )
}

export default LoadingScreen