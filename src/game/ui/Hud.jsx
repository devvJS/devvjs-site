import { statusText } from './status.js'

// A screen-reader live region with the game's status, e.g.
// "Level 1: The Editor · Coffee 3/3 · Score 120". The canvas draws the visible HUD.
export default function Hud({ state }) {
  return (
    <p data-testid="tc-status" role="status" aria-live="polite" className="sr-only">
      {statusText(state)}
    </p>
  )
}
