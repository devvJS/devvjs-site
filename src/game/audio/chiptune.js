// WebAudio chiptune: square, triangle and noise voices, a looping tune per theme and
// short 8-bit sound effects. No audio files.
//
// createAudio(AudioContextCtor) -> { unlock(), setMuted(bool), sfx(name), music(theme|null), close() }
// - No AudioContext exists until unlock(), which the UI calls from a user gesture.
// - Muted by default. While muted no sound nodes are made at all, and music stops.
// - Music is scheduled a little ahead with a timer and ctx.currentTime (never
//   requestAnimationFrame, so it keeps time when frames stall).
import { SONGS, parseSong } from './songs.js'

const TUNES = Object.fromEntries(Object.entries(SONGS).map(([name, song]) => [name, parseSong(song)]))

const TICK_MS = 50 // how often the music scheduler runs
const LOOKAHEAD = 0.3 // seconds of music scheduled ahead of currentTime
const LEAD_IN = 0.06 // delay before the first note, so it is never scheduled in the past
const SILENT = 0.0001 // exponential ramps can't reach 0

// A 1-bit noise buffer from a 15-bit LFSR, like the NES noise channel.
function makeNoise(ctx) {
  const rate = ctx.sampleRate || 44100
  const buf = ctx.createBuffer(1, Math.floor(rate * 0.5), rate)
  const data = buf.getChannelData(0)
  let reg = 1
  for (let i = 0; i < data.length; i++) {
    const bit = (reg ^ (reg >> 1)) & 1
    reg = (reg >> 1) | (bit << 14)
    data[i] = reg & 1 ? 0.8 : -0.8
  }
  return buf
}

