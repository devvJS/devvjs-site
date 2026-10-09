// Level 4: The Product Manager.
// The boss arena: a walled, flat floor with a low step by the left wall, two side ledges and a high
// centre line to dodge on. Devv starts on the left; the Product Manager waits on the right.
// No tokens and no exit: beating him ends the game.
//
// Sections (columns):
//     0-25  arena: walls, a flat floor, ledges at 3-7 and 16-20, the centre line at 9-14, B in the clear at 22
//
// Characters: see the legend in ./index.js.
export default {
  id: 'boss',
  name: 'The Product Manager',
  theme: 'boss',
  power: null,
  tokenKinds: [],
  tokensRequired: 0,
  rows: [
    '##########################',
    '#........................#',
    '#........................#',
    '#.......##......##.......#',
    '#........................#',
    '#........................#',
    '#........................#',
    '#........======..........#',
    '#........................#',
    '#..=====........=====....#',
    '#.....................B..#',
    '###.P....................#',
    '##########################',
    '##########################',
  ],
}
