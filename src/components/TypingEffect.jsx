import { useEffect, useMemo, useState } from 'react'

function TypingEffect({
  strings,
  typeSpeed = 80,
  deleteSpeed = 40,
  pauseAfterType = 1400,
  pauseAfterDelete = 400,
  cursor = '█',
  className = '',
  cursorClassName = '',
}) {
  const phrases = useMemo(
    () => (Array.isArray(strings) ? strings : [strings]),
    [strings],
  )
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState('typing')
  const [cursorOn, setCursorOn] = useState(true)

  useEffect(() => {
    if (phrases.length === 0) return
    const current = phrases[phraseIndex % phrases.length]

    let delay
    if (phase === 'typing') {
      if (text.length < current.length) {
        delay = typeSpeed
      } else {
        delay = pauseAfterType
      }
    } else if (phase === 'pausing-full') {
      delay = pauseAfterType
    } else if (phase === 'deleting') {
      delay = deleteSpeed
    } else {
      delay = pauseAfterDelete
    }

    const timer = setTimeout(() => {
      if (phase === 'typing') {
        if (text.length < current.length) {
          setText(current.slice(0, text.length + 1))
        } else if (phrases.length > 1) {
          setPhase('deleting')
        }
      } else if (phase === 'deleting') {
        if (text.length > 0) {
          setText(current.slice(0, text.length - 1))
        } else {
          setPhraseIndex((i) => (i + 1) % phrases.length)
          setPhase('typing')
        }
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [text, phase, phraseIndex, phrases, typeSpeed, deleteSpeed, pauseAfterType, pauseAfterDelete])

  useEffect(() => {
    const blink = setInterval(() => setCursorOn((c) => !c), 500)
    return () => clearInterval(blink)
  }, [])

  return (
    <span className={className} aria-live="polite">
      <span>{text}</span>
      <span
        className={cursorClassName}
        aria-hidden="true"
        style={{ opacity: cursorOn ? 1 : 0 }}
      >
        {cursor}
      </span>
    </span>
  )
}

export default TypingEffect