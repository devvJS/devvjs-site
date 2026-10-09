// Pixel art, drawn in code. Every sprite is { w, h, rows }: h rows of w PALETTE indices,
// 0 being transparent. Small characters are ASCII grids with a per-sprite legend
// ('.' is transparent); blocks, tiles and chips are built with a few grid helpers.
//
// SPRITES = {
//   player, playerFrames: { idle, run1, run2, jump, fall, hurt },
//   entity: { <kind>: sprite }            one per world entity kind
//   variant: { bugStep, mergeSmall, flakyGhost, inviteDown, exitLocked, checkpointOn, quickAsk, phone },
//   tile: { 1..5 }                       the editor theme's tiles, by tile id
//   tiles: { <theme>: { solid[4], solidTop[4], oneway, spikes, conveyorR[4], conveyorL[4] } },
//   token: { <label>: chip }             tokenSprite(label) builds chips for other labels
//   ui: { cup, cupEmpty, echo, sudo, rmrf },
// }
import { IDX } from './palette.js'
import { eachPixel, textWidth, GLYPH_H } from './font.js'

export { PALETTE, COLOR, IDX } from './palette.js'

function idx(name) {
  const i = IDX[name]
  if (!i) throw new Error(`Unknown palette color: ${name}`)
  return i
}

// An ASCII sprite. `legend` maps characters to palette color names; '.' is transparent.
function art(legend, rows) {
  const w = rows[0].length
  return {
    w,
    h: rows.length,
    rows: rows.map((row, y) => {
      if (row.length !== w) throw new Error(`Sprite row ${y} is ${row.length} wide, expected ${w}: "${row}"`)
      return [...row].map((ch) => (ch === '.' ? 0 : idx(legend[ch] ?? `<${ch}>`)))
    }),
  }
}

// A blank grid to draw into with rect/px/text, then .done() for the sprite.
function grid(w, h) {
  const rows = Array.from({ length: h }, () => new Array(w).fill(0))
  const g = {
    px(x, y, color) {
      if (x >= 0 && y >= 0 && x < w && y < h) rows[y][x] = color === null ? 0 : idx(color)
      return g
    },
    rect(x, y, rw, rh, color) {
      for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) g.px(i, j, color)
      return g
    },
    text(str, x, y, color) {
      eachPixel(str, (px, py) => g.px(x + px, y + py, color))
      return g
    },
    done: () => ({ w, h, rows }),
  }
  return g
}

const mirrorRows = (s) => ({ w: s.w, h: s.h, rows: s.rows.map((r) => [...r].reverse()) })

// ---------------------------------------------------------------- Devv
// About 12x14, in a hoodie, facing right.
const DEVV = {
  o: 'ink', h: 'hair', s: 'skin', S: 'skinShade', e: 'ink', B: 'hoodie', b: 'hoodieShade',
  L: 'hoodieLight', g: 'green', j: 'jeans', w: 'shoe',
}
const HEAD = [
  '...hhhhh....',
  '..hhhhhhh...',
  '..hhhsssss..',
  '..hhsseses..',
  '..bhsssssS..',
  '..bbSsssS...',
]
const playerFrames = {
  idle: art(DEVV, [
    ...HEAD,
    '.bBBBBBBBb..',
    '.bBLBgBgBBb.',
    '.sbBBBBBBbs.',
    '..bBBBBBBb..',
    '..bbbbbbbb..',
    '...jjj.jjj..',
    '...jjj.jjj..',
    '...www.www..',
  ]),
  run1: art(DEVV, [
    ...HEAD,
    '.bBBBBBBBb..',
    '.bBLBgBgBBb.',
    '.bBBBBBBBbs.',
    '..bBBBBBBb..',
    '..bbbbbbbb..',
    '..jjj..jjj..',
    '.jjj....jjj.',
    '.ww......ww.',
  ]),
  run2: art(DEVV, [
    ...HEAD,
    '.bBBBBBBBb..',
    '.bBLBgBgBBb.',
    '.sbBBBBBBBb.',
    '..bBBBBBBb..',
    '..bbbbbbbb..',
    '....jjjj....',
    '....jjj.....',
    '....wwww....',
  ]),
  jump: art(DEVV, [
    '...hhhhh....',
    '..hhhhhhh...',
    '..hhhsssss..',
    '..hhsseses..',
    '..bhsssssS..',
    's.bbSsssS..s',
    'sbBBBBBBBbbs',
    '.bBLBgBgBBb.',
    '..bBBBBBBb..',
    '..bBBBBBBb..',
    '..bbbbbbbb..',
    '...jjj.jjj..',
    '..jjj...jjw.',
    '..ww........',
  ]),
  fall: art(DEVV, [
    '...hhhhh....',
    '..hhhhhhh...',
    '..hhhsssss..',
    '..hhsseses..',
    '..bhssssoS..',
    '..bbSsssS...',
    '.bBBBBBBBb..',
    'sbBLBgBgBBbs',
    '..bBBBBBBb..',
    '..bBBBBBBb..',
    '..bbbbbbbb..',
    '...jjj.jjj..',
    '...jj...jj..',
    '...ww...ww..',
  ]),
  hurt: art(DEVV, [
    '...hhhhh....',
    '..hhhhhhh...',
    '..hhhsssss..',
    '..hhsoosoo..',
    '..bhssooss..',
    's.bbSsssS..s',
    'sbBBBBBBBbbs',
    '..bBBgBgBb..',
    '..bBBBBBBb..',
    '..bbbbbbbb..',
    '..jjj..jjj..',
    '.jjj....jjj.',
    '.ww......ww.',
    '............',
  ]),
}

