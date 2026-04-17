import { expect, test } from '@playwright/test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const createdCuttingIds: string[] = []
const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=',
  'base64',
)

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-esp32-e2e',
    })
  }
  return getFirestore()
}

test.afterAll(async () => {
  if (createdCuttingIds.length === 0) {
    return
  }

  const db = getAdminDb()
  await Promise.all(
    createdCuttingIds.map((cuttingId) => db.doc(`cuttings/${cuttingId}`).delete().catch(() => undefined)),
  )
})

test('admin CRUD: uj dugvany + foto + ontozesi log + session esemeny', async ({ page }) => {
  test.setTimeout(60_000)

  const unique = `E2E CRUD ${Date.now()}`
  const updated = `${unique} modositva`
  const wateringTitle = `E2E ontzes ${Date.now()}`
  const editedWateringTitle = `${wateringTitle} szerkesztve`
  const sessionEventTitle = `Session e2e ${Date.now()}`

  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.goto('/dugvanyok')
  await page.getByRole('button', { name: 'Teszt admin belépés' }).click()
  await expect(page.getByRole('button', { name: 'Új dugvány' })).toBeVisible()

  await page.getByRole('button', { name: 'Új dugvány' }).click()
  await page.getByPlaceholder('pl. Kékfrankos').fill(unique)
  await page.getByRole('button', { name: 'Mentés' }).first().click()

  const createdCard = page.getByRole('button', { name: new RegExp(unique) }).first()
  await expect(createdCard).toBeVisible()
  await createdCard.click()
  await expect(page.getByRole('heading', { name: unique }).nth(1)).toBeVisible()
  const createdId = page.url().split('/dugvanyok/')[1]?.split('?')[0]
  if (createdId) {
    createdCuttingIds.push(createdId)
  }

  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click()
  const editInput = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Mégse' }) })
    .first()
    .locator('input')
    .first()
  await editInput.fill(updated)
  await page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Mégse' }) })
    .first()
    .getByRole('button', { name: 'Mentés' })
    .click()
  await expect(page.getByRole('heading', { name: updated }).nth(1)).toBeVisible()

  await page
    .locator('label:has-text("Fotó hozzáadása") input[type="file"]')
    .first()
    .setInputFiles({
      name: 'upload.png',
      mimeType: 'image/png',
      buffer: onePixelPng,
    })
  await expect(page.getByText(/Kép 1\/1/)).toBeVisible()
  await page.getByRole('button', { name: 'Törlés', exact: true }).first().click()
  await expect(page.getByText('Ehhez a dugványhoz még nincs feltöltött kép.')).toBeVisible()

  await page.getByRole('button', { name: 'Új esemény' }).click()
  await page.getByPlaceholder('pl. Permetezés').fill(wateringTitle)
  await page.getByRole('button', { name: /Esemény mentése/ }).click()
  await expect(page.getByText(wateringTitle)).toBeVisible()

  const eventRow = page.locator('div.rounded-2xl').filter({ hasText: wateringTitle }).first()
  await eventRow.getByRole('button', { name: 'Szerkesztés', exact: true }).click()
  const eventEditForm = page
    .locator('form')
    .filter({ has: page.getByText('Cím') })
    .last()
  await eventEditForm
    .locator('label')
    .filter({ hasText: 'Cím' })
    .locator('input')
    .fill(editedWateringTitle)
  await eventEditForm.getByRole('button', { name: 'Mentés' }).click()
  await expect(page.getByText(editedWateringTitle)).toBeVisible()

  const editedRow = page.locator('div.rounded-2xl').filter({ hasText: editedWateringTitle }).first()
  await editedRow.getByRole('button', { name: 'Törlés', exact: true }).click()
  await expect(page.getByText(editedWateringTitle)).toHaveCount(0)

  await page.getByRole('button', { name: 'Monitor' }).click()
  await expect(page.getByRole('heading', { name: 'Hőmérséklet' })).toBeVisible()
  await page.getByRole('button', { name: /\d+\s+esemény/ }).first().click()

  const sessionDialog = page
    .getByRole('heading', { name: 'Session események' })
    .locator('xpath=ancestor::div[contains(@class,"max-w-3xl")]')
    .first()
  await expect(sessionDialog).toBeVisible()
  await sessionDialog.getByRole('button', { name: 'Új esemény' }).click()
  await sessionDialog.getByPlaceholder('pl. Átrakva a másik sátorba').fill(sessionEventTitle)
  await sessionDialog.getByRole('button', { name: 'Esemény mentése' }).click()
  await expect(sessionDialog.getByText(sessionEventTitle)).toBeVisible()

  const sessionEventRow = sessionDialog
    .locator('div.rounded-2xl')
    .filter({ hasText: sessionEventTitle })
    .first()
  await sessionEventRow.getByRole('button', { name: 'Törlés', exact: true }).click()
  await expect(sessionDialog.getByText(sessionEventTitle)).toHaveCount(0)
})
