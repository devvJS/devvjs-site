import { describe, it, expect } from 'vitest'
import { isKnownRoute } from '../src/routes.js'

describe('isKnownRoute with repeated slashes', () => {
  it.each(['//', '///', '/resume//'])('rejects %j', (p) => {
    expect(isKnownRoute(p)).toBe(false)
  })
})
