import { expect, test } from '@playwright/test'

test('monitor es dugvanyok navigacio mukodik', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hőmérséklet' })).toBeVisible()

  await page.getByRole('button', { name: 'Dugványok' }).click()
  await expect(page).toHaveURL(/\/dugvanyok$/)
  await expect(page.getByRole('heading', { name: 'Dugványok' })).toBeVisible()

  await page.getByRole('button', { name: 'Monitor' }).click()
  await expect(page).toHaveURL(/\/(\?.*)?$/)
  await expect(page.getByRole('heading', { name: 'Hőmérséklet' })).toBeVisible()
})

test('direkt url-ek es browser vissza mukodik', async ({ page }) => {
  await page.goto('/dugvanyok')
  await expect(page.getByRole('heading', { name: 'Dugványok' })).toBeVisible()

  await page.goto('/dugvanyok/cutting-e2e-1')
  await expect(page.getByText('Dugvány #1')).toBeVisible()

  await page.goto('/')
  await page.getByRole('button', { name: 'Dugványok' }).click()
  await expect(page).toHaveURL(/\/dugvanyok$/)
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Hőmérséklet' })).toBeVisible()
})
