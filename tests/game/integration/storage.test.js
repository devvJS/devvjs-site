// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolve } from 'node:path'
const MOD = resolve(__dirname, '../../../src/game/storage.js')
let localStorageAdapter
beforeEach(async () => {
  ;({ localStorageAdapter } = await import(/* @vite-ignore */ MOD))
})

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('localStorageAdapter', () => {
  it('round-trips a value through window.localStorage', () => {
    localStorageAdapter.set('tc:best', '{"score":120,"timeMs":5000}')
    expect(window.localStorage.getItem('tc:best')).toBe('{"score":120,"timeMs":5000}')
    expect(localStorageAdapter.get('tc:best')).toBe('{"score":120,"timeMs":5000}')
  })

  it('reads what was written to localStorage directly', () => {
    window.localStorage.setItem('tc:muted', 'false')
    expect(localStorageAdapter.get('tc:muted')).toBe('false')
  })

  it('returns null for a missing key', () => {
    expect(localStorageAdapter.get('tc:nothing')).toBeNull()
  })

  it('get returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(localStorageAdapter.get('tc:best')).toBeNull()
  })

  it('set does not throw when setItem throws (quota or private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => localStorageAdapter.set('tc:best', 'x')).not.toThrow()
  })

  it('get returns null and set does not throw when touching window.localStorage itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('SecurityError') })
    expect(localStorageAdapter.get('tc:best')).toBeNull()
    expect(() => localStorageAdapter.set('tc:best', 'x')).not.toThrow()
  })
})
