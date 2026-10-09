import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createFakeAudio, silencedBy, signature } from '../helpers/s3-fake-audio.js'
import { loadSrc } from '../helpers/s3-fixtures.js'

// Pinned: music is scheduled with setTimeout/setInterval and ctx.currentTime (the tests fake
// timers and move the fake clock together); the first chunk is scheduled synchronously inside
// music(); stopping means every music source gets stop(<= now) or disconnect().
const SFX = ['jump', 'collect', 'hurt', 'shoot', 'power', 'kill', 'unlock', 'checkpoint', 'boss-hit', 'freeze', 'win']
const THEMES = ['editor', 'ci', 'prod', 'boss']

let fake
beforeEach(() => {
  vi.useFakeTimers()
  fake = createFakeAudio()
})
afterEach(() => {
  vi.useRealTimers()
})

async function make(Ctor = fake.Ctor) {
  const { createAudio } = await loadSrc('game/audio/chiptune.js')
  return createAudio(Ctor)
}
async function ready() {
  const audio = await make()
  audio.unlock()
  audio.setMuted(false)
  return audio
}
// Move the fake audio clock and the fake timers together.
function run(ms) {
  for (let t = 0; t < ms; t += 50) {
    fake.advance(0.05)
    vi.advanceTimersByTime(50)
  }
}

describe('unlock', () => {
  it('constructs nothing before unlock', async () => {
    const audio = await make()
    audio.setMuted(false)
    audio.sfx('jump')
    audio.music('editor')
    expect(fake.instances.length).toBe(0)
  })

  it('constructs one AudioContext on unlock', async () => {
    const audio = await make()
    audio.unlock()
    expect(fake.instances.length).toBe(1)
  })

  it('is idempotent', async () => {
    const audio = await make()
    audio.unlock()
    audio.unlock()
    audio.unlock()
    expect(fake.instances.length).toBe(1)
  })

  it('resumes a suspended context', async () => {
    const audio = await make()
    audio.unlock()
    expect(fake.ctx.resumeCalls).toBeGreaterThanOrEqual(1)
    expect(fake.ctx.state).toBe('running')
  })

  it('survives a missing AudioContext constructor', async () => {
    const audio = await make(undefined)
    expect(() => {
      audio.unlock()
      audio.setMuted(false)
      audio.sfx('jump')
      audio.music('editor')
      audio.music(null)
    }).not.toThrow()
  })

  it('survives a constructor that throws', async () => {
    const audio = await make(class { constructor() { throw new Error('blocked') } })
    expect(() => {
      audio.unlock()
      audio.sfx('jump')
    }).not.toThrow()
  })
})

describe('muting', () => {
  it('starts muted: sfx and music make no nodes', async () => {
    const audio = await make()
    audio.unlock()
    const before = fake.nodeCount()
    audio.sfx('jump')
    audio.sfx('win')
    audio.music('editor')
    run(2000)
    expect(fake.nodeCount()).toBe(before)
    expect(fake.startedSources().length).toBe(0)
  })

  it('makes nodes once unmuted', async () => {
    const audio = await make()
    audio.unlock()
    const before = fake.nodeCount()
    audio.setMuted(false)
    audio.sfx('jump')
    expect(fake.nodeCount()).toBeGreaterThan(before)
    expect(fake.startedSources().length).toBeGreaterThan(0)
  })

  it('goes quiet again when muted again', async () => {
    const audio = await ready()
    audio.setMuted(true)
    const before = fake.nodeCount()
    audio.sfx('jump')
    expect(fake.nodeCount()).toBe(before)
  })

  it('does not play sfx when unmuted before unlock', async () => {
    const audio = await make()
    audio.setMuted(false)
    audio.sfx('jump')
    expect(fake.instances.length).toBe(0)
    audio.unlock()
    expect(fake.startedSources().length).toBe(0)
  })
})

