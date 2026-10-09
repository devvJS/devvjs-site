// Level names and powers by theme, shared by the canvas screens and the DOM status line.
// Levels run in theme order: editor, ci, prod, boss.
export const THEME_ORDER = Object.freeze(['editor', 'ci', 'prod', 'boss'])

export const LEVEL_NAMES = Object.freeze({
  editor: 'The Editor',
  ci: 'The CI Pipeline',
  prod: 'Production',
  boss: 'The Product Manager',
})

// The power a level unlocks, and the command it is typed as.
export const THEME_POWER = Object.freeze({ editor: 'echo', ci: 'sudo', prod: 'rmrf', boss: null })
export const POWER_COMMAND = Object.freeze({ echo: 'echo', sudo: 'sudo', rmrf: 'rm -rf' })

// The theme of the level the state is on: the world's own, else by level order.
export function themeOf(state) {
  const t = state?.world?.theme
  if (t && Object.hasOwn(LEVEL_NAMES, t)) return t
  return THEME_ORDER[state?.levelIndex] ?? THEME_ORDER[0]
}

export const levelNumber = (state) => (Number.isInteger(state?.levelIndex) ? state.levelIndex : 0) + 1

// m:ss.t
export function formatTime(ms) {
  const t = Math.max(0, Math.floor(Number(ms) || 0))
  const m = Math.floor(t / 60000)
  const s = Math.floor(t / 1000) % 60
  return `${m}:${String(s).padStart(2, '0')}.${Math.floor(t / 100) % 10}`
}

export const formatScore = (n) => String(Math.max(0, Math.floor(Number(n) || 0))).padStart(6, '0')
