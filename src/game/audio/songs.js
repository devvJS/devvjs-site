// The four music loops, written as one token per 16th-note step:
//   a note name ('C5', 'F#4', 'Bb1') starts a note, '-' holds the previous one, '.' is a rest.
// Drum tokens: K kick, S snare, h closed hat, H open hat.
// Every bar is 16 steps; parseSong() checks that.

export const SONGS = {
  // The Editor: upbeat C major, C - Am - F - G.
  editor: {
    bpm: 140,
    lead: [
      'E5 . G5 . C6 - B5 . G5 . E5 . G5 - . .',
      'A5 . C6 . E6 - D6 . C6 . A5 . E5 - . .',
      'F5 . A5 . C6 - A5 . F5 . A5 . C6 - D6 .',
      'B5 - G5 . D6 - B5 . G5 . A5 . B5 - - .',
      'E5 . G5 . C6 - B5 . G5 . E5 . G5 - . .',
      'A5 . C6 . E6 - D6 . C6 . A5 . E5 - . .',
      'F5 . A5 . C6 - D6 . E6 . D6 . C6 . A5 .',
      'G5 . B5 . D6 . B5 . C6 - - - . . . .',
    ],
    bass: [
      'C3 . C4 . C3 . C4 . C3 . C4 . G2 . B2 .',
      'A2 . A3 . A2 . A3 . A2 . A3 . E3 . G3 .',
      'F2 . F3 . F2 . F3 . F2 . F3 . C3 . F3 .',
      'G2 . G3 . G2 . G3 . G2 . B2 . D3 . F3 .',
    ],
    drums: ['K . h . S . h . K . K . S . h .', 'K . h . S . h . K . K . S . S H'],
    leadWave: 'square',
    volumes: { lead: 0.09, bass: 0.2, drums: 1 },
  },
  // The CI Pipeline: driving E minor with a 16th-note bass.
  ci: {
    bpm: 150,
    lead: [
      'E5 . . E5 . . G5 . A5 . . B5 . A5 G5 .',
      'E5 . . E5 . . D5 . E5 - - - . . . .',
      'C5 . . C5 . . E5 . G5 . . A5 . G5 E5 .',
      'D5 . . D5 . . F#5 . A5 - - - B5 - - -',
    ],
    bass: [
      'E2 E2 E3 E2 E2 E3 E2 E3 E2 E2 E3 E2 G2 G2 A2 B2',
      'E2 E2 E3 E2 E2 E3 E2 E3 E2 E2 E3 E2 D3 D3 B2 A2',
      'C2 C2 C3 C2 C2 C3 C2 C3 C2 C2 C3 C2 E2 E2 G2 A2',
      'D2 D2 D3 D2 D2 D3 D2 D3 D2 D2 D3 D2 F#2 F#2 A2 B2',
    ],
    drums: ['K . h h S . h h K K h h S . h S'],
    leadWave: 'square',
    volumes: { lead: 0.08, bass: 0.17, drums: 1 },
  },
  // Production: tense D minor, a slow chromatic lead over a pulsing bass.
  prod: {
    bpm: 120,
    lead: [
      'D5 . . . F5 . . . E5 . . . C#5 - - -',
      'D5 . . . F5 . . . G5 . . . A5 - - -',
      'Bb5 . . . A5 . . . G5 . . . F5 . E5 .',
      'D5 - - - C#5 - - - D5 - - - . . . .',
    ],
    bass: [
      'D2 . D2 . D2 . D2 . D2 . D2 . Eb2 . D2 .',
      'D2 . D2 . D2 . D2 . D2 . D2 . Eb2 . D2 .',
      'Bb1 . Bb1 . Bb1 . Bb1 . A1 . A1 . A1 . A1 .',
      'D2 . D2 . C#2 . C#2 . D2 . D2 . A1 . C#2 .',
    ],
    drums: ['K . . h . . h . K . . h S . h .'],
    leadWave: 'square',
    volumes: { lead: 0.08, bass: 0.22, drums: 0.9 },
  },
  // The Product Manager: intense A minor at 170 bpm, octave-jumping bass.
  boss: {
    bpm: 170,
    lead: [
      'A5 A5 . A5 C6 . A5 . G5 . A5 . E6 - D6 -',
      'C6 . B5 . A5 . G5 . A5 - - - E5 - - -',
      'F5 F5 . F5 A5 . F5 . E5 . F5 . C6 - B5 -',
      'G#5 . A5 . B5 . C6 . D6 . E6 - - - . .',
    ],
    bass: [
      'A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 A1 A2 G1 G2 G1 G2',
      'A1 A2 A1 A2 A1 A2 A1 A2 E1 E2 E1 E2 E1 E2 G#1 G#2',
      'F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 F1 F2 E1 E2 E1 E2',
      'E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 E1 E2 G#1 G#2 B1 B2',
    ],
    drums: ['K h S h K K S h K h S h K K S S'],
    leadWave: 'square',
    volumes: { lead: 0.08, bass: 0.2, drums: 1 },
  },
}

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// 'A4' -> 440. Throws on anything that isn't a note name.
export function noteFreq(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name)
  if (!m) throw new Error(`Bad note name: ${name}`)
  const midi = 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * 2 ** ((midi - 69) / 12)
}

const DRUMS = new Set(['K', 'S', 'h', 'H'])
const STEPS_PER_BAR = 16

// Bars of tokens -> { length, notes: [{ step, len, value }] }. Melodic values are
// frequencies; drum values are the drum letters. A held note stops at a bar line too,
// so each bar reads on its own.
function parseTrack(bars, drums) {
  const notes = []
  bars.forEach((bar, b) => {
    const tokens = bar.trim().split(/\s+/)
    if (tokens.length !== STEPS_PER_BAR) throw new Error(`Bar ${b} has ${tokens.length} steps: "${bar}"`)
    let current = null
    tokens.forEach((tok, i) => {
      const step = b * STEPS_PER_BAR + i
      if (tok === '-') {
        if (current) current.len++
        return
      }
      current = null
      if (tok === '.') return
      if (drums) {
        if (!DRUMS.has(tok)) throw new Error(`Bad drum token: ${tok}`)
        notes.push({ step, len: 1, value: tok })
      } else {
        current = { step, len: 1, value: noteFreq(tok) }
        notes.push(current)
      }
    })
  })
  return { length: bars.length * STEPS_PER_BAR, notes }
}

// A song ready to schedule: one loop of `length` steps (the longest track; shorter
// tracks repeat inside it) and, for every step, the notes that start on it.
export function parseSong(song) {
  const tracks = {
    lead: parseTrack(song.lead, false),
    bass: parseTrack(song.bass, false),
    drums: parseTrack(song.drums, true),
  }
  const length = Math.max(...Object.values(tracks).map((t) => t.length))
  const byStep = Array.from({ length }, () => [])
  for (const [channel, track] of Object.entries(tracks)) {
    for (let base = 0; base < length; base += track.length) {
      for (const n of track.notes) byStep[base + n.step].push({ channel, len: n.len, value: n.value })
    }
  }
  return { stepSec: 60 / song.bpm / 4, length, byStep, wave: song.leadWave, volumes: song.volumes }
}
