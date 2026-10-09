import { test, expect } from '@playwright/test'

const status = (page) => page.getByTestId('tc-status')
const canvasData = (page) => page.locator('canvas').evaluate((c) => c.toDataURL())

// Every test fails on any console error or uncaught page error.
function watchErrors(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

test('direct GET /terminal-chaos answers 200', async ({ page }) => {
  const res = await page.request.get('/terminal-chaos')
  expect(res.status()).toBe(200)
  const res2 = await page.goto('/terminal-chaos')
  expect(res2.status()).toBe(200)
  await expect(page.getByTestId('terminal-chaos')).toBeVisible()
  await expect(page.getByTestId('not-found')).toHaveCount(0)
})

test('the game page has no site Navbar or Footer', async ({ page }) => {
  await page.goto('/terminal-chaos')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.locator('header')).toHaveCount(0)
  await expect(page.locator('footer')).toHaveCount(0)
})

test('the 404 page leads into the game', async ({ page }) => {
  // Chromium always logs "Failed to load resource ... 404" for a 404 document.
  // Ignore only that one message, for the 404 page's own URL; fail on anything else.
  const errors = []
  const notFoundUrl = new URL('/some/unknown/path', test.info().project.use.baseURL).href
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (m.text().includes('Failed to load resource') && m.location().url === notFoundUrl) return
    errors.push(`console: ${m.text()}`)
  })
  await page.goto('/some/unknown/path')
  await page.getByRole('link', { name: 'Waste time ->' }).click()
  await expect(page).toHaveURL(/\/terminal-chaos$/)
  await expect(page.locator('canvas')).toBeVisible()
  await expect(status(page)).toContainText('Terminal Chaos')
  await expect(status(page)).toContainText('Press Enter / Tap to start')
  expect(errors).toEqual([])
})

test('Enter starts level 1', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/terminal-chaos')
  await expect(status(page)).toContainText('Press Enter')
  await page.keyboard.press('Enter')
  await expect(status(page)).toContainText('Level 1: The Editor')
  expect(errors).toEqual([])
})

test('holding ArrowRight (with jumps) moves Devv far enough to collect a token', async ({ page }) => {
  test.setTimeout(45000)
  const errors = watchErrors(page)
  await page.goto('/terminal-chaos')
  // DELIBERATE: Enter is pressed before the title shows. It guards the early-key replay
  // in App.jsx (keys typed while the lazy chunk loads must still reach the game).
  await page.keyboard.press('Enter')
  await expect(status(page)).toContainText('Level 1: The Editor')
  const before = await canvasData(page)
  const score = async () => Number(/Score (\d+)/.exec(await status(page).textContent())[1])
  expect(await score()).toBe(0)
  // Only real movement collects a token (the canvas repaints every frame regardless, so a
  // pixel diff alone proves nothing). Poll up to 15 s; the first token is about 2 s in.
  await page.keyboard.down('ArrowRight')
  let reached = 0
  for (let i = 0; i < 60 && reached === 0; i++) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(250)
    reached = await score()
  }
  await page.keyboard.up('ArrowRight')
  expect(reached).toBeGreaterThan(0)
  expect(await canvasData(page)).not.toBe(before)
  expect(errors).toEqual([])
})

test('the mute choice is remembered across a reload', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/terminal-chaos')
  const toggle = page.getByRole('button', { name: 'Toggle sound' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('m')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Toggle sound' })).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => localStorage.getItem('tc:muted'))).toBe('false')
  expect(errors).toEqual([])
})

test('Escape pauses and Escape again resumes', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/terminal-chaos')
  // DELIBERATE: Enter before the title shows guards the early-key replay (see above).
  await page.keyboard.press('Enter')
  await expect(status(page)).toContainText('Level 1: The Editor')
  await page.keyboard.press('Escape')
  await expect(status(page)).toContainText('Paused')
  await page.keyboard.press('Escape')
  await expect(status(page)).toContainText('Level 1: The Editor')
  await expect(status(page)).not.toContainText('Paused')
  expect(errors).toEqual([])
})

test('M toggles mute (muted by default)', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/terminal-chaos')
  const toggle = page.getByRole('button', { name: 'Toggle sound' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('m')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('m')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect(errors).toEqual([])
})

test('"<- Back to devvjs.dev" works from the keyboard', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/terminal-chaos')
  const back = page.getByRole('link', { name: '<- Back to devvjs.dev' })
  await expect(back).toBeVisible()
  await back.focus()
  // Game page must be quiet; the home page's own /api/github-stats 500 is not the game's.
  expect(errors).toEqual([])
  await page.keyboard.press('Enter')
  await page.waitForURL((u) => u.pathname === '/')
  await expect(page.locator('#hero')).toBeVisible()
})

test.describe('on a 320x568 touch phone', () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true })

  test('the touch buttons are visible, inside the viewport and do not overlap', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/terminal-chaos')
    await expect(page.locator('canvas')).toBeVisible()
    const names = ['Left', 'Right', 'Jump', 'echo', 'sudo', 'rm -rf', 'Pause', 'Mute']
    const boxes = []
    for (const name of names) {
      const btn = page.getByRole('button', { name, exact: true })
      await expect(btn, name).toBeVisible()
      const b = await btn.boundingBox()
      expect(b, name).not.toBeNull()
      expect(b.x, `${name} left edge`).toBeGreaterThanOrEqual(0)
      expect(b.y, `${name} top edge`).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width, `${name} right edge`).toBeLessThanOrEqual(320)
      expect(b.y + b.height, `${name} bottom edge`).toBeLessThanOrEqual(568)
      boxes.push({ name, ...b })
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
        expect(overlap, `${a.name} overlaps ${b.name}`).toBe(false)
      }
    }
    expect(errors).toEqual([])
  })
})
