import { expect, test } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const layouts = [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'mobile', viewport: { width: 375, height: 812 } },
] as const;

for (const layout of layouts) {
  test(`${layout.name}: a végleges tőketörlés megerősített, admin-only és listára navigál`, async ({ page }) => {
    const vineId = `vine-delete-e2e-${layout.name}`;
    const adminApp =
      getApps()[0]
      ?? initializeApp({ projectId: 'demo-esp32-e2e' });
    const reference = getFirestore(adminApp).doc(`vines/${vineId}`);
    const timestamp = Timestamp.fromDate(new Date('2026-08-30T08:00:00.000Z'));
    const document = {
      serialNumber: layout.name === 'desktop' ? 80 : 81,
      variety: layout.name === 'desktop' ? 'Törlendő desktop tőke' : 'Törlendő mobil tőke',
      hasFruited: false,
      rootType: 'own_rooted',
      rootstockVariety: '',
      plantingDate: { precision: 'year', year: 2025 },
      location: 'Telek',
      areaDescription: 'E2E veszélyzóna',
      status: 'active',
      tags: ['törlési teszt'],
      notes: 'A megszakításkor ennek változatlanul meg kell maradnia.',
      sourceCuttingId: null,
      photos: [],
      coverPhotoId: null,
      events: [
        {
          id: 'delete-event',
          type: 'observation',
          occurredAt: '2026-08-30T08:00:00.000Z',
          title: 'Törlendő esemény',
          notes: 'Törlendő eseményjegyzet',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      createdByUid: null,
    };
    await reference.set(document);
    await page.setViewportSize(layout.viewport);

    try {
      await page.goto(`/tokek/${vineId}`);
      const detail = page.getByTestId('vine-detail');
      await expect(detail.getByRole('heading', { name: document.variety })).toBeVisible();
      await expect(detail.getByRole('button', { name: 'Tőke végleges törlése' })).toHaveCount(0);

      if (layout.name === 'mobile') {
        await detail.getByRole('button', { name: 'Részletek bezárása' }).click();
      }
      await page.getByRole('button', { name: /Teszt admin/ }).click();
      if (layout.name === 'mobile') {
        await page.getByTestId('vine-card').filter({ hasText: document.variety }).click();
      }
      const deleteButton = detail.getByRole('button', { name: 'Tőke végleges törlése' });
      await deleteButton.scrollIntoViewIfNeeded();
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      let dialog = page.getByRole('dialog', { name: 'Tőke végleges törlésének megerősítése' });
      await expect(dialog.getByText(`Szőlőtőke #${document.serialNumber} – ${document.variety}`)).toBeVisible();
      await expect(dialog.getByText('az alapadatokat és az általános jegyzeteket;')).toBeVisible();
      await expect(dialog.getByText('az összes eseményt és eseményjegyzetet;')).toBeVisible();
      await expect(dialog.getByText('az összes eredeti fotót és bélyegképet.')).toBeVisible();
      await expect(dialog.getByText('A művelet nem vonható vissza.')).toBeVisible();
      await expect(page).toHaveScreenshot(`toke-vegleges-torles-${layout.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });

      await dialog.getByRole('button', { name: 'Mégse' }).click();
      await expect(dialog).toHaveCount(0);
      expect((await reference.get()).data()).toMatchObject(document);

      await deleteButton.click();
      dialog = page.getByRole('dialog', { name: 'Tőke végleges törlésének megerősítése' });
      await dialog.getByRole('button', { name: 'Igen, végleg törlöm' }).click();

      await expect(page).toHaveURL('/tokek');
      await expect(page.getByTestId('vine-card').filter({ hasText: document.variety })).toHaveCount(0);
      await expect.poll(async () => (await reference.get()).exists).toBe(false);

      await page.goto(`/tokek/${vineId}`);
      await expect(page).toHaveURL('/tokek');
      await expect(page.getByTestId('vine-detail').getByRole('heading', { name: document.variety })).toHaveCount(0);
    } finally {
      await reference.delete().catch(() => undefined);
    }
  });
}
