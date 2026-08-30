import { expect, test, type Route } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      projectId: process.env.GCLOUD_PROJECT || 'demo-esp32-e2e',
    });
  }
  return getFirestore();
}

test('a production tőkelista keres, szűr, rendez és URL-ben tartja az állapotot', async ({ page }) => {
  await page.goto('/tokek');

  await expect(page.getByRole('heading', { name: 'Tőkék' })).toBeVisible();
  await expect(page.getByTestId('vine-card')).toHaveCount(2);
  await expect(page.getByTestId('vine-card').first()).toContainText('Kékfrankos');
  await expect(page.getByTestId('vine-card').first()).not.toContainText('Déli kerítés mellett');
  await expect(page.getByTestId('vine-card').first()).not.toContainText('Termett már');

  await page.getByLabel('Keresés').fill('kerti út');
  await expect(page).toHaveURL(/q=kerti(?:\+|%20)%C3%BAt/);
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Irsai Olivér');

  await page.reload();
  await expect(page.getByLabel('Keresés')).toHaveValue('kerti út');
  await expect(page.getByTestId('vine-card')).toHaveCount(1);

  await page.getByRole('button', { name: /#2/ }).click();
  await expect(page).toHaveURL(/\/tokek\/vine-e2e-2\?q=/);
  await expect(page.getByRole('button', { name: /#2/ })).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await expect(page).toHaveURL(/\/tokek\?q=/);
  await expect(page.getByLabel('Keresés')).toHaveValue('kerti út');

  await page.getByRole('button', { name: /#2/ }).click();
  await page.getByRole('button', { name: 'Tőkék' }).click();
  await expect(page).toHaveURL(/\/tokek$/);
  await expect(page.getByLabel('Keresés')).toHaveValue('');
  await expect(page.getByRole('button', { name: /#2/ })).toHaveAttribute('aria-pressed', 'false');

  await page.getByLabel('Állapot').selectOption('ceased');
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Megszűnt');

  await page.getByRole('button', { name: 'Alaphelyzet' }).click();
  await page.getByLabel('Rendezés').selectOption('planting_desc');
  await expect(page.getByTestId('vine-card').first()).toContainText('Irsai Olivér');
  await page.getByLabel('Rendezés').selectOption('variety_asc');
  await expect(page.getByTestId('vine-card').first()).toContainText('Irsai Olivér');

  await page.getByLabel('Gyökérzet').selectOption('grafted');
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Kékfrankos');
  await page.getByLabel('Gyökérzet').selectOption('all');

  await page.getByLabel('Termés').selectOption('no');
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Irsai Olivér');
  await page.getByLabel('Termés').selectOption('all');

  await page.getByLabel('Helyszín').selectOption({ label: 'Erkély' });
  await expect(page).toHaveURL(/location=Erk%C3%A9ly/);
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Irsai Olivér');
  await page.reload();
  await expect(page.getByLabel('Helyszín')).toHaveValue('value:Erkély');
  await page.getByLabel('Helyszín').selectOption('all');

  await page.getByLabel('Állapot').selectOption('all');
  await page.getByLabel('Helyszín').selectOption('missing');
  await expect(page).toHaveURL(/(?:[?&])location=(?:&|$)/);
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Ismeretlen');
  await page.getByRole('button', { name: 'Alaphelyzet' }).click();

  await page.getByLabel('Címke').selectOption('déli sor');
  await expect(page.getByTestId('vine-card')).toHaveCount(1);
  await expect(page.getByTestId('vine-card')).toContainText('Kékfrankos');
});

test('az ismeretlen URL-helyszín üres találatként megmarad és visszaállítható', async ({ page }) => {
  await page.goto('/tokek?location=Neml%C3%A9tez%C5%91');

  await expect(page.getByLabel('Helyszín')).toHaveValue('value:Nemlétező');
  await expect(page.getByRole('status')).toContainText('Nincs találat');
  await page.reload();
  await expect(page.getByLabel('Helyszín')).toHaveValue('value:Nemlétező');
  await page.getByRole('button', { name: 'Alaphelyzet' }).click();
  await expect(page.getByTestId('vine-card')).toHaveCount(2);
});

test('a desktop és mobil tőkelista a prototípus elrendezését követi', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tokek');
  await expect(page.getByTestId('vine-card')).toHaveCount(2);

  const desktopWidth = await page.getByLabel('Tőkelista').evaluate((element) =>
    Math.round(element.getBoundingClientRect().width),
  );
  expect(desktopWidth).toBeLessThanOrEqual(320);
  await page.getByTestId('vine-card').filter({ hasText: '#1' }).click();
  await expect(page.getByTestId('vine-card').filter({ hasText: '#1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveScreenshot('tokelista-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/tokek');
  await expect(page.getByTestId('vine-card')).toHaveCount(2);
  const mobileList = page.getByLabel('Tőkelista');
  const mobileWidth = await mobileList.evaluate((element) =>
    Math.round(element.getBoundingClientRect().width),
  );
  expect(mobileWidth).toBeGreaterThan(320);
  await expect(page).toHaveScreenshot('tokelista-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
});

test('a tőkelista loading állapota desktopon és mobilon stabil', async ({ page }) => {
  let releaseFirestore!: () => void;
  const firestoreGate = new Promise<void>((resolve) => {
    releaseFirestore = resolve;
  });
  const holdFirestore = async (route: Route) => {
    await firestoreGate;
    await route.continue();
  };

  await page.route('http://127.0.0.1:8088/**', holdFirestore);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tokek');
    await expect(page.getByRole('status', { name: 'Tőkék betöltése' })).toBeVisible();
    await expect(page).toHaveScreenshot('tokelista-loading-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('status', { name: 'Tőkék betöltése' })).toBeVisible();
    await expect(page).toHaveScreenshot('tokelista-loading-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  } finally {
    releaseFirestore();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('az üres tőkekatalógus desktopon és mobilon érthető állapotot mutat', async ({ page }) => {
  const db = getAdminDb();
  const snapshot = await db.collection('vines').get();
  const vines = snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));

  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tokek');
    await expect(page.getByRole('status')).toContainText('Még nincs felvitt tőke.');
    await expect(page).toHaveScreenshot('tokelista-empty-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('status')).toContainText('Még nincs felvitt tőke.');
    await expect(page).toHaveScreenshot('tokelista-empty-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  } finally {
    await Promise.all(vines.map((vine) => db.doc(`vines/${vine.id}`).set(vine.data)));
  }
});
