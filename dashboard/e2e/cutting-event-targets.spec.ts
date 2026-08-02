import { expect, test } from '@playwright/test'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const ACTIVE_ID = 'cutting-e2e-target-active'
const ARCHIVED_ID = 'cutting-e2e-target-archived'
const LOST_ID = 'cutting-e2e-target-lost'
const seededIds = [ACTIVE_ID, ARCHIVED_ID, LOST_ID]

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-esp32-e2e',
    })
  }
  return getFirestore()
}

function cuttingDoc(serialNumber: number, variety: string, status: string) {
  const now = new Date().toISOString()
  return {
    serialNumber,
    variety,
    plantType: 'cutting',
    plantedAt: now,
    status,
    notes: '',
    categories: [],
    photos: [],
    events: [],
    createdAt: now,
    updatedAt: now,
    createdByUid: null,
  }
}

test.beforeAll(async () => {
  const db = getAdminDb()
  await Promise.all([
    db.doc(`cuttings/${ACTIVE_ID}`).set(cuttingDoc(901, 'E2E Aktiv', 'active')),
    db.doc(`cuttings/${ARCHIVED_ID}`).set(cuttingDoc(902, 'E2E Archivalt', 'archived')),
    db.doc(`cuttings/${LOST_ID}`).set(cuttingDoc(903, 'E2E Elpusztult', 'lost')),
  ])
})

test.afterAll(async () => {
  const db = getAdminDb()
  await Promise.all(
    seededIds.map((cuttingId) => db.doc(`cuttings/${cuttingId}`).delete().catch(() => undefined)),
  )
})

test('az uj esemeny erintett dugvanyok listaja csak aktiv egyedeket kinal', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto(`/dugvanyok/${ACTIVE_ID}`)
  await page.getByRole('button', { name: 'Teszt admin belépés' }).click()
  await expect(page.getByRole('button', { name: 'Új dugvány' })).toBeVisible()
  await expect(page.getByText('Dugvány #901')).toBeVisible()

  await page.getByRole('button', { name: 'Új esemény' }).click()

  const eventForm = page.locator('form').filter({ hasText: 'Érintett dugványok' }).first()
  const targetList = eventForm.locator('div.max-h-48')
  await expect(targetList).toBeVisible()

  await expect(targetList.getByText(/#901/)).toHaveCount(1)
  await expect(targetList.getByText(/#902/)).toHaveCount(0)
  await expect(targetList.getByText(/#903/)).toHaveCount(0)

  const targetOptions = targetList.locator('label')
  const optionCount = await targetOptions.count()
  expect(optionCount).toBeGreaterThan(0)

  await eventForm.getByRole('button', { name: 'Mind' }).click()
  await expect(eventForm.getByRole('button', { name: `Esemény mentése (${optionCount})` })).toBeVisible()
  await expect(targetList.locator('input[type="checkbox"]:checked')).toHaveCount(optionCount)

  await eventForm.getByRole('button', { name: 'Törlés', exact: true }).click()
  await expect(eventForm.getByRole('button', { name: 'Esemény mentése (0)' })).toBeVisible()
})

test('archivalt dugvany sajat naplojahoz meg rogzitheto esemeny', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto(`/dugvanyok/${ARCHIVED_ID}`)
  await page.getByRole('button', { name: 'Teszt admin belépés' }).click()
  await expect(page.getByRole('button', { name: 'Új dugvány' })).toBeVisible()
  await expect(page.getByText('Dugvány #902')).toBeVisible()

  await page.getByRole('button', { name: 'Új esemény' }).click()

  const eventForm = page.locator('form').filter({ hasText: 'Érintett dugványok' }).first()
  const targetList = eventForm.locator('div.max-h-48')

  await expect(targetList.getByText(/#902/)).toHaveCount(1)
  await expect(targetList.getByText(/#903/)).toHaveCount(0)
  await expect(eventForm.getByRole('button', { name: 'Esemény mentése (1)' })).toBeVisible()
})
