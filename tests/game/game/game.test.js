import { describe, it, expect } from 'vitest'
import { createGame } from '../../../src/game/game.js'
import { fakeLevels, fakeStorage, throwingStorage, fakeEngine, frame, NO_POWERS } from '../helpers/s2-game-doubles.js'

const DT = 1000 / 60

function setup({ levels = fakeLevels(3), storage = fakeStorage() } = {}) {
  const engine = fakeEngine()
  const game = createGame({ levels, createWorld: engine.createWorld, stepWorld: engine.stepWorld, storage })
  const start = () => game.update(frame(['start']), DT)
  return { game, engine, storage, levels, start }
}

// Plays level `index` to completion with the scripted world events.
function playToLevelComplete(ctx, extra = []) {
  ctx.engine.queue([...extra, { type: 'level-complete' }])
  return ctx.game.update(frame(), DT)
}

describe('initial state', () => {
  it('starts on the title screen with zeroed progress', () => {
    const { game } = setup()
    expect(game.state).toMatchObject({
      screen: 'title',
      levelIndex: 0,
      score: 0,
      timeMs: 0,
      deaths: 0,
      powers: NO_POWERS,
      best: null,
    })
  })

  it('is muted by default and reads storage keys tc:muted and tc:best', () => {
    const { game, storage } = setup()
    expect(game.state.muted).toBe(true)
    expect(storage.get).toHaveBeenCalledWith('tc:muted')
    expect(storage.get).toHaveBeenCalledWith('tc:best')
  })

  it('reads a stored unmuted choice', () => {
    expect(setup({ storage: fakeStorage({ 'tc:muted': 'false' }) }).game.state.muted).toBe(false)
  })

  it('reads a stored muted choice', () => {
    expect(setup({ storage: fakeStorage({ 'tc:muted': 'true' }) }).game.state.muted).toBe(true)
  })

  it('reads the stored best from JSON', () => {
    const { game } = setup({ storage: fakeStorage({ 'tc:best': JSON.stringify({ score: 420, timeMs: 90000 }) }) })
    expect(game.state.best).toEqual({ score: 420, timeMs: 90000 })
  })

  it('treats bad JSON in tc:best as no best', () => {
    expect(setup({ storage: fakeStorage({ 'tc:best': '{nope' }) }).game.state.best).toBeNull()
  })

  it.each([
    ['a number', '42'],
    ['an array', '[]'],
    ['a non-numeric score', '{"score":"x","timeMs":1}'],
    ['null', 'null'],
    ['a missing timeMs', '{"score":1}'],
  ])('treats tc:best holding %s as no best', (_label, raw) => {
    expect(setup({ storage: fakeStorage({ 'tc:best': raw }) }).game.state.best).toBeNull()
  })

  it('does not step or advance time on the title screen', () => {
    const { game, engine } = setup()
    expect(game.update(frame(), DT)).toEqual([])
    expect(engine.stepWorld).not.toHaveBeenCalled()
    expect(engine.createWorld).not.toHaveBeenCalled()
    expect(game.state.timeMs).toBe(0)
  })
})

describe('title and start', () => {
  it('start creates the world for level 0 with no powers and emits a screen event', () => {
    const { game, engine, levels, start } = setup()
    const events = start()
    expect(engine.createWorld).toHaveBeenCalledTimes(1)
    expect(engine.createWorld.mock.calls[0][0]).toBe(levels[0])
    expect(engine.createWorld.mock.calls[0][1]).toMatchObject({ powers: NO_POWERS })
    expect(events).toEqual([{ type: 'screen', screen: 'playing' }])
    expect(game.state.screen).toBe('playing')
    expect(game.state.levelIndex).toBe(0)
    expect(game.state.world).toBe(engine.created[0])
  })

  it('passes createWorld a copy of the powers, not state.powers', () => {
    const { game, engine, start } = setup()
    start()
    const given = engine.createWorld.mock.calls[0][1].powers
    expect(given).not.toBe(game.state.powers)
    given.echo = true
    expect(game.state.powers).toEqual(NO_POWERS)
  })

  it('ignores other input on the title screen', () => {
    const { game, engine } = setup()
    expect(game.update(frame(['jump', 'echo', 'pause']), DT)).toEqual([])
    expect(game.state.screen).toBe('title')
    expect(engine.createWorld).not.toHaveBeenCalled()
  })

  it('a held start without a pressed edge does not start', () => {
    const { game } = setup()
    game.update(frame([], ['start']), DT)
    expect(game.state.screen).toBe('title')
  })
})

