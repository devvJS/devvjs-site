import { describe, it, expect } from 'vitest'
import { isKnownRoute, ROUTES } from '../src/routes.js'

describe('ROUTES', () => {
  it('lists the three site routes', () => {
    expect(ROUTES).toEqual({ home: '/', resume: '/resume', game: '/terminal-chaos' })
  })
})

describe('isKnownRoute', () => {
  it.each(['/', '/resume', '/resume/', '/terminal-chaos', '/terminal-chaos/'])('knows %s', (p) => {
    expect(isKnownRoute(p)).toBe(true)
  })

  it.each(['/nope', '/resumes', '/resume/x', '', '/terminal-chaos/x', '/a/b', '/Resume'])(
    'rejects %j',
    (p) => {
      expect(isKnownRoute(p)).toBe(false)
    },
  )
})
