import { useEffect } from 'react'
import GameView from '../game/ui/GameView.jsx'
import { createGame } from '../game/game.js'
import { LEVELS } from '../game/levels/index.js'
import { createWorld, stepWorld } from '../game/world/index.js'
import { localStorageAdapter } from '../game/storage.js'

const TITLE = "Devv's Terminal Chaos · devvJS"

const makeGame = () => createGame({ levels: LEVELS, createWorld, stepWorld, storage: localStorageAdapter })

// The /terminal-chaos page: the whole viewport is the game. Loaded as its own chunk.
function TerminalChaos() {
  useEffect(() => {
    const previous = document.title
    document.title = TITLE
    return () => {
      document.title = previous
    }
  }, [])

  return <GameView makeGame={makeGame} AudioContextCtor={window.AudioContext || window.webkitAudioContext} />
}

export default TerminalChaos
