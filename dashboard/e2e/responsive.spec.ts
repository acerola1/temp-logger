import { expect, test } from '@playwright/test'

test('mobil viewporton alap layout mukodik', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/dugvanyok')

  await expect(page.getByRole('button', { name: 'Monitor' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dugványok' })).toBeVisible()
  const firstCard = page.getByRole('button', { name: /#1/ }).first()
  await firstCard.click()

  const closeButton = page.getByLabel('Részletek bezárása')
  await expect(closeButton).toBeVisible()
  const detailScroller = closeButton
    .locator('xpath=ancestor::div[contains(@class,"overflow-y-auto")]')
    .first()
  const didScroll = await detailScroller.evaluate((el) => {
    el.scrollTop = 240
    return el.scrollTop > 0
  })
  expect(didScroll).toBeTruthy()
})

test('tablet viewporton dugvany oldal mukodik', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/dugvanyok')

  await expect(page.getByRole('heading', { name: 'Dugványok' })).toBeVisible()
  await expect(page.getByRole('button', { name: /#1/ }).first()).toBeVisible()
})
