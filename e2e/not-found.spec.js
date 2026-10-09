import { test, expect } from '@playwright/test'

test('an unknown path answers 404 and shows the 404 page', async ({ page }) => {
  const response = await page.goto('/some/unknown/path')
  expect(response.status()).toBe(404)
  await expect(page.getByRole('heading', { name: '404 Not Found' })).toBeVisible()
  await expect(page.getByText('This is not the page you are looking for')).toBeVisible()
})

test('the heading is centered in the viewport', async ({ page }) => {
  await page.goto('/some/unknown/path')
  const heading = page.getByRole('heading', { name: '404 Not Found' })
  await expect(heading).toBeVisible()
  const box = await heading.boundingBox()
  const vp = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  expect(Math.abs(cx - vp.width / 2)).toBeLessThanOrEqual(vp.width * 0.1)
  expect(Math.abs(cy - vp.height / 2)).toBeLessThanOrEqual(vp.height * 0.1)
})

test('"<- Go back" leads home', async ({ page }) => {
  await page.goto('/some/unknown/path')
  await page.getByRole('link', { name: '<- Go back' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(new URL(page.url()).pathname).toBe('/')
  await expect(page.locator('#hero')).toBeVisible()
  await expect(page.getByTestId('not-found')).toHaveCount(0)
})

test('"Waste time ->" points at the game', async ({ page }) => {
  await page.goto('/some/unknown/path')
  const link = page.getByRole('link', { name: 'Waste time ->' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/terminal-chaos')
})
