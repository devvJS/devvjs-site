// The in-game HUD: coffee cups, score and time, the three powers with cooldown sweeps,
// the token count, status banners, and the boss HP bar.
import { MAX_COFFEE, VIEW_W } from '../constants.js'
import { COLOR } from './palette.js'
import { SPRITES } from './sprites.js'
import { compiled, remap } from './compile.js'
import { LEVEL_NAMES, formatScore, formatTime, levelNumber, themeOf } from './themes.js'

const POWERS = [
  ['echo', 'j'],
  ['sudo', 'k'],
  ['rmrf', 'l'],
]
const LOCKED = remap('locked', { green: 'slate', cyan: 'slate', red: 'slate', white: 'slate' })

const HUD_LABEL = { editor: 'THE EDITOR', ci: 'THE CI PIPELINE', prod: 'PRODUCTION', boss: 'BOSS FIGHT' }

export function liveBoss(world) {
  return (world?.entities ?? []).find((e) => e.kind === 'boss' && e.alive !== false) ?? null
}

// One per renderer: it remembers the longest cooldown seen for each power, so the sweep
// shows how much of the current cooldown is left without knowing the world's numbers.
export function createHud() {
  const longest = { echo: 0, sudo: 0, rmrf: 0 }

  function powers(p, pl, t) {
    POWERS.forEach(([name, key], i) => {
      const x = 3 + i * 14
      const y = 17
      const unlocked = Boolean(pl.powers?.[name])
      const cd = Math.max(0, Number(pl.cooldowns?.[name]) || 0)
      if (cd > longest[name]) longest[name] = cd
      if (cd === 0) longest[name] = 0
      const icon = compiled(SPRITES.ui[name], false, unlocked ? null : LOCKED)
      p.sprite(icon, x, y)
      if (unlocked && cd > 0 && longest[name] > 0) {
        // The dark sweep drains from the top as the cooldown runs out.
        const h = Math.ceil((11 * cd) / longest[name])
        p.alpha(0.7)
        p.rect(COLOR.ink, x, y, 11, h)
        p.alpha(1)
      }
      if (name === 'sudo' && pl.sudoMs > 0) {
        const c = Math.floor(t / 100) % 2 ? COLOR.sudoGold : COLOR.sudoPale
        p.rect(c, x - 1, y - 1, 13, 1)
        p.rect(c, x - 1, y + 11, 13, 1)
      }
      p.pixelText(key, x + 4, y + 13, unlocked ? 'light' : 'slate')
    })
  }

  function bossBar(p, b) {
    const max = b.maxHp > 0 ? b.maxHp : Math.max(1, b.hp)
    const frac = Math.max(0, Math.min(1, (b.hp ?? 0) / max))
    p.alpha(0.6)
    p.rect(COLOR.ink, 56, 157, 208, 21)
    p.alpha(1)
    p.text('THE PRODUCT MANAGER', 160, 158, { color: COLOR.light, size: 7, bold: true, alignTo: 'center' })
    p.rect(COLOR.ink, 69, 168, 182, 7)
    p.rect(COLOR.deepRed, 70, 169, 180, 5)
    p.rect(b.phase >= 3 ? COLOR.amber : COLOR.red, 70, 169, Math.round(180 * frac), 5)
    p.rect(COLOR.lightRed, 70, 169, Math.round(180 * frac), 1)
    p.rect(COLOR.ink, 130, 169, 1, 5)
    p.rect(COLOR.ink, 190, 169, 1, 5)
    p.pixelText(`p${b.phase ?? 1}`, 256, 169, 'light')
  }

  return {
    draw(p, state) {
      const world = state.world
      const pl = world?.player
      if (!pl) return
      const t = world.time || 0
      p.alpha(0.6)
      p.rect(COLOR.ink, 0, 0, VIEW_W, 14)
      p.alpha(1)

      const coffee = Math.max(0, Math.min(MAX_COFFEE, pl.coffee ?? 0))
      for (let i = 0; i < MAX_COFFEE; i++) p.sprite(compiled(i < coffee ? SPRITES.ui.cup : SPRITES.ui.cupEmpty), 3 + i * 10, 3)
      p.text(`COFFEE ${coffee}/${MAX_COFFEE}`, 35, 3, { color: COLOR.light, size: 7 })

      const theme = themeOf(state)
      p.text(`L${levelNumber(state)} ${HUD_LABEL[theme] ?? LEVEL_NAMES[theme]}`, 160, 3, {
        color: COLOR.cyan,
        size: 7,
        bold: true,
        alignTo: 'center',
      })
      p.text(`SCORE ${formatScore(state.score)}`, 317, 3, { color: COLOR.green, size: 7, bold: true, alignTo: 'right' })
      p.text(`TIME ${formatTime(state.timeMs)}`, 317, 17, { color: COLOR.light, size: 7, alignTo: 'right' })

      powers(p, pl, t)
      const tk = world.tokens
      if (tk && tk.required > 0) {
        const done = tk.collected >= tk.required
        p.text(done ? 'TOKENS OK' : `TOKENS ${tk.collected}/${tk.required}`, 47, 19, {
          color: done ? COLOR.green : COLOR.light,
          size: 7,
        })
      }

      if (world.reversedMs > 0 && Math.floor(t / 250) % 2 === 0) {
        p.text('REQUIREMENTS CHANGED: LEFT IS RIGHT', 160, 32, { color: COLOR.red, size: 7, bold: true, alignTo: 'center' })
      }
      if (pl.frozenMs > 0) p.text('IN A MEETING...', 160, 42, { color: COLOR.cyan, size: 7, alignTo: 'center' })

      const b = liveBoss(world)
      if (b) bossBar(p, b)
    },
  }
}