describe('playing', () => {
  it('steps the world with the frame input and dt, and passes its events through', () => {
    const ctx = setup()
    ctx.start()
    const input = frame([], ['right'])
    const events = [{ type: 'sfx', name: 'jump' }, { type: 'hurt', coffee: 2 }]
    ctx.engine.queue(events)
    const out = ctx.game.update(input, 20)
    expect(ctx.engine.stepWorld).toHaveBeenCalledTimes(1)
    const [world, passedInput, dt] = ctx.engine.stepWorld.mock.calls[0]
    expect(world).toBe(ctx.engine.created[0])
    expect(passedInput).toBe(input)
    expect(dt).toBe(20)
    expect(out).toEqual(events)
  })

  it('adds dt to timeMs every playing frame', () => {
    const ctx = setup()
    ctx.start()
    expect(ctx.game.state.timeMs).toBe(0)
    ctx.game.update(frame(), 16)
    ctx.game.update(frame(), 17)
    ctx.game.update(frame(), 5)
    expect(ctx.game.state.timeMs).toBe(38)
  })

  it('adds event.score from collect and kill events only', () => {
    const ctx = setup()
    ctx.start()
    ctx.engine.queue([
      { type: 'collect', label: ';', score: 10 },
      { type: 'kill', kind: 'bug', score: 25 },
      { type: 'hurt', coffee: 2, score: 999 },
      { type: 'sfx', name: 'kill' },
    ])
    ctx.game.update(frame(), DT)
    expect(ctx.game.state.score).toBe(35)
    ctx.engine.queue([{ type: 'collect', label: '=>', score: 10 }])
    ctx.game.update(frame(), DT)
    expect(ctx.game.state.score).toBe(45)
  })

  it('counts a death per died event', () => {
    const ctx = setup()
    ctx.start()
    ctx.engine.queue([{ type: 'died' }, { type: 'respawn' }])
    ctx.game.update(frame(), DT)
    ctx.engine.queue([{ type: 'died' }])
    ctx.game.update(frame(), DT)
    expect(ctx.game.state.deaths).toBe(2)
    expect(ctx.game.state.screen).toBe('playing')
  })

  it('ignores start while playing but still steps the world', () => {
    const ctx = setup()
    ctx.start()
    ctx.game.update(frame(['start']), DT)
    expect(ctx.game.state.screen).toBe('playing')
    expect(ctx.engine.createWorld).toHaveBeenCalledTimes(1)
    expect(ctx.engine.stepWorld).toHaveBeenCalledTimes(1)
  })
})

