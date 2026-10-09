// The level itself: tiles, entities and Devv, drawn at world position minus camera.
// Only what is on screen is drawn; everything is clipped to the view by the painter.
import { TILE, VIEW_W, VIEW_H } from '../constants.js'
import { SOLID, ONEWAY, SPIKES, CONVEYOR_R, CONVEYOR_L } from '../engine/tilemap.js'
import { COLOR } from './palette.js'
import { SPRITES, RACK_LEDS, tokenSprite, tokenColor } from './sprites.js'
import { compiled, remap, tileLayers } from './compile.js'
import { drawBackground, hash } from './background.js'

const MARGIN = 8 // how far a sprite may hang outside its entity's box

const REMAP = {
  frozen: remap('frozen', {
    hoodie: 'iceDeep', hoodieShade: 'darkCyan', hoodieLight: 'ice', skin: 'ice', skinShade: 'iceDeep', hair: 'darkCyan',
    jeans: 'darkCyan', shoe: 'ice',
  }),
  alertHot: remap('alertHot', { darkRed: 'red', red: 'lightRed', deepRed: 'darkRed' }),
  beaconOff: remap('beaconOff', { red: 'darkRed', lightRed: 'darkRed' }),
  bossAngry: remap('bossAngry', { skin: 'angrySkin' }),
  bossFurious: remap('bossFurious', { skin: 'angrySkin', glass: 'red', shirt: 'lightRed', bossHairHi: 'red' }),
  // sudo cycles the hoodie through gold and cyan, like a star power-up
  sudoGold: remap('sudoGold', { hoodie: 'sudoGold', hoodieShade: 'amber', hoodieLight: 'sudoPale' }),
  sudoCyan: remap('sudoCyan', { hoodie: 'cyan', hoodieShade: 'darkCyan', hoodieLight: 'white' }),
  beaconHot: remap('beaconHot', { darkRed: 'red', red: 'lightRed', lightRed: 'white' }),
  // On a call he greys out: shielded, not to be disturbed.
  bossOnCall: remap('bossOnCall', {
    skin: 'grey', skinShade: 'slate', angrySkin: 'grey', suit: 'steelDeep', suitLight: 'steelDark', suitDark: 'pipe',
    tie: 'steel', tieDark: 'steelDark', cyan: 'grey', shirt: 'steelLight', wood: 'steelDark', paper: 'steelLight',
    glass: 'steelLight', bossHair: 'steelDark', bossHairHi: 'steel', red: 'slate', white: 'steelLight',
  }),
  bossHit: remap('bossHit', { suit: 'suitLight', suitDark: 'suit', skin: 'white', angrySkin: 'white', skinShade: 'paperShade' }),
}

const isSolidAt = (map, tx, ty) => {
  if (ty < 0) return true
  const id = map.tiles[ty * map.width + tx]
  return id === SOLID || id === CONVEYOR_R || id === CONVEYOR_L
}

const LEDS = [COLOR.green, COLOR.green, COLOR.ledOff, COLOR.amber, COLOR.green, COLOR.ledOff, COLOR.red]

// The sprite for one map cell, or null.
function tileSprite(set, map, tx, ty, belt) {
  const id = map.tiles[ty * map.width + tx]
  if (id === SOLID) return (isSolidAt(map, tx, ty - 1) ? set.solid : set.solidTop)[hash(tx, ty) % 4]
  if (id === ONEWAY) return set.oneway
  if (id === SPIKES) return set.spikes
  if (id === CONVEYOR_R) return set.conveyorR[belt]
  if (id === CONVEYOR_L) return set.conveyorL[belt]
  return null
}