describe('sfx', () => {
  it.each(SFX)('plays %s without throwing, with a source that starts and ends', async (name) => {
    const audio = await ready()
    const before = fake.startedSources().length
    expect(() => audio.sfx(name)).not.toThrow()
    const played = fake.startedSources().slice(before)
    expect(played.length).toBeGreaterThan(0)
    for (const s of played) {
      expect(s.stops.length, `${name} source is stopped`).toBeGreaterThan(0)
      expect(s.stops.at(-1), `${name} ends within 3 s`).toBeLessThanOrEqual(fake.ctx.currentTime + 3)
      expect(s.stops.at(-1)).toBeGreaterThan(fake.ctx.currentTime)
    }
  })

  it('gives every sfx its own sound', async () => {
    const audio = await ready()
    const sigs = []
    for (const name of SFX) {
      const before = fake.startedSources().length
      audio.sfx(name)
      sigs.push(signature(fake.startedSources().slice(before)))
    }
    expect(new Set(sigs).size).toBe(SFX.length)
  })

  it('plays the same sfx the same way twice', async () => {
    const audio = await ready()
    const a0 = fake.startedSources().length
    audio.sfx('hurt')
    const a = signature(fake.startedSources().slice(a0))
    const b0 = fake.startedSources().length
    audio.sfx('hurt')
    expect(signature(fake.startedSources().slice(b0))).toBe(a)
  })

  it('ignores an unknown sfx name: no throw, no nodes', async () => {
    const audio = await ready()
    const before = fake.nodeCount()
    expect(() => audio.sfx('no-such-sound')).not.toThrow()
    expect(fake.nodeCount()).toBe(before)
  })
})

describe('music', () => {
  it.each(THEMES)('theme %s starts sources and keeps scheduling (it loops)', async (theme) => {
    const audio = await ready()
    audio.music(theme)
    const n0 = fake.startedSources().length
    expect(n0).toBeGreaterThan(0)
    run(10000)
    const n1 = fake.startedSources().length
    expect(n1).toBeGreaterThan(n0)
    run(20000)
    expect(fake.startedSources().length).toBeGreaterThan(n1)
  })

  it('gives each theme its own tune', async () => {
    const sigs = []
    for (const theme of THEMES) {
      fake = createFakeAudio()
      const audio = await ready()
      audio.music(theme)
      sigs.push(signature(fake.startedSources()))
    }
    expect(new Set(sigs).size).toBe(THEMES.length)
  })

  it('music(null) stops the loop: sources end and nothing new is scheduled', async () => {
    const audio = await ready()
    audio.music('editor')
    run(3000)
    const t = fake.ctx.currentTime
    audio.music(null)
    for (const s of fake.startedSources()) expect(silencedBy(s, t), 'source stopped').toBe(true)
    const nodes = fake.nodeCount()
    run(10000)
    expect(fake.nodeCount()).toBe(nodes)
  })

  it('switching themes stops the previous one and plays the new one', async () => {
    const audio = await ready()
    audio.music('editor')
    run(2000)
    const t = fake.ctx.currentTime
    const old = fake.startedSources()
    audio.music('ci')
    for (const s of old) expect(silencedBy(s, t), 'old source stopped').toBe(true)
    const fresh = fake.startedSources().filter((s) => !old.includes(s))
    expect(fresh.length).toBeGreaterThan(0)
    for (const s of fresh) expect(silencedBy(s, t)).toBe(false)
    run(10000)
    const later = fake.startedSources().filter((s) => !old.includes(s) && !fresh.includes(s))
    expect(later.length).toBeGreaterThan(0)
    for (const s of old) expect(silencedBy(s, t)).toBe(true)
  })

  it('asking for the theme that is already playing does not double it up', async () => {
    const audio = await ready()
    audio.music('editor')
    const n = fake.startedSources().length
    audio.music('editor')
    expect(fake.startedSources().length).toBe(n)
  })

  it('ignores an unknown theme without throwing', async () => {
    const audio = await ready()
    expect(() => audio.music('nope')).not.toThrow()
    expect(fake.startedSources().length).toBe(0)
  })

  it('setMuted(true) silences music that is playing', async () => {
    const audio = await ready()
    audio.music('prod')
    run(2000)
    const t = fake.ctx.currentTime
    audio.setMuted(true)
    for (const s of fake.startedSources()) expect(silencedBy(s, t), 'source stopped').toBe(true)
    const nodes = fake.nodeCount()
    run(10000)
    expect(fake.nodeCount()).toBe(nodes)
  })

  it('music requested while muted starts when unmuted', async () => {
    const audio = await make()
    audio.unlock()
    audio.music('boss')
    expect(fake.startedSources().length).toBe(0)
    audio.setMuted(false)
    expect(fake.startedSources().length).toBeGreaterThan(0)
  })

  it('unmuting resumes the last requested theme after a mute', async () => {
    const audio = await ready()
    audio.music('ci')
    audio.setMuted(true)
    const n = fake.startedSources().length
    audio.setMuted(false)
    expect(fake.startedSources().length).toBeGreaterThan(n)
  })

  it('does not start music on unmute after music(null)', async () => {
    const audio = await ready()
    audio.music('ci')
    audio.music(null)
    audio.setMuted(true)
    const n = fake.startedSources().length
    audio.setMuted(false)
    run(2000)
    expect(fake.startedSources().length).toBe(n)
  })
})
