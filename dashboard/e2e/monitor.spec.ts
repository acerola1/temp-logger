import { expect, test } from '@playwright/test'

test('monitor oldal alap render + idosav valtas + tooltip', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Monitor' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hőmérséklet' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Páratartalom' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Utolsó mérések' })).toBeVisible()

  await expect
    .poll(async () => page.locator('svg').count(), { timeout: 20_000 })
    .toBeGreaterThan(0)

  await page.getByRole('button', { name: '7 nap' }).click()
  await expect(page).toHaveURL(/range=7d/)
  await page.getByRole('button', { name: '30 nap' }).click()
  await expect(page).toHaveURL(/range=30d/)

  const tempCard = page
    .getByRole('heading', { name: 'Hőmérséklet' })
    .locator('xpath=ancestor::div[1]')
  await expect
    .poll(async () => tempCard.locator('svg path.recharts-curve').count())
    .toBeGreaterThan(0)

  const eventMarker = tempCard.getByRole('button', { name: 'Permetezés' }).first()
  await expect(eventMarker).toBeVisible()

  const chartSurface = tempCard.locator('svg').first()
  await expect(chartSurface).toBeVisible()
  const box = await chartSurface.boundingBox()
  if (!box) {
    throw new Error('Nem található chart bounding box.')
  }

  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45)
  await expect(tempCard.getByText(/Hőmérséklet\s*:/)).toBeVisible()
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45)
  await expect(tempCard.getByLabel('Kijelölés bezárása')).toBeVisible()

  await page.mouse.click(10, 10)
  await expect(tempCard.getByLabel('Kijelölés bezárása')).toBeHidden()
})