// Tiles in view, in three passes: edge-to-edge row fills merged across neighbouring
// tiles (and down whole walls), then each tile's detail pixels, then the rack LEDs.
function drawTiles(p, world, ox, oy) {
  const map = world.map
  if (!map || !map.tiles) return
  const set = SPRITES.tiles[world.theme] ?? SPRITES.tiles.editor
  const time = world.time || 0
  const tx0 = Math.max(0, Math.floor(-ox / TILE))
  const ty0 = Math.max(0, Math.floor(-oy / TILE))
  const tx1 = Math.min(map.width - 1, Math.floor((VIEW_W - 1 - ox) / TILE))
  const ty1 = Math.min(map.height - 1, Math.floor((VIEW_H - 1 - oy) / TILE))
  if (tx1 < tx0 || ty1 < ty0) return
  const belt = Math.floor(time / 70) % 4
  const cols = tx1 - tx0 + 1
  const layers = []
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const s = tileSprite(set, map, tx, ty, belt)
      layers.push(s ? tileLayers(s) : null)
    }
  }

  // 1. Row fills. A run of tiles sharing a fill color on pixel row y is one rect, and
  // a rect grows downwards while the row below repeats it exactly.
  const fills = []
  const open = new Map()
  for (let ty = ty0; ty <= ty1; ty++) {
    const base = (ty - ty0) * cols
    for (let y = 0; y < TILE; y++) {
      const py = ty * TILE + y
      let start = 0
      let color = null
      for (let i = 0; i <= cols; i++) {
        const c = i < cols ? (layers[base + i]?.rows[y] ?? null) : null
        if (c === color) continue
        if (color) {
          const key = `${start}:${i}:${color}`
          const r = open.get(key)
          if (r && r.y + r.h === py) r.h++
          else {
            const rect = { color, x: (tx0 + start) * TILE, y: py, w: (i - start) * TILE, h: 1 }
            open.set(key, rect)
            fills.push(rect)
          }
        }
        start = i
        color = c
      }
    }
  }
  for (const r of fills) p.rect(r.color, r.x + ox, r.y + oy, r.w, r.h)

  // 2. Detail pixels.
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const l = layers[(ty - ty0) * cols + (tx - tx0)]
      if (l) p.sprite(l.detail, tx * TILE + ox, ty * TILE + oy)
    }
  }

  // 3. Production racks: one unit per tile carries two status LEDs, each on its own blink.
  if (world.theme === 'prod') {
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (map.tiles[ty * map.width + tx] !== SOLID) continue
        const h = hash(tx, ty)
        const top = !isSolidAt(map, tx, ty - 1)
        const unit = top ? RACK_LEDS.unit : RACK_LEDS.unit * (h % 4)
        for (const lx of RACK_LEDS.xs) {
          const k = hash(h, lx)
          const tick = Math.floor((time + (k % 1000)) / (350 + (k % 4) * 200))
          p.rect(LEDS[(k + tick) % LEDS.length], tx * TILE + ox + lx, ty * TILE + oy + unit + 1, 1, 1)
        }
      }
    }
  }
}

// ---------------------------------------------------------------- entities

// Where a sprite goes for an entity box: centered across, and at the bottom (feet on
// the floor), the top (hanging) or the middle of the box.
function place(e, s, sx, sy, vertical = 'bottom') {
  const x = sx + Math.round((e.w - s.w) / 2)
  const y = vertical === 'top' ? sy : vertical === 'middle' ? sy + Math.round((e.h - s.h) / 2) : sy + e.h - s.h
  return [x, y]
}

const facesLeft = (e) => (e.vx < 0 ? true : e.vx > 0 ? false : e.facing === -1 || e.dir === -1)
// Animation phases are offset by where an entity is, so neighbours don't move in lockstep.
const spot = (e) => Math.floor((e.x || 0) / TILE) + Math.floor((e.y || 0) / TILE)
const phase = (n, len) => ((n % len) + len) % len
const frameOf = (time, ms, e) => phase(Math.floor(time / ms) + spot(e), 2)

function put(p, sprite, e, sx, sy, { vertical, mirror = false, swap = null, clip } = {}) {
  const [x, y] = place(e, sprite, sx, sy, vertical)
  p.sprite(compiled(sprite, mirror, swap), x, y, clip)
}

