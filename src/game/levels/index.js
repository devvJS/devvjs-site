// The four levels, in play order. Each is a levelDef:
// { id, name, theme, rows, power, tokenKinds, tokensRequired } (see .swarm/tc/spec.md).
//
// Legend for the level rows (the engine's LEGEND in ../engine/tilemap.js):
//   tiles:  .  empty          #  solid           =  one-way (solid only from above)
//           ^  spikes          >  conveyor right  <  conveyor left
//   spawns: P  player start    C  checkpoint      E  exit (locked until the level's power)
//           t  token           b  bug             m  merge conflict
//           f  flaky test      x  crusher         a  alert dropper
//           i  meeting invite  B  boss
import editor from './editor.js'
import ci from './ci.js'
import prod from './prod.js'
import boss from './boss.js'

export const LEVELS = Object.freeze([editor, ci, prod, boss])
