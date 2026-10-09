// The shared palette. Sprites store indices into PALETTE; index 0 is transparent.
// COLOR maps a name to its hex string, and IDX maps a name to its palette index.
export const COLOR = Object.freeze({
  // site colors
  charcoal: '#0d0f12',
  green: '#39ff14',
  cyan: '#00e5ff',
  light: '#e2e8f0',
  slate: '#4a5568',

  ink: '#06070a',
  white: '#ffffff',
  grey: '#9aa3ad',
  darkGreen: '#1e8a0b',
  deepGreen: '#0f3d08',
  darkCyan: '#00788a',

  // editor
  panel: '#1a1d24',
  panelDark: '#13151a',
  panelEdge: '#2c3340',
  panelHi: '#3e4c63',
  gutter: '#111317',
  gutterText: '#3a4250',
  codeDim: '#1d2531',
  codeDim2: '#262035',
  codeDim3: '#1b2b20',
  purple: '#c792ea',
  orange: '#f78c6c',
  peach: '#ffcb6b',

  // Devv
  skin: '#f2c29b',
  skinShade: '#c98b5e',
  hair: '#3b2414',
  hoodie: '#2f6fde',
  hoodieShade: '#1d469a',
  hoodieLight: '#6a9cf5',
  jeans: '#2c3550',
  shoe: '#d9dde6',

  // enemies and hazards
  red: '#ff3b3b',
  darkRed: '#a31621',
  deepRed: '#4a0b10',
  lightRed: '#ff8a80',
  shell: '#c2412d',
  shellHi: '#ff7b54',
  shellDark: '#5a1a10',
  yellow: '#ffd60a',
  amber: '#ff9f1c',
  glass: '#9fe8ff',
  glassDark: '#4fa8c4',
  cork: '#b07a45',
  corkDark: '#7a4f28',
  paper: '#f4f6f8',
  paperShade: '#cfd6de',

  // ci
  steel: '#7d8592',
  steelLight: '#b4bcc8',
  steelDark: '#4b515c',
  steelDeep: '#2b2f36',
  chrome: '#dfe6ee',
  pipe: '#1f242c',
  pipeHi: '#2d343f',

  // prod
  rack: '#1e2430',
  rackLight: '#2e3644',
  rackDeep: '#12161e',
  ledOff: '#26303a',

  // boss office
  carpet: '#3b3f6b',
  carpetDark: '#2e3156',
  carpetHi: '#4b508a',
  wall: '#262a38',
  wallHi: '#30354a',
  board: '#eef1f4',
  boardFrame: '#8b939e',
  wood: '#8a5a2b',
  woodLight: '#a8713d',
  suit: '#2a2f3d',
  suitLight: '#414a60',
  suitDark: '#1b1f29',
  shirt: '#f0f0f0',
  tie: '#d62839',
  tieDark: '#8c1525',
  bossHair: '#5a3d2b',
  bossHairHi: '#7d5a40',
  angrySkin: '#f08a6c',

  // effects (only used by the sudo aura and the frozen look)
  sudoGold: '#ffe45c',
  sudoPale: '#fffbe0',
  ice: '#bdf4ff',
  iceDeep: '#6fd6f0',
})

export const PALETTE = Object.freeze([null, ...Object.values(COLOR)])

export const IDX = Object.freeze(Object.fromEntries(Object.keys(COLOR).map((name, i) => [name, i + 1])))