const DRAW = {
  bug(p, e, sx, sy) {
    // The legs step with distance walked.
    const step = phase(Math.floor(Math.round(e.x || 0) / 3), 2)
    put(p, step ? SPRITES.variant.bugStep : SPRITES.entity.bug, e, sx, sy, { mirror: facesLeft(e) })
  },
  mergeConflict(p, e, sx, sy) {
    put(p, (e.size ?? 2) >= 2 ? SPRITES.entity.mergeConflict : SPRITES.variant.mergeSmall, e, sx, sy)
  },
  flakyTest(p, e, sx, sy, t) {
    if (e.solid !== false) {
      put(p, SPRITES.entity.flakyTest, e, sx, sy)
    } else if (e.warn) {
      // about to turn solid: it flickers between its red and ghost selves
      const red = Math.floor(t / 60) % 2 === 0
      p.alpha(red ? 0.5 : 0.75)
      put(p, red ? SPRITES.entity.flakyTest : SPRITES.variant.flakyGhost, e, sx, sy)
      p.alpha(1)
    } else {
      p.alpha(0.35)
      put(p, SPRITES.variant.flakyGhost, e, sx, sy)
      p.alpha(1)
    }
  },
  meetingInvite(p, e, sx, sy, t) {
    const s = frameOf(t, 140, e) ? SPRITES.variant.inviteDown : SPRITES.entity.meetingInvite
    put(p, s, e, sx, sy, { vertical: 'middle', mirror: facesLeft(e) })
  },
  crusher(p, e, sx, sy, t, world, oy) {
    // S1's crusher: a 16x16 head whose y moves below a fixed mount at topY. The mount,
    // a cylinder and the piston rod fill the column down to the head.
    const s = SPRITES.entity.crusher
    const top = Number.isFinite(e.topY) ? Math.round(e.topY) + oy : sy
    const warn = e.stage === 'warn'
    const jitter = warn ? (Math.floor(t / 50) % 2 ? 1 : -1) : 0
    const [hx, hy] = place(e, s, sx + jitter, sy, 'bottom')
    const cx = sx + Math.round((e.w - 16) / 2)
    p.rect(COLOR.ink, cx, top - 3, 16, 3)
    p.rect(COLOR.steel, cx + 1, top - 2, 14, 1)
    if (warn) p.rect(Math.floor(t / 100) % 2 ? COLOR.red : COLOR.amber, cx + 7, top - 3, 2, 2)
    const barrel = Math.min(hy, top + 10)
    if (barrel > top) {
      p.rect(COLOR.ink, cx + 4, top, 8, barrel - top)
      p.rect(COLOR.steelDark, cx + 5, top, 6, barrel - top)
      p.rect(COLOR.steel, cx + 6, top, 1, barrel - top)
    }
    if (hy > barrel) {
      p.rect(COLOR.ink, cx + 6, barrel, 4, hy - barrel)
      p.rect(COLOR.steel, cx + 7, barrel, 2, hy - barrel)
      p.rect(COLOR.chrome, cx + 7, barrel, 1, hy - barrel)
    }
    p.sprite(compiled(s), hx, hy)
  },
  alert(p, e, sx, sy, t) {
    put(p, SPRITES.entity.alert, e, sx, sy, { vertical: 'middle', swap: frameOf(t, 90, e) ? REMAP.alertHot : null })
  },
  alertDropper(p, e, sx, sy, t) {
    if (e.warn) {
      // about to drop: the beacon burns white-hot and a drip forms under it
      const s = SPRITES.entity.alertDropper
      const [x, y] = place(e, s, sx, sy, 'top')
      p.sprite(compiled(s, false, REMAP.beaconHot), x, y)
      p.rect(COLOR.red, x + Math.floor(s.w / 2) - 1, y + s.h, 2, 1 + (Math.floor(t / 80) % 3))
      return
    }
    put(p, SPRITES.entity.alertDropper, e, sx, sy, { vertical: 'top', swap: frameOf(t, 250, e) ? REMAP.beaconOff : null })
  },
  token(p, e, sx, sy, t) {
    const s = SPRITES.token[e.label] ?? tokenSprite(e.label ?? '?')
    const bob = [0, -1, -1, 0][phase(Math.floor(t / 180) + spot(e), 4)]
    const [x, y] = place(e, s, sx, sy + bob, 'middle')
    const pulse = phase(Math.floor(t / 120) + spot(e), 4)
    p.alpha(0.18 + pulse * 0.06)
    p.rect(COLOR[tokenColor(e.label)], x - 1, y, s.w + 2, s.h)
    p.rect(COLOR[tokenColor(e.label)], x, y - 1, s.w, s.h + 2)
    p.alpha(1)
    p.sprite(compiled(s), x, y)
  },
  checkpoint(p, e, sx, sy) {
    if (e.active) {
      const [x, y] = place(e, SPRITES.variant.checkpointOn, sx, sy)
      p.alpha(0.25)
      p.rect(COLOR.green, x + 2, y + 1, 10, 9)
      p.alpha(1)
      p.sprite(compiled(SPRITES.variant.checkpointOn), x, y)
    } else {
      put(p, SPRITES.entity.checkpoint, e, sx, sy)
    }
  },
  exit(p, e, sx, sy, t) {
    if (e.locked) {
      put(p, SPRITES.variant.exitLocked, e, sx, sy)
      return
    }
    const s = SPRITES.entity.exit
    const [x, y] = place(e, s, sx, sy)
    p.sprite(compiled(s), x, y)
    // a scan line rising through the open portal
    const scan = 31 - (Math.floor(t / 45) % 21)
    p.alpha(0.7)
    p.rect(COLOR.green, x + 4, y + scan, 8, 1)
    p.alpha(1)
  },
  projectile(p, e, sx, sy) {
    put(p, SPRITES.entity.projectile, e, sx, sy, { vertical: 'middle', mirror: facesLeft(e) })
  },
  bossProjectile(p, e, sx, sy, t) {
    // S1 tags each throw; very old worlds without the tag alternate by id.
    const ask = e.variant ? e.variant === 'ask' : (e.id | 0) % 2 === 1
    const s = ask ? SPRITES.variant.quickAsk : SPRITES.entity.bossProjectile
    put(p, s, e, sx, sy, { vertical: 'middle', mirror: !ask && Math.floor(t / 100) % 2 === 1 })
  },
  boss(p, e, sx, sy, t, world) {
    const s = SPRITES.entity.boss
    const pl = world.player
    const mirror = pl ? pl.x + pl.w / 2 < e.x + e.w / 2 : false
    let swap = e.phase >= 3 ? REMAP.bossFurious : e.phase === 2 ? REMAP.bossAngry : null
    if (e.anim === 'hit') swap = REMAP.bossHit
    if (e.onCall) swap = REMAP.bossOnCall
    const bob = Math.floor(t / 300) % 2
    const lean = e.anim === 'windup' ? (mirror ? 1 : -1) : 0
    const [x, y] = place(e, s, sx + lean, sy + bob - 1, 'bottom')
    if ((e.hp ?? 1) <= 0 || e.anim === 'defeated') p.alpha(0.5)
    p.sprite(compiled(s, mirror, swap), x, y)
    p.alpha(1)
    const cx = sx + Math.round(e.w / 2)
    if (e.onCall) {
      // a phone at the ear on the side he faces, and the reason he isn't listening
      const ph = SPRITES.variant.phone
      p.sprite(compiled(ph, mirror), mirror ? x + 7 : x + s.w - 13, y + 4)
      p.text('ON A CALL', cx, sy - 14, { color: COLOR.grey, size: 7, bold: true, alignTo: 'center' })
    } else if (e.callWarn) {
      // the phone is about to ring
      p.text('!', cx, sy - 12, { color: COLOR.yellow, size: 9, bold: true, alignTo: 'center' })
    }
  },
}