// ---------------------------------------------------------------- enemies
// Bug: a beetle, facing right, 14x12, two leg frames.
const BEETLE = { a: 'ink', r: 'shell', R: 'shellHi', d: 'shellDark', h: 'steelDeep', e: 'white', l: 'ink' }
const BEETLE_BODY = [
  '..........a...',
  '...........a.a',
  '....rrrrr...a.',
  '..rrRRRRrr.hh.',
  '.rRRRrRRRrhhhh',
  '.rRRrRRRRrhehh',
  'rRRRrRRRRrhhhh',
  'rrrrrrrrrrrhh.',
  '.dddddddddd...',
]
const bug = art(BEETLE, [...BEETLE_BODY, '..l..l..l..l..', '.l..l..l..l...', 'l..l..l..l....'])
const bugStep = art(BEETLE, [...BEETLE_BODY, '..l..l..l..l..', '..l..l..l..l..', '..l..l..l..l..'])

// Merge conflict: a block marked <<<<<<< ======= >>>>>>>. Big (size 2) and small (size 1).
function mergeBlock(w, h) {
  const g = grid(w, h)
  g.rect(0, 0, w, h, 'ink')
  g.rect(1, 1, w - 2, h - 2, 'panel')
  g.rect(1, 1, w - 2, 1, 'panelHi')
  g.rect(1, h - 2, w - 2, 1, 'panelDark')
  const n = Math.floor((w - 4) / 3)
  const x0 = Math.floor((w - (3 * n - 1)) / 2)
  const top = Math.max(2, Math.round(h * 0.15))
  const bottom = h - top - 3
  const mid = Math.floor(h / 2)
  for (let k = 0; k < n; k++) {
    const x = x0 + k * 3
    // '<' in red: the HEAD side
    g.px(x + 1, top, 'red').px(x, top + 1, 'red').px(x + 1, top + 2, 'red')
    // '>' in green: the incoming side
    g.px(x, bottom, 'green').px(x + 1, bottom + 1, 'green').px(x, bottom + 2, 'green')
  }
  for (let x = x0; x < x0 + 3 * n - 1; x++) {
    if ((x - x0) % 3 === 2) continue
    g.px(x, mid, 'light')
    if (h >= 16) g.px(x, mid - 2, 'light')
  }
  return g.done()
}
const mergeConflict = mergeBlock(20, 20)
const mergeSmall = mergeBlock(12, 12)

