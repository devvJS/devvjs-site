import { test, expect } from 'vitest'

// Deliberately failing: proves the required checks block a merge. This PR gets closed.
test('required checks block a red PR', () => {
  expect(1).toBe(2)
})