describe('pause', () => {
  it('toggles paused and playing with screen events, without stepping the world', () => {
    const ctx = setup()
    ctx.start()
    expect(ctx.game.update(frame(['pause']), DT)).toEqual([{ type: 'screen', screen: 'paused' }])
    expect(ctx.game.state.screen).toBe('paused')
    expect(ctx.game.update(frame(['pause']), DT)).toEqual([{ type: 'screen', screen: 'playing' }])
    expect(ctx.game.state.screen).toBe('playing')
    expect(ctx.engine.stepWorld).not.toHaveBeenCalled()
    expect(ctx.game.state.timeMs).toBe(0)
  })

  it('freezes everything while paused and ignores other input', () => {
    const ctx = setup()
    ctx.start()
    ctx.game.update(frame(), 10)
    ctx.game.update(frame(['pause']), DT)
    ctx.engine.queue([{ type: 'collect', label: ';', score: 10 }])
    for (let i = 0; i < 5; i++) {
      expect(ctx.game.update(frame(['jump', 'echo', 'start', 'sudo'], ['left', 'jump']), 16)).toEqual([])
    }
    expect(ctx.engine.stepWorld).toHaveBeenCalledTimes(1)
    expect(ctx.game.state.timeMs).toBe(10)
    expect(ctx.game.state.score).toBe(0)
    expect(ctx.game.state.screen).toBe('paused')
    ctx.game.update(frame(['pause']), DT)
    ctx.game.update(frame(), 10)
    expect(ctx.engine.stepWorld).toHaveBeenCalledTimes(2)
    expect(ctx.game.state.timeMs).toBe(20)
  })

  it('a held pause does not retrigger on later frames', () => {
    const ctx = setup()
    ctx.start()
    ctx.game.update(frame(['pause']), DT)
    for (let i = 0; i < 4; i++) ctx.game.update(frame([], ['pause']), DT)
    expect(ctx.game.state.screen).toBe('paused')
  })

  it('ignores pause on the title screen', () => {
    const { game } = setup()
    expect(game.update(frame(['pause']), DT)).toEqual([])
    expect(game.state.screen).toBe('title')
  })
})

describe('levels and powers', () => {
  it('level-complete moves to the level-complete screen and keeps the world frozen', () => {
    const ctx = setup()
    ctx.start()
    const events = playToLevelComplete(ctx)
    expect(events).toEqual([{ type: 'level-complete' }, { type: 'screen', screen: 'level-complete' }])
    expect(ctx.game.state.screen).toBe('level-complete')
    expect(ctx.game.state.levelIndex).toBe(0)
    const t = ctx.game.state.timeMs
    expect(ctx.game.update(frame(['jump', 'pause']), DT)).toEqual([])
    expect(ctx.game.state.screen).toBe('level-complete')
    expect(ctx.game.state.timeMs).toBe(t)
    expect(ctx.engine.stepWorld).toHaveBeenCalledTimes(1)
  })

  it('power-unlocked adds to state.powers', () => {
    const ctx = setup()
    ctx.start()
    ctx.engine.queue([{ type: 'power-unlocked', power: 'echo' }])
    ctx.game.update(frame(), DT)
    expect(ctx.game.state.powers).toEqual({ echo: true, sudo: false, rmrf: false })
  })

  it('start on level-complete creates the next level with the accumulated powers', () => {
    const ctx = setup()
    ctx.start()
    playToLevelComplete(ctx, [{ type: 'power-unlocked', power: 'echo' }])
    const events = ctx.start()
    expect(events).toEqual([{ type: 'screen', screen: 'playing' }])
    expect(ctx.game.state.screen).toBe('playing')
    expect(ctx.game.state.levelIndex).toBe(1)
    expect(ctx.engine.createWorld).toHaveBeenCalledTimes(2)
    expect(ctx.engine.createWorld.mock.calls[1][0]).toBe(ctx.levels[1])
    expect(ctx.engine.created[1].powers).toEqual({ echo: true, sudo: false, rmrf: false })
    expect(ctx.game.state.world).toBe(ctx.engine.created[1])

    playToLevelComplete(ctx, [{ type: 'power-unlocked', power: 'sudo' }])
    ctx.start()
    expect(ctx.game.state.levelIndex).toBe(2)
    expect(ctx.engine.created[2].powers).toEqual({ echo: true, sudo: true, rmrf: false })
  })

  it('keeps score, time and deaths across levels', () => {
    const ctx = setup()
    ctx.start()
    ctx.engine.queue([{ type: 'collect', label: ';', score: 10 }, { type: 'died' }, { type: 'level-complete' }])
    ctx.game.update(frame(), 100)
    ctx.start()
    ctx.game.update(frame(), 50)
    expect(ctx.game.state).toMatchObject({ score: 10, deaths: 1, timeMs: 150, levelIndex: 1 })
  })

  it('level-complete on the last level goes to victory, not level-complete', () => {
    const ctx = setup({ levels: fakeLevels(2) })
    ctx.start()
    playToLevelComplete(ctx)
    ctx.start()
    const events = playToLevelComplete(ctx)
    expect(events.filter((e) => e.type === 'screen')).toEqual([{ type: 'screen', screen: 'victory' }])
    expect(ctx.game.state.screen).toBe('victory')
  })

  it('boss-defeated on the last level goes to victory', () => {
    const ctx = setup({ levels: fakeLevels(2) })
    ctx.start()
    playToLevelComplete(ctx)
    ctx.start()
    ctx.engine.queue([{ type: 'boss-defeated' }])
    const events = ctx.game.update(frame(), DT)
    expect(events[0]).toEqual({ type: 'boss-defeated' })
    expect(events.filter((e) => e.type === 'screen')).toEqual([{ type: 'screen', screen: 'victory' }])
    expect(ctx.game.state.screen).toBe('victory')
  })
})