// Flaky test: a test tube. Solid (harmful) is red and glaring; the ghost is green and faint.
function testTube(liquid, liquidHi, eyes) {
  return art(
    { c: 'cork', d: 'corkDark', o: 'ink', G: 'white', g: 'glass', b: 'white', l: liquid, L: liquidHi, e: 'ink' },
    [
      '....cccccccc....',
      '....cddddddc....',
      '...oooooooooo...',
      '....oGgggggo....',
      '....oGgggggo....',
      '....oGggbggo....',
      '....oGlllllo....',
      '....oGlbllLo....',
      eyes ? '....oGelello....' : '....oGlllllo....',
      '....oGllLllo....',
      '....oGlllllo....',
      '....oGlllllo....',
      '.....oLllLo.....',
      '......olllo.....',
      '.......ooo......',
      '..oooooooooooo..',
    ],
  )
}
const flakyTest = testTube('red', 'lightRed', true)
const flakyGhost = testTube('green', 'darkGreen', false)

// Meeting invite: a calendar card with wings, 14x12, wings up and wings down.
const INVITE = { n: 'ink', o: 'ink', r: 'red', w: 'paper', k: 'grey', W: 'white', s: 'paperShade' }
const meetingInvite = art(INVITE, [
  '.....n..n.....',
  '...orrrrrro...',
  '...orrrrrro...',
  '...owwwwwwo...',
  'WW.owkkwkwo.WW',
  'WWWowwwwwwoWWW',
  'sWWowkwkkwoWWs',
  '.ssowwwwwwoss.',
  '...owkkwwwo...',
  '...owwwwwwo...',
  '...oooooooo...',
  '..............',
])
const inviteDown = art(INVITE, [
  '.....n..n.....',
  '...orrrrrro...',
  '...orrrrrro...',
  '...owwwwwwo...',
  '...owkkwkwo...',
  '...owwwwwwo...',
  'WWWowkwkkwoWWW',
  'WWsowwwwwwosWW',
  'Ws.owkkwwwo.sW',
  's..owwwwwwo..s',
  '...oooooooo...',
  '..............',
])

// Diagonal yellow and ink stripes.
function hazard(g, x, y, w, h) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.px(x + i, y + j, (i + j) % 4 < 2 ? 'yellow' : 'ink')
}

// Crusher: the head of a hydraulic press, 16x16, with a socket for the ram, a
// hazard-striped plate and teeth. The renderer draws the cylinder and ram above it,
// from the mount (topY) down to the head.
const crusher = (() => {
  const g = grid(16, 16)
  g.rect(0, 0, 16, 16, 'ink')
  g.rect(5, 0, 6, 2, 'steelDark')
  g.rect(1, 2, 14, 1, 'steelLight')
  g.rect(1, 3, 14, 3, 'steel')
  g.rect(1, 6, 14, 1, 'steelDark')
  hazard(g, 1, 7, 14, 3)
  g.rect(1, 10, 14, 2, 'steel')
  for (let x = 1; x < 15; x += 3) g.rect(x, 12, 2, 3, 'steelLight')
  return g.done()
})()

// A desk phone handset, for the Product Manager's calls.
const phone = art({ o: 'ink', k: 'steelDeep', c: 'cyan' }, [
  'ooo.',
  'okko',
  '.oko',
  '.oco',
  '.oko',
  'okko',
  'ooo.',
])

// Alert: a red pager with a "!".
const PAGER = { o: 'ink', r: 'darkRed', R: 'red', k: 'deepRed', w: 'white' }
const alert = art(PAGER, [
  '......o.',
  '.oooooo.',
  'oRRRRRro',
  'orkkkkro',
  'orkwwkro',
  'orkwwkro',
  'orkwwkro',
  'orkkkkro',
  'orkwwkro',
  'orkkkkro',
  'orrrrrro',
  '.oooooo.',
])

// Alert dropper: a ceiling beacon that drops the pagers.
const alertDropper = art({ o: 'ink', d: 'steelDark', m: 'steel', r: 'darkRed', R: 'red', w: 'lightRed' }, [
  'oooooooooooooooo',
  'oddddddddddddddo',
  'ooooommmmmmooooo',
  '....ommmmmmo....',
  '...orrRRRRrro...',
  '...orRRwwRRro...',
  '...orrRRRRrro...',
  '....oooooooo....',
])

