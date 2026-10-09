// The one-line status that Hud announces, built from game.state. Kept apart from the
// components so GameView can tell cheaply when it changed.
import { MAX_COFFEE } from '../constants.js'
import { LEVEL_NAMES, levelNumber, themeOf } from '../render/themes.js'

const SEP = ' · '

function levelLine(state) {
  const coffee = state.world?.player?.coffee ?? MAX_COFFEE
  return [`Level ${levelNumber(state)}: ${LEVEL_NAMES[themeOf(state)]}`, `Coffee ${coffee}/${MAX_COFFEE}`, `Score ${state.score ?? 0}`].join(SEP)
}

export function statusText(state) {
  switch (state?.screen) {
    case 'title':
      return ["Devv's Terminal Chaos", 'Press Enter / Tap to start'].join(SEP)
    case 'playing':
      return levelLine(state)
    case 'paused':
      return `Paused${SEP}${levelLine(state)}`
    case 'level-complete':
      return [`Level ${levelNumber(state)} complete`, `Score ${state.score ?? 0}`, 'Press Enter / Tap to continue'].join(SEP)
    case 'victory':
      return ['Shipped. CodeSpace saved.', `Score ${state.score ?? 0}`, `Deaths ${state.deaths ?? 0}`].join(SEP)
    default:
      return ''
  }
}