function playToVictory(ctx, { score, timeMs }) {
  ctx.start()
  ctx.engine.queue([{ type: 'collect', label: ';', score }, { type: 'boss-defeated' }])
  return ctx.game.update(frame(), timeMs)
}

describe('victory and best', () => {
  const bestOf = (storage) => JSON.parse(storage.map.get('tc:best'))

  it('saves the first best, emitting screen then new-best, and writes tc:best', () => {
    const ctx = setup({ levels: fakeLevels(1) })
    const events = playToVictory(ctx, { score: 300, timeMs: 5000 })
    expect(events.map((e) => e.type)).toEqual(['collect', 'boss-defeated', 'screen', 'new-best'])
    expect(ctx.game.state.best).toEqual({ score: 300, timeMs: 5000 })
    expect(bestOf(ctx.storage)).toEqual({ score: 300, timeMs: 5000 })
  })

  it('saves a higher score even when slower', () => {
    const storage = fakeStorage({ 'tc:best': JSON.stringify({ score: 300, timeMs: 5000 }) })
    const ctx = setup({ levels: fakeLevels(1), storage })
    const events = playToVictory(ctx, { score: 400, timeMs: 9000 })
    expect(events).toContainEqual({ type: 'new-best' })
    expect(ctx.game.state.best).toEqual({ score: 400, timeMs: 9000 })
    expect(bestOf(storage)).toEqual({ score: 400, timeMs: 9000 })
  })

  it('saves an equal score with a lower time', () => {
    const storage = fakeStorage({ 'tc:best': JSON.stringify({ score: 300, timeMs: 5000 }) })
    const ctx = setup({ levels: fakeLevels(1), storage })
    const events = playToVictory(ctx, { score: 300, timeMs: 4000 })
    expect(events).toContainEqual({ type: 'new-best' })
    expect(ctx.game.state.best).toEqual({ score: 300, timeMs: 4000 })
    expect(bestOf(storage)).toEqual({ score: 300, timeMs: 4000 })
  })

  it.each([
    ['a lower score and a faster time', 200, 1000],
    ['an equal score and a higher time', 300, 6000],
    ['an equal score and an equal time', 300, 5000],
  ])('does not save %s', (_label, score, timeMs) => {
    const prior = JSON.stringify({ score: 300, timeMs: 5000 })
    const storage = fakeStorage({ 'tc:best': prior })
    const ctx = setup({ levels: fakeLevels(1), storage })
    const events = playToVictory(ctx, { score, timeMs })
    expect(events.some((e) => e.type === 'new-best')).toBe(false)
    expect(ctx.game.state.screen).toBe('victory')
    expect(ctx.game.state.best).toEqual({ score: 300, timeMs: 5000 })
    expect(storage.map.get('tc:best')).toBe(prior)
    expect(storage.set).not.toHaveBeenCalledWith('tc:best', expect.anything())
  })

  it('start on victory returns to title, resetting progress and keeping best and muted', () => {
    const ctx = setup({ levels: fakeLevels(2) })
    ctx.start()
    ctx.engine.queue([
      { type: 'collect', label: ';', score: 50 },
      { type: 'power-unlocked', power: 'echo' },
      { type: 'died' },
      { type: 'level-complete' },
    ])
    ctx.game.update(frame(), 1000)
    ctx.start()
    ctx.engine.queue([{ type: 'boss-defeated' }])
    ctx.game.update(frame(['mute']), 500)
    const mutedBefore = ctx.game.state.muted
    expect(ctx.game.state.screen).toBe('victory')
    const events = ctx.start()
    expect(events).toEqual([{ type: 'screen', screen: 'title' }])
    expect(ctx.game.state).toMatchObject({
      screen: 'title',
      levelIndex: 0,
      score: 0,
      timeMs: 0,
      deaths: 0,
      powers: NO_POWERS,
      best: { score: 50, timeMs: 1500 },
      muted: mutedBefore,
    })
  })

  it('a new run after victory starts level 0 with no powers', () => {
    const ctx = setup({ levels: fakeLevels(2) })
    ctx.start()
    playToLevelComplete(ctx, [{ type: 'power-unlocked', power: 'echo' }])
    ctx.start()
    ctx.engine.queue([{ type: 'boss-defeated' }])
    ctx.game.update(frame(), DT)
    ctx.start() // victory -> title
    ctx.start() // title -> playing
    expect(ctx.engine.createWorld).toHaveBeenCalledTimes(3)
    expect(ctx.engine.createWorld.mock.calls[2][0]).toBe(ctx.levels[0])
    expect(ctx.engine.created[2].powers).toEqual(NO_POWERS)
    expect(ctx.game.state.screen).toBe('playing')
  })

  it('does not step the world or add time on the victory screen', () => {
    const ctx = setup({ levels: fakeLevels(1) })
    playToVictory(ctx, { score: 1, timeMs: 100 })
    const calls = ctx.engine.stepWorld.mock.calls.length
    expect(ctx.game.update(frame(['jump', 'pause']), 500)).toEqual([])
    expect(ctx.engine.stepWorld.mock.calls.length).toBe(calls)
    expect(ctx.game.state.timeMs).toBe(100)
  })
})