export function createAudio(AudioContextCtor) {
  let ctx = null
  let failed = false
  let closed = false
  let muted = true
  let noise = null
  let sfxBus = null
  let musicBus = null

  let wanted = null // the theme last asked for (kept while muted)
  let playing = null // { theme, tune, step, next, timer }
  let voices = [] // music voices still sounding: { src, nodes, end }

  const ready = () => ctx !== null && !closed

  function resume() {
    try {
      const p = ctx.resume?.()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch {
      // Some browsers throw when resume() isn't allowed yet; the next gesture retries.
    }
  }

  // ---- voices ----

  // An oscillator note: `freq` at `t`, optionally sliding to `to` (exponentially),
  // with a quick attack and a decay to silence over `dur`.
  function tone(bus, type, freq, t, dur, vol, { to, steps, sustain = 0.6 } = {}) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (steps) {
      // Arpeggio inside one voice: [[offsetSec, freq], ...].
      for (const [dt, f] of steps) osc.frequency.setValueAtTime(f, t + dt)
    }
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = gain.gain
    g.setValueAtTime(SILENT, t)
    g.linearRampToValueAtTime(vol, t + 0.004)
    g.linearRampToValueAtTime(vol * sustain, t + dur * 0.5)
    g.exponentialRampToValueAtTime(SILENT, t + dur)
    osc.connect(gain)
    gain.connect(bus)
    const end = t + dur + 0.01
    osc.start(t)
    osc.stop(end)
    return { src: osc, nodes: [osc, gain], end }
  }

  // A burst of filtered noise (drums, hits, explosions).
  function hiss(bus, t, dur, vol, filterType, cutoff) {
    const src = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    src.buffer = noise
    src.loop = true
    filter.type = filterType
    filter.frequency.setValueAtTime(cutoff, t)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(SILENT, t + dur)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(bus)
    const end = t + dur + 0.01
    src.start(t)
    src.stop(end)
    return { src, nodes: [src, filter, gain], end }
  }

  // ---- sound effects ----
  // Each starts at the current time and is over well inside a second.
  const SFX = {
    jump: (t) => [tone(sfxBus, 'square', 260, t, 0.14, 0.18, { to: 720 })],
    collect: (t) => [tone(sfxBus, 'square', 988, t, 0.2, 0.16, { steps: [[0.06, 1319]] })],
    hurt: (t) => [tone(sfxBus, 'square', 420, t, 0.25, 0.2, { to: 90 }), hiss(sfxBus, t, 0.15, 0.25, 'lowpass', 1800)],
    shoot: (t) => [tone(sfxBus, 'square', 1400, t, 0.09, 0.12, { to: 340 })],
    power: (t) => [
      tone(sfxBus, 'square', 523, t, 0.32, 0.14, { steps: [[0.06, 659], [0.12, 784], [0.18, 1047]] }),
      tone(sfxBus, 'triangle', 131, t, 0.32, 0.3, { to: 262 }),
    ],
    kill: (t) => [tone(sfxBus, 'square', 330, t, 0.16, 0.14, { to: 55 }), hiss(sfxBus, t, 0.18, 0.3, 'bandpass', 2500)],
    unlock: (t) => [
      tone(sfxBus, 'square', 392, t, 0.6, 0.14, {
        steps: [[0.08, 523], [0.16, 659], [0.24, 784], [0.32, 1047], [0.4, 1319]],
        sustain: 0.8,
      }),
      tone(sfxBus, 'triangle', 196, t, 0.6, 0.28, { steps: [[0.24, 262], [0.4, 392]] }),
    ],
    checkpoint: (t) => [tone(sfxBus, 'triangle', 523, t, 0.3, 0.3, { steps: [[0.1, 784]] }), tone(sfxBus, 'square', 1047, t + 0.1, 0.18, 0.08)],
    'boss-hit': (t) => [tone(sfxBus, 'square', 170, t, 0.2, 0.2, { to: 70 }), hiss(sfxBus, t, 0.12, 0.3, 'highpass', 900)],
    freeze: (t) => [
      tone(sfxBus, 'triangle', 1600, t, 0.5, 0.2, { to: 700 }),
      tone(sfxBus, 'square', 2093, t, 0.5, 0.05, { steps: [[0.1, 1760], [0.2, 2093], [0.3, 1760], [0.4, 2093]] }),
    ],
    win: (t) => [
      tone(sfxBus, 'square', 523, t, 1.2, 0.14, {
        steps: [[0.15, 659], [0.3, 784], [0.45, 1047], [0.7, 784], [0.85, 1047]],
        sustain: 0.85,
      }),
      tone(sfxBus, 'triangle', 131, t, 1.2, 0.3, { steps: [[0.3, 196], [0.6, 262]], sustain: 0.85 }),
    ],
  }

  // ---- music ----

  function playStep(tune, step, t) {
    const out = []
    const dur = tune.stepSec
    for (const n of tune.byStep[step]) {
      if (n.channel === 'lead') {
        out.push(tone(musicBus, tune.wave, n.value, t, n.len * dur * 0.95, tune.volumes.lead, { sustain: 0.7 }))
      } else if (n.channel === 'bass') {
        out.push(tone(musicBus, 'triangle', n.value, t, n.len * dur * 0.9, tune.volumes.bass, { sustain: 0.85 }))
      } else {
        const v = tune.volumes.drums
        if (n.value === 'K') out.push(tone(musicBus, 'triangle', 160, t, 0.12, 0.45 * v, { to: 40, sustain: 0.9 }))
        else if (n.value === 'S') out.push(hiss(musicBus, t, 0.12, 0.22 * v, 'bandpass', 1800))
        else if (n.value === 'h') out.push(hiss(musicBus, t, 0.04, 0.1 * v, 'highpass', 7000))
        else out.push(hiss(musicBus, t, 0.16, 0.09 * v, 'highpass', 6000))
      }
    }
    return out
  }

  // Schedule everything due before currentTime + LOOKAHEAD, and let go of voices
  // that have finished.
  function tick() {
    if (!playing) return
    const now = ctx.currentTime
    // Fell behind (the timer was throttled): skip ahead instead of bursting notes.
    if (playing.next < now) playing.next = now + LEAD_IN
    while (playing.next < now + LOOKAHEAD) {
      voices.push(...playStep(playing.tune, playing.step, playing.next))
      playing.next += playing.tune.stepSec
      playing.step = (playing.step + 1) % playing.tune.length
    }
    voices = voices.filter((v) => {
      if (v.end > now) return true
      for (const node of v.nodes) node.disconnect()
      return false
    })
  }

  function startMusic(theme) {
    playing = { theme, tune: TUNES[theme], step: 0, next: ctx.currentTime + LEAD_IN, timer: null }
    tick()
    playing.timer = setInterval(tick, TICK_MS)
  }

  function stopMusic() {
    if (playing) clearInterval(playing.timer)
    playing = null
    const now = ctx ? ctx.currentTime : 0
    for (const v of voices) {
      try {
        if (v.end > now) v.src.stop(now)
      } catch {
        // Already stopped: disconnecting below silences it either way.
      }
      for (const node of v.nodes) node.disconnect()
    }
    voices = []
  }

  // Bring the music in line with `wanted` and the mute state.
  function syncMusic() {
    const target = ready() && !muted ? wanted : null
    if (playing && playing.theme === target) return
    stopMusic()
    if (target) startMusic(target)
  }

  return {
    unlock() {
      if (closed) return
      if (ctx) {
        if (ctx.state === 'suspended') resume()
        return
      }
      if (failed || typeof AudioContextCtor !== 'function') return
      try {
        ctx = new AudioContextCtor()
        const compressor = ctx.createDynamicsCompressor()
        const master = ctx.createGain()
        master.gain.value = 0.6
        master.connect(compressor)
        compressor.connect(ctx.destination)
        sfxBus = ctx.createGain()
        sfxBus.connect(master)
        musicBus = ctx.createGain()
        musicBus.gain.value = 0.7
        musicBus.connect(master)
        noise = makeNoise(ctx)
      } catch {
        // Blocked or unsupported: the game runs silently.
        failed = true
        ctx = null
        return
      }
      resume()
      syncMusic()
    },

    setMuted(value) {
      muted = Boolean(value)
      syncMusic()
    },

    sfx(name) {
      if (!ready() || muted || !Object.hasOwn(SFX, name)) return
      SFX[name](ctx.currentTime)
    },

    // theme: 'editor' | 'ci' | 'prod' | 'boss', or null for silence. Unknown names are ignored.
    music(theme) {
      if (theme !== null && !Object.hasOwn(TUNES, theme)) return
      wanted = theme
      syncMusic()
    },

    // Stops everything and releases the AudioContext. The object is inert afterwards.
    close() {
      if (closed) return
      wanted = null
      stopMusic()
      closed = true
      if (ctx) {
        try {
          const p = ctx.close?.()
          if (p && typeof p.catch === 'function') p.catch(() => {})
        } catch {
          // Closing is best effort.
        }
      }
    },
  }
}
