import { expect, test, type Page } from '@playwright/test'

async function openSeededCutting(page: Page) {
  await page.goto('/dugvanyok/cutting-e2e-1')
  await expect(page.getByRole('heading', { name: 'Kékfrankos' }).nth(1)).toBeVisible()
  return page.getByRole('region', { name: 'Fotók' })
}

async function assertPublicGallery(page: Page) {
  const gallery = page.getByRole('region', { name: 'Fotók' })
  await expect(gallery.getByText('Fotók (1)')).toBeVisible()
  await expect(gallery.getByText('Kép 1/1')).toBeVisible()
  await expect(gallery.getByText('seed')).toBeVisible()
  await expect(gallery.getByRole('button', { name: 'Fotó hozzáadása' })).toHaveCount(0)
  await expect(gallery.getByRole('button', { name: 'Képaláírás szerkesztése' })).toHaveCount(0)
  await expect(gallery.getByRole('button', { name: 'Törlés' })).toHaveCount(0)
}

async function assertAdminGallery(page: Page) {
  const gallery = page.getByRole('region', { name: 'Fotók' })
  await expect(gallery.getByRole('button', { name: 'Fotó hozzáadása' })).toBeVisible()
  await expect(gallery.getByRole('button', { name: 'Képaláírás szerkesztése' })).toBeVisible()
  await expect(gallery.getByRole('button', { name: 'Törlés' })).toBeVisible()
  await expect(gallery.getByRole('button', { name: 'Borítóképnek' })).toHaveCount(0)
}

test('dugványgaléria publikus és admin állapota desktopon és mobilon', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openSeededCutting(page)
  await assertPublicGallery(page)
  await expect(page).toHaveScreenshot('dugvanygaleria-public-desktop.png', {
    animations: 'disabled',
    fullPage: true,
  })

  await page.setViewportSize({ width: 375, height: 812 })
  await assertPublicGallery(page)
  await expect(page).toHaveScreenshot('dugvanygaleria-public-mobile.png', {
    animations: 'disabled',
    fullPage: true,
  })

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Teszt admin belépés' }).click()
  await assertAdminGallery(page)
  await expect(page).toHaveScreenshot('dugvanygaleria-admin-desktop.png', {
    animations: 'disabled',
    fullPage: true,
  })

  await page.setViewportSize({ width: 375, height: 812 })
  await assertAdminGallery(page)
  await expect(page).toHaveScreenshot('dugvanygaleria-admin-mobile.png', {
    animations: 'disabled',
    fullPage: true,
  })
})