// ---------------------------------------------------------------- pickups and props
// Checkpoint: a commit flag. Grey until reached, then green with a check.
function flag(cloth, clothShade, mark) {
  const g = grid(12, 24)
  g.rect(1, 0, 3, 1, 'ink')
  g.rect(2, 1, 1, 20, 'steelLight')
  g.rect(3, 2, 8, 7, 'ink')
  g.rect(3, 3, 7, 5, cloth)
  g.rect(3, 7, 7, 1, clothShade)
  if (mark === 'check') g.px(8, 3, 'white').px(7, 4, 'white').px(4, 5, 'white').px(6, 5, 'white').px(5, 6, 'white')
  else g.rect(5, 4, 3, 3, clothShade).px(6, 5, cloth)
  g.rect(0, 21, 6, 1, 'ink')
  g.rect(0, 22, 6, 1, 'steel')
  g.rect(0, 23, 6, 1, 'steelDark')
  return g.done()
}
const checkpoint = flag('slate', 'steelDark', 'dot')
const checkpointOn = flag('green', 'darkGreen', 'check')

// Exit: the deploy door. Open (green portal) or locked (steel shutter and a padlock).
function door(locked) {
  const g = grid(16, 32)
  g.rect(0, 0, 16, 32, 'ink')
  g.rect(1, 1, 14, 31, 'steel')
  g.rect(1, 1, 14, 1, 'steelLight')
  g.rect(2, 2, 12, 6, 'ink')
  if (locked) g.text('x', 6, 3, 'red')
  else g.text('>_', 4, 3, 'green')
  g.rect(3, 9, 10, 23, 'ink')
  if (locked) {
    g.rect(4, 10, 8, 22, 'steelDeep')
    for (let y = 12; y < 32; y += 3) g.rect(4, y, 8, 1, 'steelDark')
    g.rect(6, 15, 4, 1, 'steelLight').px(6, 16, 'steelLight').px(9, 16, 'steelLight')
    g.rect(5, 17, 6, 5, 'yellow')
    g.rect(5, 21, 6, 1, 'amber')
    g.px(7, 18, 'ink').px(8, 18, 'ink').px(7, 19, 'ink').px(8, 19, 'ink')
  } else {
    g.rect(4, 10, 8, 22, 'deepGreen')
    for (let y = 11; y < 32; y += 4) g.rect(5, y, 6, 1, 'darkGreen')
    g.rect(4, 10, 1, 22, 'darkCyan').rect(11, 10, 1, 22, 'darkCyan')
  }
  return g.done()
}
const exit = door(false)
const exitLocked = door(true)

// echo's projectile: a ">>" bolt of text.
const projectile = art({ g: 'green', G: 'cyan', W: 'white' }, [
  '.g..G...',
  '..g..G..',
  '...g..GW',
  '...g..GW',
  '..g..G..',
  '.g..G...',
])

// The Product Manager throws bug tickets and "quick ask" speech bubbles.
const bossProjectile = art({ o: 'ink', r: 'red', w: 'paper', k: 'grey', b: 'shell' }, [
  'oooooooooo',
  'orrrrrrrro',
  'owwwwwwwwo',
  'owbbwkkkwo',
  'owbbwwwwwo',
  'owwwwkkkwo',
  'owkkkkkkwo',
  'owwwwwwwwo',
  'owkkkkwwwo',
  'oooooooooo',
])
const quickAsk = art({ o: 'ink', w: 'white', k: 'ink' }, [
  '.oooooooo.',
  'owwwwwwwwo',
  'owwwkkwwwo',
  'owwkwwkwwo',
  'owwwwwkwwo',
  'owwwwkwwwo',
  'owwwwwwwwo',
  'owwwwkwwwo',
  '.ooowoooo.',
  '...oo.....',
])