describe('mute', () => {
  it.each(['title', 'playing', 'paused', 'level-complete', 'victory'])('toggles on the %s screen and persists', (screen) => {
    const ctx = setup({ levels: fakeLevels(1) })
    if (screen !== 'title') ctx.start()
    if (screen === 'paused') ctx.game.update(frame(['pause']), DT)
    if (screen === 'level-complete') {
      // a one-level game ends in victory, so use two levels
      const two = setup({ levels: fakeLevels(2) })
      two.start()
      playToLevelComplete(two)
      expect(two.game.state.screen).toBe('level-complete')
      const events = two.game.update(frame(['mute']), DT)
      expect(events).toEqual([{ type: 'mute', muted: false }])
      expect(two.storage.map.get('tc:muted')).toBe('false')
      return
    }
    if (screen === 'victory') {
      ctx.engine.queue([{ type: 'boss-defeated' }])
      ctx.game.update(frame(), DT)
      expect(ctx.game.state.screen).toBe('victory')
    }
    expect(ctx.game.state.muted).toBe(true)
    const events = ctx.game.update(frame(['mute']), DT)
    expect(events).toContainEqual({ type: 'mute', muted: false })
    expect(ctx.game.state.muted).toBe(false)
    expect(ctx.storage.map.get('tc:muted')).toBe('false')
    expect(ctx.game.update(frame(['mute']), DT)).toContainEqual({ type: 'mute', muted: true })
    expect(ctx.game.state.muted).toBe(true)
    expect(ctx.storage.map.get('tc:muted')).toBe('true')
  })

  it('on the title screen emits only the mute event', () => {
    const { game } = setup()
    expect(game.update(frame(['mute']), DT)).toEqual([{ type: 'mute', muted: false }])
  })

  it('does not stop the world stepping while playing', () => {
    const ctx = setup()
    ctx.start()
    ctx.engine.queue([{ type: 'sfx', name: 'jump' }])
    const events = ctx.game.update(frame(['mute']), DT)
    expect(ctx.engine.stepWorld).toHaveBeenCalledTimes(1)
    expect(events).toContainEqual({ type: 'sfx', name: 'jump' })
    expect(events).toContainEqual({ type: 'mute', muted: false })
  })

  it('a held mute does not retrigger', () => {
    const { game } = setup()
    game.update(frame(['mute']), DT)
    game.update(frame([], ['mute']), DT)
    game.update(frame([], ['mute']), DT)
    expect(game.state.muted).toBe(false)
  })

  it('starts unmuted from storage and toggles to muted', () => {
    const { game, storage } = setup({ storage: fakeStorage({ 'tc:muted': 'false' }) })
    expect(game.update(frame(['mute']), DT)).toEqual([{ type: 'mute', muted: true }])
    expect(storage.map.get('tc:muted')).toBe('true')
  })
})

