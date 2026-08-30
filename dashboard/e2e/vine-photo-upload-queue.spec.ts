import { devices, expect, test } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

test.use({ ...devices['Pixel 5'] });

test('mobilon három fotó kiválasztható az első feltöltés befejezése előtt', async ({ page }) => {
  test.setTimeout(60_000);
  const vineId = 'vine-upload-queue-e2e';
  const adminApp =
    getApps().find((app) => app.name === 'upload-queue-e2e')
    ?? initializeApp({ projectId: 'demo-esp32-e2e' }, 'upload-queue-e2e');
  const reference = getFirestore(adminApp).doc(`vines/${vineId}`);
  const timestamp = Timestamp.fromDate(new Date('2026-08-08T08:00:00.000Z'));
  await reference.set({
    serialNumber: 90,
    variety: 'Háttérteszt',
    hasFruited: false,
    rootType: 'own_rooted',
    rootstockVariety: '',
    plantingDate: { precision: 'unknown' },
    location: 'Telek',
    areaDescription: 'E2E sor',
    status: 'active',
    tags: [],
    notes: '',
    sourceCuttingId: null,
    photos: [],
    coverPhotoId: null,
    events: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUid: null,
  });

  let releaseUploads!: () => void;
  const uploadsMayContinue = new Promise<void>((resolve) => {
    releaseUploads = resolve;
  });
  let blockedUploadRequests = 0;

  try {
    await page.goto(`/tokek/${vineId}`);
    await page.getByRole('button', { name: /Teszt admin/ }).click();
    const detail = page.getByTestId('vine-detail');
    const gallery = detail.getByRole('region', { name: 'Fotók' });
    const input = gallery.locator('input[type="file"]');
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=',
      'base64',
    );

    await page.route('http://127.0.0.1:9199/**', async (route) => {
      blockedUploadRequests += 1;
      await uploadsMayContinue;
      await route.continue();
    });

    for (const name of ['elso.png', 'masodik.png', 'harmadik.png']) {
      await input.setInputFiles({ name, mimeType: 'image/png', buffer: pixel });
      await expect(gallery.getByRole('button', { name: 'Fotózás' })).toBeEnabled();
    }

    await expect(gallery.getByText('Feltöltés alatt (3)')).toBeVisible();
    await expect(gallery.getByText('Fotók (0)')).toBeVisible();
    await expect(page.getByText('3 fotó feltöltése')).toBeVisible();
    await expect.poll(() => blockedUploadRequests).toBe(2);
    await gallery.getByLabel('Feltöltés alatt').scrollIntoViewIfNeeded();
    await expect(page).toHaveScreenshot('toke-feltoltesi-sor-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });

    await detail.getByRole('button', { name: 'Részletek bezárása' }).click();
    await page.getByRole('button', { name: 'Monitor' }).click();
    await expect(page.getByText('3 fotó feltöltése')).toBeVisible();

    releaseUploads();
    await expect(page.getByText('3 fotó feltöltése')).toHaveCount(0, { timeout: 30_000 });
    await page.getByRole('button', { name: 'Tőkék' }).click();
    await page.getByTestId('vine-card').filter({ hasText: 'Háttérteszt' }).click();
    await expect(page.getByRole('region', { name: 'Fotók' }).getByText('Fotók (3)')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Fotók' }).getByRole('button', {
        name: 'Háttérteszt fotó megnyitása',
      }),
    ).toHaveCount(3);
  } finally {
    releaseUploads();
    await reference.delete().catch(() => undefined);
  }
});