// ---------------------------------------------------------------- the boss
// The Product Manager, 32x40, facing right: suit, red tie, lanyard and badge, clipboard.
const boss = (() => {
  const g = grid(32, 40)
  // legs and shoes
  g.rect(11, 32, 4, 6, 'suitDark').rect(17, 32, 4, 6, 'suitDark')
  g.rect(9, 38, 7, 2, 'ink').rect(17, 38, 8, 2, 'ink')
  // back arm
  g.rect(5, 16, 3, 13, 'suitDark').rect(5, 29, 3, 2, 'skinShade')
  // torso
  g.rect(7, 15, 18, 18, 'ink')
  g.rect(8, 15, 16, 17, 'suit')
  g.rect(8, 16, 2, 15, 'suitLight')
  g.rect(8, 31, 16, 1, 'suitDark')
  // shirt V and tie
  const v = [6, 6, 4, 4, 4, 2, 2]
  v.forEach((w, i) => g.rect(16 - w / 2, 15 + i, w, 1, 'shirt'))
  g.rect(15, 16, 2, 1, 'tieDark')
  g.rect(15, 17, 2, 9, 'tie')
  g.rect(14, 25, 4, 1, 'tie').rect(15, 26, 2, 1, 'tieDark')
  g.px(13, 17, 'suitLight').px(12, 18, 'suitLight').px(18, 17, 'suitLight').px(19, 18, 'suitLight')
  // lanyard to a badge on the left of the chest
  g.px(13, 15, 'cyan').px(12, 16, 'cyan').px(12, 17, 'cyan').px(11, 18, 'cyan').px(11, 19, 'cyan').px(11, 20, 'cyan')
  g.px(18, 15, 'cyan').px(18, 16, 'cyan')
  g.rect(9, 21, 5, 6, 'ink').rect(10, 22, 3, 4, 'white').rect(10, 22, 3, 1, 'cyan').px(11, 24, 'slate')
  // front arm, bent, holding the clipboard
  g.rect(22, 16, 3, 8, 'suit').rect(22, 23, 5, 3, 'suit').rect(22, 16, 1, 7, 'suitLight')
  // clipboard
  g.rect(24, 12, 8, 17, 'ink')
  g.rect(25, 13, 6, 15, 'wood')
  g.rect(26, 15, 4, 12, 'paper')
  g.rect(26, 11, 4, 3, 'steelLight').rect(27, 11, 2, 1, 'steel')
  for (let y = 17; y < 26; y += 2) g.rect(26, y, 4, 1, y === 21 ? 'red' : 'grey')
  g.rect(25, 22, 3, 3, 'skin').px(25, 24, 'skinShade')
  // neck and head
  g.rect(14, 13, 5, 2, 'skinShade')
  g.rect(11, 3, 11, 10, 'skin')
  g.rect(12, 13, 9, 1, 'skin')
  g.rect(11, 11, 1, 2, 'skinShade').rect(21, 11, 1, 2, 'skinShade')
  g.rect(10, 6, 1, 3, 'skinShade')
  // hair with a side part, longer at the back
  g.rect(11, 0, 10, 1, 'bossHair')
  g.rect(10, 1, 12, 3, 'bossHair')
  g.rect(10, 4, 2, 3, 'bossHair')
  g.rect(13, 1, 5, 1, 'bossHairHi')
  g.rect(21, 3, 1, 1, 'skin')
  // eyebrows, glasses, eyes
  g.rect(14, 5, 3, 1, 'bossHair').rect(18, 5, 3, 1, 'bossHair')
  g.rect(13, 6, 4, 3, 'ink').rect(18, 6, 4, 3, 'ink').rect(17, 6, 1, 1, 'ink')
  g.rect(14, 7, 2, 1, 'glass').rect(19, 7, 2, 1, 'glass')
  g.px(15, 7, 'ink').px(20, 7, 'ink')
  // nose and the smug smile
  g.px(21, 9, 'skinShade')
  g.rect(15, 11, 5, 1, 'ink').px(20, 10, 'ink')
  return g.done()
})()

// ---------------------------------------------------------------- tiles
// Per theme: solid (inside a wall), solidTop (a surface, nothing solid above), a one-way
// platform, spikes, and four animation frames of each conveyor direction.
const T = 16
const VARIANTS = 4

function spikes(tip, body, base) {
  const g = grid(T, T)
  for (let k = 0; k < 4; k++) {
    const x = k * 4
    g.rect(x + 1, 9, 2, 1, tip)
    g.rect(x + 1, 10, 2, 2, body)
    g.rect(x, 12, 4, 2, body).px(x, 12, base)
  }
  g.rect(0, 14, T, 2, base)
  return g.done()
}

