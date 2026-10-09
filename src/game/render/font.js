// A 3x5 pixel font for the small in-world lettering: token chips, line numbers, signs.
// Letters have a lowercase look, since what they spell is code. Unknown characters
// draw as a solid block.
const G = {
  '0': ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'],
  '1': ['.x.', 'xx.', '.x.', '.x.', 'xxx'],
  '2': ['xx.', '..x', '.x.', 'x..', 'xxx'],
  '3': ['xx.', '..x', '.x.', '..x', 'xx.'],
  '4': ['x.x', 'x.x', 'xxx', '..x', '..x'],
  '5': ['xxx', 'x..', 'xx.', '..x', 'xx.'],
  '6': ['.xx', 'x..', 'xxx', 'x.x', 'xxx'],
  '7': ['xxx', '..x', '.x.', '.x.', '.x.'],
  '8': ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
  '9': ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
  a: ['...', '.xx', 'x.x', 'x.x', '.xx'],
  b: ['x..', 'xx.', 'x.x', 'x.x', 'xx.'],
  c: ['...', '.xx', 'x..', 'x..', '.xx'],
  d: ['..x', '.xx', 'x.x', 'x.x', '.xx'],
  e: ['...', '.x.', 'xxx', 'x..', '.xx'],
  f: ['.xx', 'x..', 'xxx', 'x..', 'x..'],
  g: ['...', '.xx', 'x.x', '.xx', 'xx.'],
  h: ['x..', 'xx.', 'x.x', 'x.x', 'x.x'],
  i: ['.x.', '...', '.x.', '.x.', '.x.'],
  j: ['..x', '...', '..x', 'x.x', '.x.'],
  k: ['x..', 'x.x', 'xx.', 'xx.', 'x.x'],
  l: ['xx.', '.x.', '.x.', '.x.', '.xx'],
  m: ['...', 'xxx', 'xxx', 'x.x', 'x.x'],
  n: ['...', 'xx.', 'x.x', 'x.x', 'x.x'],
  o: ['...', '.x.', 'x.x', 'x.x', '.x.'],
  p: ['...', 'xx.', 'x.x', 'xx.', 'x..'],
  q: ['...', '.xx', 'x.x', '.xx', '..x'],
  r: ['...', '.xx', 'x..', 'x..', 'x..'],
  s: ['.xx', 'x..', '.x.', '..x', 'xx.'],
  t: ['.x.', 'xxx', '.x.', '.x.', '..x'],
  u: ['...', 'x.x', 'x.x', 'x.x', '.xx'],
  v: ['...', 'x.x', 'x.x', 'x.x', '.x.'],
  w: ['...', 'x.x', 'x.x', 'xxx', 'xxx'],
  x: ['...', 'x.x', '.x.', '.x.', 'x.x'],
  y: ['x.x', 'x.x', '.xx', '..x', 'xx.'],
  z: ['...', 'xxx', '.x.', 'x..', 'xxx'],
  '{': ['.xx', '.x.', 'x..', '.x.', '.xx'],
  '}': ['xx.', '.x.', '..x', '.x.', 'xx.'],
  '(': ['.x.', 'x..', 'x..', 'x..', '.x.'],
  ')': ['.x.', '..x', '..x', '..x', '.x.'],
  '[': ['xx.', 'x..', 'x..', 'x..', 'xx.'],
  ']': ['.xx', '..x', '..x', '..x', '.xx'],
  '=': ['...', 'xxx', '...', 'xxx', '...'],
  '>': ['x..', '.x.', '..x', '.x.', 'x..'],
  '<': ['..x', '.x.', 'x..', '.x.', '..x'],
  ';': ['...', '.x.', '...', '.x.', 'x..'],
  ':': ['...', '.x.', '...', '.x.', '...'],
  '!': ['.x.', '.x.', '.x.', '...', '.x.'],
  '?': ['xx.', '..x', '.x.', '...', '.x.'],
  '.': ['...', '...', '...', '...', '.x.'],
  ',': ['...', '...', '...', '.x.', 'x..'],
  '-': ['...', '...', 'xxx', '...', '...'],
  '+': ['...', '.x.', 'xxx', '.x.', '...'],
  '_': ['...', '...', '...', '...', 'xxx'],
  '/': ['..x', '..x', '.x.', 'x..', 'x..'],
  '$': ['.xx', 'xx.', '.x.', '.xx', 'xx.'],
  '#': ['x.x', 'xxx', 'x.x', 'xxx', 'x.x'],
  "'": ['.x.', '.x.', '...', '...', '...'],
  '~': ['...', '...', '.xx', 'xx.', '...'],
  '"': ['x.x', 'x.x', '...', '...', '...'],
  ' ': ['...', '...', '...', '...', '...'],
}
const BLOCK = ['xxx', 'xxx', 'xxx', 'xxx', 'xxx']

export const GLYPH_W = 3
export const GLYPH_H = 5
export const GLYPH_ADVANCE = 4

export function glyph(ch) {
  return G[ch] ?? G[ch.toLowerCase()] ?? BLOCK
}

// Width in pixels of `text` set in this font.
export const textWidth = (text) => (text.length ? text.length * GLYPH_ADVANCE - 1 : 0)

// Calls plot(x, y) for every lit pixel of `text`, with its top-left at (0, 0).
export function eachPixel(text, plot) {
  for (let i = 0; i < text.length; i++) {
    const rows = glyph(text[i])
    for (let y = 0; y < GLYPH_H; y++) {
      for (let x = 0; x < GLYPH_W; x++) if (rows[y][x] === 'x') plot(i * GLYPH_ADVANCE + x, y)
    }
  }
}