// Drawn before Devv, then Devv, then what flies over him.
const FRONT_ORDER = ['alert', 'projectile', 'bossProjectile']
const BACK_ORDER = ['checkpoint', 'exit', 'alertDropper', 'crusher', 'token', 'bug', 'mergeConflict', 'flakyTest', 'meetingInvite', 'boss']

function onScreen(e, sx, sy) {
  const w = e.w || 0
  const h = e.h || 0
  return sx + w + MARGIN > 0 && sx - MARGIN < VIEW_W && sy + h + MARGIN > 0 && sy - MARGIN < VIEW_H
}

function drawEntities(p, world, ox, oy, front) {
  const list = world.entities ?? []
  const t = world.time || 0
  const kinds = front ? FRONT_ORDER : BACK_ORDER
  for (const kind of kinds) {
    const draw = DRAW[kind]
    for (const e of list) {
      if (e.kind !== kind || e.alive === false) continue
      const sx = Math.round(e.x) + ox
      const sy = Math.round(e.y) + oy
      if (!onScreen(e, sx, sy)) continue
      draw(p, e, sx, sy, t, world, oy)
    }
  }
}

// ---------------------------------------------------------------- Devv

function playerSprite(pl, t) {
  const f = SPRITES.playerFrames
  if (pl.dead) return f.hurt
  switch (pl.anim) {
    case 'run':
      return Math.floor(t / 100) % 2 ? f.run2 : f.run1
    case 'jump':
      return f.jump
    case 'fall':
      return f.fall
    case 'hurt':
      return f.hurt
    default:
      return f.idle
  }
}

