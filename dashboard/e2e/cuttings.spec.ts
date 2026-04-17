import { expect, test } from '@playwright/test'

test('dugvany lista es reszletes nezet renderelodik', async ({ page }) => {
  await page.goto('/dugvanyok')

  await expect(page.getByRole('heading', { name: 'Dugványok' })).toBeVisible()
  await expect(page.getByText('Megfigyelő nézet. Új dugványt és képet csak admin tud rögzíteni.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Új dugvány' })).toHaveCount(0)

  const firstCard = page.getByRole('button', { name: /#1/ }).first()
  await expect(firstCard).toBeVisible()
  await expect(firstCard).toContainText('#1')
  await expect(firstCard).toContainText('Kékfrankos')
  await expect(firstCard).toContainText('Dugvány')
  await expect(firstCard).toContainText('Aktív')
  await firstCard.click()

  await expect(page.getByText('Dugvány #1')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kékfrankos' }).nth(1)).toBeVisible()
  await expect(page.getByText(/Kép 1\/1/)).toBeVisible()
  await expect(page.getByText('Esemény napló')).toBeVisible()
  await expect(page.getByText('Öntözés')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Szerkesztés', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Törlés', exact: true })).toHaveCount(0)
})
