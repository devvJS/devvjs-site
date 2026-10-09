// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { loadSrc, makeState, makeWorld, makePlayer } from '../helpers/s3-fixtures.js'

// Pinned: default export, prop `state` (game.state), no other props. The level name comes
// from world.theme: editor "The Editor", ci "The CI Pipeline", prod "Production",
// boss "The Product Manager"; the number is levelIndex + 1. Text is compared exactly.
afterEach(cleanup)

async function status(state) {
  const { default: Hud } = await loadSrc('game/ui/Hud.jsx')
  render(<Hud state={state} />)
  return screen.getByTestId('tc-status')
}

const playing = (theme, levelIndex, coffee, score, extra = {}) =>
  makeState('playing', { levelIndex, score, world: makeWorld({ theme, player: makePlayer({ coffee }) }), ...extra })

describe('Hud', () => {
  it('is a polite live region', async () => {
    const el = await status(playing('editor', 0, 3, 120))
    expect(el.getAttribute('aria-live')).toBe('polite')
  })

  it('says the level, coffee and score while playing', async () => {
    const el = await status(playing('editor', 0, 3, 120))
    expect(el.textContent.trim()).toBe('Level 1: The Editor · Coffee 3/3 · Score 120')
  })

  it.each([
    ['ci', 1, 'Level 2: The CI Pipeline'],
    ['prod', 2, 'Level 3: Production'],
    ['boss', 3, 'Level 4: The Product Manager'],
  ])('names the %s level', async (theme, idx, head) => {
    const el = await status(playing(theme, idx, 1, 4500))
    expect(el.textContent.trim()).toBe(`${head} · Coffee 1/3 · Score 4500`)
  })

  it('says Paused with the level, coffee and score when paused', async () => {
    const el = await status(makeState('paused', { score: 120, world: makeWorld({ player: makePlayer({ coffee: 2 }) }) }))
    expect(el.textContent.trim()).toBe('Paused · Level 1: The Editor · Coffee 2/3 · Score 120')
  })

  it('says how to start on the title screen', async () => {
    const el = await status(makeState('title'))
    expect(el.textContent.trim()).toBe("Devv's Terminal Chaos · Press Enter / Tap to start")
  })

  it('announces level complete', async () => {
    const el = await status(makeState('level-complete', { levelIndex: 1, score: 300 }))
    expect(el.textContent.trim()).toBe('Level 2 complete · Score 300 · Press Enter / Tap to continue')
  })

  it('announces the victory', async () => {
    const el = await status(makeState('victory', { levelIndex: 3, score: 900, deaths: 2 }))
    expect(el.textContent.trim()).toBe('Shipped. CodeSpace saved. · Score 900 · Deaths 2')
  })
})
