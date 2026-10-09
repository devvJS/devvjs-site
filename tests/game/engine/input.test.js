import { describe, it, expect, vi } from 'vitest'
import { createInput, keyMap, bindKeyboard } from '../../../src/game/engine/input.js'
import { ACTIONS } from '../../../src/game/constants.js'

const sorted = (s) => [...s].sort()

describe('createInput', () => {
  it('starts with nothing held or pressed', () => {
    const input = createInput()
    const f = input.frame()
    expect(sorted(f.held)).toEqual([])
    expect(sorted(f.pressed)).toEqual([])
  })

  it('pressed is an edge: true once, held while down', () => {
    const input = createInput()
    input.press('jump')
    let f = input.frame()
    expect(sorted(f.pressed)).toEqual(['jump'])
    expect(sorted(f.held)).toEqual(['jump'])
    f = input.frame()
    expect(sorted(f.pressed)).toEqual([])
    expect(sorted(f.held)).toEqual(['jump'])
  })

  it('pressing an action that is already down is not a new edge', () => {
    const input = createInput()
    input.press('left')
    input.frame()
    input.press('left')
    const f = input.frame()
    expect(sorted(f.pressed)).toEqual([])
    expect(sorted(f.held)).toEqual(['left'])
  })

  it('release clears held; pressing again is a new edge', () => {
    const input = createInput()
    input.press('echo')
    input.frame()
    input.release('echo')
    let f = input.frame()
    expect(sorted(f.held)).toEqual([])
    expect(sorted(f.pressed)).toEqual([])
    input.press('echo')
    f = input.frame()
    expect(sorted(f.pressed)).toEqual(['echo'])
    expect(sorted(f.held)).toEqual(['echo'])
  })

  it('a tap between frames is reported as pressed but not held', () => {
    const input = createInput()
    input.press('sudo')
    input.release('sudo')
    const f = input.frame()
    expect(sorted(f.pressed)).toEqual(['sudo'])
    expect(sorted(f.held)).toEqual([])
  })

  it('tracks several actions independently', () => {
    const input = createInput()
    input.press('left')
    input.press('jump')
    input.frame()
    input.release('left')
    input.press('echo')
    const f = input.frame()
    expect(sorted(f.held)).toEqual(['echo', 'jump'])
    expect(sorted(f.pressed)).toEqual(['echo'])
  })

  it('releaseAll empties held', () => {
    const input = createInput()
    input.press('left')
    input.press('right')
    input.press('jump')
    input.frame()
    input.releaseAll()
    const f = input.frame()
    expect(sorted(f.held)).toEqual([])
    expect(sorted(f.pressed)).toEqual([])
  })

  it('throws on unknown actions', () => {
    const input = createInput()
    expect(() => input.press('fly')).toThrow()
    expect(() => input.release('fly')).toThrow()
    expect(() => input.press('')).toThrow()
    expect(() => input.press(undefined)).toThrow()
  })

  it('accepts every action in ACTIONS', () => {
    const input = createInput()
    for (const a of ACTIONS) input.press(a)
    expect(sorted(input.frame().held)).toEqual(sorted(ACTIONS))
  })
})

describe('keyMap', () => {
  it('maps the documented codes', () => {
    const expected = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      Space: 'jump', KeyW: 'jump', ArrowUp: 'jump',
      KeyJ: 'echo', KeyX: 'echo',
      KeyK: 'sudo', KeyC: 'sudo',
      KeyL: 'rmrf', KeyV: 'rmrf',
      Escape: 'pause', KeyP: 'pause',
      KeyM: 'mute',
      Enter: 'start',
    }
    for (const [code, action] of Object.entries(expected)) expect(keyMap[code]).toBe(action)
  })

  it('only maps to real actions', () => {
    for (const action of Object.values(keyMap)) expect(ACTIONS).toContain(action)
  })
})

function key(type, code, extra = {}) {
  const e = new Event(type, { cancelable: true })
  e.code = code
  e.repeat = false
  Object.assign(e, extra)
  return e
}

describe('bindKeyboard', () => {
  it('presses on keydown, releases on keyup, and prevents default for mapped keys', () => {
    const target = new EventTarget()
    const input = createInput()
    bindKeyboard(target, input)
    const down = key('keydown', 'ArrowLeft')
    target.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    let f = input.frame()
    expect(sorted(f.pressed)).toEqual(['left'])
    expect(sorted(f.held)).toEqual(['left'])
    target.dispatchEvent(key('keyup', 'ArrowLeft'))
    f = input.frame()
    expect(sorted(f.held)).toEqual([])
  })

  it('does not touch or prevent unmapped keys', () => {
    const target = new EventTarget()
    const input = createInput()
    bindKeyboard(target, input)
    const down = key('keydown', 'KeyZ')
    target.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    const f = input.frame()
    expect(sorted(f.held)).toEqual([])
    expect(sorted(f.pressed)).toEqual([])
  })

  it('ignores repeat keydowns', () => {
    const target = new EventTarget()
    const input = createInput()
    bindKeyboard(target, input)
    target.dispatchEvent(key('keydown', 'Space'))
    input.frame()
    target.dispatchEvent(key('keyup', 'Space'))
    input.frame()
    target.dispatchEvent(key('keydown', 'Space', { repeat: true }))
    const f = input.frame()
    expect(sorted(f.pressed)).toEqual([])
    expect(sorted(f.held)).toEqual([])
  })

  it('maps other keys to their actions', () => {
    const target = new EventTarget()
    const input = createInput()
    bindKeyboard(target, input)
    target.dispatchEvent(key('keydown', 'KeyD'))
    target.dispatchEvent(key('keydown', 'KeyJ'))
    target.dispatchEvent(key('keydown', 'Enter'))
    expect(sorted(input.frame().held)).toEqual(['echo', 'right', 'start'])
  })

  it('the unbind function removes every listener it added', () => {
    const target = new EventTarget()
    const add = vi.spyOn(target, 'addEventListener')
    const remove = vi.spyOn(target, 'removeEventListener')
    const input = createInput()
    const unbind = bindKeyboard(target, input)
    expect(typeof unbind).toBe('function')
    expect(add.mock.calls.length).toBeGreaterThanOrEqual(2)
    unbind()
    for (const [type, fn] of add.mock.calls) {
      expect(remove.mock.calls.some(([t, f]) => t === type && f === fn)).toBe(true)
    }
    const down = key('keydown', 'ArrowRight')
    target.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(false)
    expect(sorted(input.frame().held)).toEqual([])
  })
})