describe('one screen change per frame', () => {
  it('level-complete and boss-defeated together on the last level give one screen event and one new-best', () => {
    const ctx = setup({ levels: fakeLevels(1) })
    ctx.start()
    ctx.engine.queue([{ type: 'level-complete' }, { type: 'boss-defeated' }])
    const events = ctx.game.update(frame(), DT)
    expect(events.filter((e) => e.type === 'screen')).toEqual([{ type: 'screen', screen: 'victory' }])
    expect(events.filter((e) => e.type === 'new-best')).toHaveLength(1)
  })
})

describe('storage that throws', () => {
  it('still creates a game with defaults', () => {
    const { game } = setup({ storage: throwingStorage() })
    expect(game.state).toMatchObject({ screen: 'title', muted: true, best: null })
  })

  it('plays a full run, mutes and records a best in memory', () => {
    const ctx = setup({ levels: fakeLevels(2), storage: throwingStorage() })
    expect(ctx.start()).toEqual([{ type: 'screen', screen: 'playing' }])
    ctx.engine.queue([{ type: 'collect', label: ';', score: 10 }, { type: 'power-unlocked', power: 'echo' }])
    ctx.game.update(frame(['pause']), DT)
    ctx.game.update(frame(['pause']), DT)
    ctx.game.update(frame(), 30)
    expect(ctx.game.update(frame(['mute']), DT)).toContainEqual({ type: 'mute', muted: false })
    expect(ctx.game.state.muted).toBe(false)
    playToLevelComplete(ctx)
    ctx.start()
    expect(ctx.engine.created[1].powers).toEqual({ echo: true, sudo: false, rmrf: false })
    ctx.engine.queue([{ type: 'boss-defeated' }])
    const events = ctx.game.update(frame(), DT)
    expect(events).toContainEqual({ type: 'new-best' })
    expect(ctx.game.state.screen).toBe('victory')
    expect(ctx.game.state.best).toMatchObject({ score: 10 })
    ctx.start()
    expect(ctx.game.state.screen).toBe('title')
    expect(ctx.game.state.score).toBe(0)
    expect(ctx.game.state.best).toMatchObject({ score: 10 })
  })
})

describe('edge-triggered input', () => {
  it('a held start does not skip through screens', () => {
    const ctx = setup({ levels: fakeLevels(2) })
    ctx.game.update(frame(['start']), DT)
    expect(ctx.game.state.screen).toBe('playing')
    playToLevelComplete(ctx)
    for (let i = 0; i < 5; i++) ctx.game.update(frame([], ['start']), DT)
    expect(ctx.game.state.screen).toBe('level-complete')
    expect(ctx.engine.createWorld).toHaveBeenCalledTimes(1)
  })
})