function conveyorFrames(frame, belt, beltHi, arrow) {
  const frames = []
  for (let f = 0; f < 4; f++) {
    const g = grid(T, T)
    g.rect(0, 0, T, T, 'ink')
    g.rect(0, 0, T, 1, beltHi)
    g.rect(0, 1, T, 5, belt)
    for (let k = 0; k < 4; k++) {
      const c = (k * 4 + f) % T
      g.px(c, 2, arrow).px((c + 1) % T, 3, arrow).px((c + 2) % T, 3, arrow)
      g.px((c + 1) % T, 4, arrow).px((c + 2) % T, 4, arrow).px(c, 5, arrow)
    }
    g.rect(0, 6, T, 1, 'steelDark')
    g.rect(0, 7, T, 9, frame)
    for (const rx of [1, 6, 11]) {
      g.rect(rx, 9, 4, 4, 'steel').rect(rx + 1, 10, 2, 2, (rx + f) % 2 ? 'steelLight' : 'steelDark')
    }
    g.rect(0, 15, T, 1, 'ink')
    frames.push(g.done())
  }
  return { right: frames, left: frames.map(mirrorRows) }
}

function editorTiles() {
  const dims = ['codeDim', 'codeDim2', 'codeDim3']
  const syntax = [
    [[1, 4, 'purple'], [6, 3, 'light'], [10, 4, 'cyan']],
    [[3, 5, 'cyan'], [9, 2, 'light'], [12, 3, 'orange']],
    [[1, 3, 'purple'], [5, 6, 'green'], [12, 2, 'light']],
    [[5, 4, 'peach'], [10, 5, 'green']],
  ]
  const body = (v, top) => {
    const g = grid(T, T)
    g.rect(0, 0, T, T, 'panel')
    g.rect(0, T - 1, T, 1, 'panelDark').rect(T - 1, 0, 1, T, 'panelDark')
    for (let row = top ? 8 : 3, i = 0; row < T - 1; row += 4, i++) {
      const len = 3 + ((v * 5 + i * 3) % 9)
      g.rect(1 + ((v + i) % 3), row, len, 1, dims[(v + i) % 3])
    }
    if (top) {
      g.rect(0, 0, T, 1, 'panelHi').rect(0, 1, T, 1, 'panelEdge')
      for (const [x, w, c] of syntax[v]) g.rect(x, 4, w, 1, c)
    }
    return g.done()
  }
  const oneway = grid(T, T)
  oneway.rect(0, 0, T, 1, 'panelHi').rect(0, 1, T, 3, 'panelEdge').rect(0, 4, T, 1, 'panelDark')
  oneway.rect(1, 2, 3, 1, 'green').rect(5, 2, 5, 1, 'purple').rect(11, 2, 4, 1, 'light')
  const conv = conveyorFrames('panelEdge', 'steelDeep', 'steel', 'green')
  return {
    solid: Array.from({ length: VARIANTS }, (_, v) => body(v, false)),
    solidTop: Array.from({ length: VARIANTS }, (_, v) => body(v, true)),
    oneway: oneway.done(),
    spikes: spikes('lightRed', 'red', 'darkRed'),
    conveyorR: conv.right,
    conveyorL: conv.left,
  }
}

function ciTiles() {
  const body = (v, top) => {
    const g = grid(T, T)
    g.rect(0, 0, T, T, 'steelDark')
    g.rect(0, 0, T, 1, 'steel').rect(0, 0, 1, T, 'steel')
    g.rect(0, T - 1, T, 1, 'steelDeep').rect(T - 1, 0, 1, T, 'steelDeep')
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) g.px(x, y, 'steelLight')
    if (v === 1) for (let y = 6; y <= 10; y += 2) g.rect(4, y, 8, 1, 'steelDeep')
    if (v === 2) for (let i = 0; i < 6; i++) g.px(5 + i, 9 - i, 'steel')
    if (v === 3) g.rect(4, 6, 8, 5, 'steelDeep').rect(5, 7, 6, 3, 'pipeHi')
    if (top) {
      hazard(g, 0, 0, T, 4)
      g.rect(0, 4, T, 1, 'steelDeep')
    }
    return g.done()
  }
  const oneway = grid(T, T)
  oneway.rect(0, 0, T, 1, 'steelLight').rect(0, 1, T, 1, 'steel').rect(0, 2, T, 2, 'steelDark').rect(0, 4, T, 1, 'steelDeep')
  for (let x = 1; x < T; x += 3) oneway.px(x, 2, 'ink').px(x, 3, 'ink')
  oneway.rect(2, 5, 2, 2, 'steelDeep').rect(12, 5, 2, 2, 'steelDeep')
  const conv = conveyorFrames('steelDeep', 'pipe', 'steel', 'yellow')
  return {
    solid: Array.from({ length: VARIANTS }, (_, v) => body(v, false)),
    solidTop: Array.from({ length: VARIANTS }, (_, v) => body(v, true)),
    oneway: oneway.done(),
    spikes: spikes('steelLight', 'steel', 'yellow'),
    conveyorR: conv.right,
    conveyorL: conv.left,
  }
}