function drawPlayer(p, world, ox, oy) {
  const pl = world.player
  if (!pl) return
  const t = world.time || 0
  const s = playerSprite(pl, t)
  const x = Math.round(pl.x) + ox + Math.round(((pl.w ?? 12) - s.w) / 2)
  const y = Math.round(pl.y) + oy + (pl.h ?? 14) - s.h
  const frozen = pl.frozenMs > 0 || pl.anim === 'frozen'
  const sudo = pl.sudoMs > 0

  if (sudo) {
    // sudo: a crackling gold glow with rounded corners, there for as long as it lasts
    const a = Math.floor(t / 60) % 2 ? COLOR.sudoPale : COLOR.sudoGold
    const b = a === COLOR.sudoGold ? COLOR.sudoPale : COLOR.sudoGold
    p.alpha(0.35)
    p.rect(a, x - 1, y - 3, s.w + 2, 1)
    p.rect(a, x - 1, y + s.h + 2, s.w + 2, 1)
    p.rect(a, x - 3, y - 1, 1, s.h + 2)
    p.rect(a, x + s.w + 2, y - 1, 1, s.h + 2)
    p.alpha(0.9)
    p.rect(b, x, y - 2, s.w, 1)
    p.rect(b, x, y + s.h + 1, s.w, 1)
    p.rect(b, x - 2, y, 1, s.h)
    p.rect(b, x + s.w + 1, y, 1, s.h)
    p.alpha(1)
    const k = Math.floor(t / 80) % 4
    const sparks = [[x - 2, y - 2], [x + s.w + 1, y - 2], [x + s.w + 1, y + s.h + 1], [x - 2, y + s.h + 1]]
    p.rect(COLOR.sudoPale, sparks[k][0], sparks[k][1], 1, 1)
  }

  const blink = pl.invulnMs > 0 && !sudo && Math.floor(t / 70) % 2 === 1
  p.alpha(pl.dead ? 0.45 : blink ? 0.3 : 1)
  const swap = frozen ? REMAP.frozen : sudo ? (Math.floor(t / 70) % 2 ? REMAP.sudoCyan : REMAP.sudoGold) : null
  p.sprite(compiled(s, pl.facing === -1, swap), x, y)
  p.alpha(1)

  if (frozen) {
    // stuck in a meeting: an ice block and a tiny calendar over his head
    p.alpha(0.3)
    p.rect(COLOR.ice, x - 1, y - 1, s.w + 2, s.h + 2)
    p.alpha(1)
    p.rect(COLOR.ink, x + 3, y - 8, 6, 6)
    p.rect(COLOR.paper, x + 4, y - 7, 4, 4)
    p.rect(COLOR.red, x + 4, y - 7, 4, 1)
  }
}

// The whole level for one frame. `shake` is the camera-shake offset in pixels.
export function drawWorld(p, world, shake) {
  const cam = world.camera ?? { x: 0, y: 0 }
  const cx = Math.round(cam.x || 0) - shake.x
  const cy = Math.round(cam.y || 0) - shake.y
  const ox = -cx
  const oy = -cy
  drawBackground(p, world.theme, cx, cy, world.time || 0)
  drawTiles(p, world, ox, oy)
  drawEntities(p, world, ox, oy, false)
  drawPlayer(p, world, ox, oy)
  drawEntities(p, world, ox, oy, true)
}