// Prod racks have two LED slots per 4-row unit, at x = 2 and 4; the renderer lights them.
export const RACK_LEDS = { xs: [2, 4], unit: 4 }
function prodTiles() {
  // Unit lines run edge to edge so a wall of racks merges into long fills; each unit
  // carries one drive bay, staggered by variant. The LEDs are lit live.
  const body = (v, top) => {
    const g = grid(T, T)
    g.rect(0, 0, T, T, 'rack')
    for (let u = 0, k = 0; u < T; u += RACK_LEDS.unit, k++) {
      g.rect(0, u, T, 1, 'rackLight').rect(0, u + 3, T, 1, 'rackDeep')
      const bx = 7 + ((v + k) % 3) * 2
      g.rect(bx, u + 1, 5, 2, 'steelDark')
    }
    if (top) {
      g.rect(0, 0, T, 1, 'steelLight').rect(0, 1, T, 1, 'steel').rect(0, 2, T, 1, 'steelDeep')
      for (let x = 2; x < T - 2; x += 4) g.px(x, 1, 'steelDark')
    }
    return g.done()
  }
  const oneway = grid(T, T)
  oneway.rect(0, 0, T, 1, 'steelLight').rect(0, 1, T, 2, 'steel').rect(0, 3, T, 1, 'steelDark')
  for (let x = 2; x < T; x += 4) oneway.px(x, 1, 'rackDeep')
  oneway.px(5, 4, 'cyan').px(5, 5, 'darkCyan').px(11, 4, 'green').px(11, 5, 'darkGreen')
  const conv = conveyorFrames('rack', 'rackDeep', 'steel', 'cyan')
  return {
    solid: Array.from({ length: VARIANTS }, (_, v) => body(v, false)),
    solidTop: Array.from({ length: VARIANTS }, (_, v) => body(v, true)),
    oneway: oneway.done(),
    spikes: spikes('cyan', 'steel', 'steelDark'),
    conveyorR: conv.right,
    conveyorL: conv.left,
  }
}

function bossTiles() {
  const carpet = (g, y0) => {
    for (let y = y0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const d = (x + y) % 4 === 0 && y % 2 === 0
        const e = (x - y + 16) % 4 === 0 && y % 2 === 1
        g.px(x, y, d || e ? 'carpetDark' : 'carpet')
      }
    }
  }
  const body = (v, top) => {
    const g = grid(T, T)
    if (top) {
      carpet(g, 0)
      g.rect(0, 0, T, 1, 'carpetHi')
      if (v === 1) g.px(5, 3, 'carpetHi').px(11, 8, 'carpetHi')
    } else {
      g.rect(0, 0, T, T, 'carpetDark')
      g.rect(0, T - 1, T, 1, 'wall')
      for (let x = (v * 3) % 4; x < T; x += 4) g.px(x, 6 + (v % 3), 'carpet')
    }
    return g.done()
  }
  const oneway = grid(T, T)
  oneway.rect(0, 0, T, 1, 'woodLight').rect(0, 1, T, 2, 'wood').rect(0, 3, T, 1, 'corkDark')
  oneway.rect(1, 4, 2, 4, 'steelDark').rect(13, 4, 2, 4, 'steelDark')
  const tacks = grid(T, T)
  for (let k = 0; k < 4; k++) {
    const x = k * 4
    tacks.rect(x + 1, 13, 1, 3, 'steelLight')
    tacks.rect(x, 10, 3, 2, 'red').px(x, 10, 'lightRed').rect(x + 1, 12, 1, 1, 'darkRed')
  }
  const conv = conveyorFrames('carpetDark', 'steelDeep', 'steel', 'tie')
  return {
    solid: Array.from({ length: VARIANTS }, (_, v) => body(v, false)),
    solidTop: Array.from({ length: VARIANTS }, (_, v) => body(v, true)),
    oneway: oneway.done(),
    spikes: tacks.done(),
    conveyorR: conv.right,
    conveyorL: conv.left,
  }
}

const tiles = { editor: editorTiles(), ci: ciTiles(), prod: prodTiles(), boss: bossTiles() }

// ---------------------------------------------------------------- tokens
// Each token is a glowing chip showing its label in the pixel font.
const TOKEN_COLORS = {
  '{ }': 'green', '=>': 'green', ';': 'green',
  'test()': 'cyan', expect: 'cyan', npm: 'cyan',
  git: 'amber', deploy: 'amber', logs: 'amber',
}
export const tokenColor = (label) => TOKEN_COLORS[label] ?? 'light'

const tokenCache = new Map()
export function tokenSprite(label) {
  const text = String(label)
  let s = tokenCache.get(text)
  if (s) return s
  const accent = tokenColor(text)
  const tw = Math.max(3, textWidth(text))
  const w = tw + 4
  const h = GLYPH_H + 6
  const g = grid(w, h)
  for (let x = 2; x < w - 2; x += 2) g.px(x, 0, 'steel').px(x, h - 1, 'steel')
  g.rect(0, 1, w, h - 2, accent)
  g.rect(1, 2, w - 2, h - 4, 'charcoal')
  g.px(0, 1, null).px(w - 1, 1, null).px(0, h - 2, null).px(w - 1, h - 2, null)
  g.text(text, 2 + Math.floor((tw - textWidth(text)) / 2), 3, accent)
  s = g.done()
  tokenCache.set(text, s)
  return s
}
const TOKEN_LABELS = Object.keys(TOKEN_COLORS)
const token = Object.fromEntries(TOKEN_LABELS.map((l) => [l, tokenSprite(l)]))

// ---------------------------------------------------------------- HUD icons
const CUP = { l: 'grey', w: 'white', b: 'corkDark', g: 'green', p: 'paperShade' }
const cup = art(CUP, [
  '.l..l....',
  '..l..l...',
  'wwwwwww..',
  'wbbbbbwww',
  'wwwwwww.w',
  'wgggggwww',
  '.wwwwww..',
  '..pppp...',
])
const cupEmpty = art({ w: 'slate', g: 'steelDark', p: 'steelDeep' }, [
  '.........',
  '.........',
  'wwwwwww..',
  'w.....www',
  'w.....w.w',
  'wgggggwww',
  '.wwwwww..',
  '..pppp...',
])

function icon(accent, draw) {
  const g = grid(11, 11)
  g.rect(0, 0, 11, 11, accent)
  g.rect(1, 1, 9, 9, 'charcoal')
  draw(g)
  return g.done()
}
const ui = {
  cup,
  cupEmpty,
  echo: icon('green', (g) => g.text('>', 2, 3, 'green').rect(6, 7, 3, 1, 'green')),
  sudo: icon('cyan', (g) => g.rect(3, 2, 5, 4, 'cyan').rect(4, 6, 3, 2, 'cyan').px(5, 8, 'cyan').rect(5, 3, 1, 3, 'white')),
  rmrf: icon('red', (g) => g.rect(3, 3, 5, 1, 'red').px(5, 2, 'red').rect(4, 4, 3, 5, 'red').px(5, 5, 'charcoal').px(5, 7, 'charcoal')),
}

export const SPRITES = {
  player: playerFrames.idle,
  playerFrames,
  entity: {
    bug,
    mergeConflict,
    flakyTest,
    meetingInvite,
    crusher,
    alert,
    alertDropper,
    token: token['=>'],
    checkpoint,
    exit,
    projectile,
    bossProjectile,
    boss,
  },
  variant: { bugStep, mergeSmall, flakyGhost, inviteDown, exitLocked, checkpointOn, quickAsk, phone },
  tile: {
    1: tiles.editor.solidTop[0],
    2: tiles.editor.oneway,
    3: tiles.editor.spikes,
    4: tiles.editor.conveyorR[0],
    5: tiles.editor.conveyorL[0],
  },
  tiles,
  token,
  ui,
}
