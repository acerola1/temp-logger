import { expect, test } from '@playwright/test';

test('az admin tőkét hoz létre, majd a sorszám változtatása nélkül szerkeszti és visszaaktiválja', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/tokek');
  await page.getByRole('button', { name: 'Teszt admin belépés' }).click();
  await expect(page.locator('[data-access-mode="admin"]')).toBeVisible();

  await page.getByRole('button', { name: 'Új tőke' }).click();
  const createForm = page.getByRole('form', { name: 'Szőlőtőke #4 űrlap' });
  await expect(createForm.getByText('#4', { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('toke-urlap-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(createForm).toBeVisible();
  await expect(page).toHaveScreenshot('toke-urlap-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await createForm.locator('[name="variety"]').fill('  Cabernet franc  ');
  await createForm.locator('[name="rootType"]').selectOption('grafted');
  await createForm.locator('[name="rootstockVariety"]').fill('  Teleki 5C  ');
  await createForm.locator('[name="plantingDatePrecision"]').selectOption('year');
  await createForm.locator('[name="plantingYear"]').fill('2025');
  await createForm.locator('[name="sourceCuttingId"]').selectOption('cutting-e2e-1');
  await createForm.locator('[name="areaDescription"]').fill('  Nyugati támrendszer  ');
  await createForm.locator('[name="tags"]').fill('új, teszt');
  await createForm.locator('[name="hasFruited"]').check();
  await createForm.locator('[name="notes"]').fill('Első production űrlapos tőke.');
  await createForm.getByRole('button', { name: 'Mentés' }).click();

  await expect(page).toHaveURL(/\/tokek\/[^?]+$/);
  await expect(page.getByText('Szőlőtőke #4')).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByRole('heading', { name: 'Cabernet franc' })).toBeVisible();
  await expect(page.getByText('2025', { exact: true })).toBeVisible();
  await expect(page.getByText('#1 - Kékfrankos')).toBeVisible();

  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();
  let editForm = page.getByRole('form', { name: 'Szőlőtőke #4 űrlap' });
  await expect(editForm.getByText('#4', { exact: true })).toBeVisible();
  await editForm.locator('[name="variety"]').fill('Cabernet Franc');
  await editForm.locator('[name="status"]').selectOption('ceased');
  await editForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(page.getByTestId('vine-detail').getByText('Megszűnt', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();
  editForm = page.getByRole('form', { name: 'Szőlőtőke #4 űrlap' });
  await editForm.locator('[name="status"]').selectOption('active');
  await editForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(page.getByTestId('vine-detail').getByText('Aktív', { exact: true })).toBeVisible();
  await expect(page.getByText('Szőlőtőke #4')).toBeVisible();

  await page.getByRole('button', { name: 'Új esemény' }).click();
  const cessationForm = page.getByRole('form', { name: 'Új tőkeesemény' });
  await cessationForm.locator('[name="type"]').selectOption('ceased');
  await cessationForm.locator('[name="title"]').fill('E2E megszűnés');
  await cessationForm.getByRole('button', { name: 'Esemény mentése (1)' }).click();
  const cessationEvent = page.getByTestId('vine-event').filter({ hasText: 'E2E megszűnés' });
  await expect(cessationEvent).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByText('Megszűnt', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await cessationEvent.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(cessationEvent).toHaveCount(0);
  await expect(page.getByTestId('vine-detail').getByText('Megszűnt', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();
  editForm = page.getByRole('form', { name: 'Szőlőtőke #4 űrlap' });
  await editForm.locator('[name="status"]').selectOption('active');
  await editForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(page.getByTestId('vine-detail').getByText('Aktív', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Új esemény' }).click();
  const addEventForm = page.getByRole('form', { name: 'Új tőkeesemény' });
  const firstVineTarget = addEventForm.getByRole('checkbox', { name: '#1 - Kékfrankos' });
  await firstVineTarget.check();
  await expect(firstVineTarget).toBeChecked();
  await addEventForm.locator('[name="type"]').selectOption('pruning');
  await addEventForm.locator('[name="title"]').fill('Közös metszés');
  await addEventForm.locator('[name="notes"]').fill('Két külön eseménypéldány.');
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=',
    'base64',
  );
  await addEventForm.locator('input[type="file"]').setInputFiles([
    { name: 'metszes-1.png', mimeType: 'image/png', buffer: pixel },
    { name: 'metszes-2.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(addEventForm.getByText('2/6 fotó kiválasztva')).toBeVisible();
  await addEventForm.getByRole('button', { name: 'Esemény mentése (2)' }).click();
  await expect(addEventForm).toHaveCount(0);

  const createdEvent = page.getByTestId('vine-event').filter({ hasText: 'Közös metszés' });
  await expect(createdEvent).toBeVisible();
  await expect(
    createdEvent.getByRole('button', { name: /Közös metszés \d+\. fotó megnyitása/ }),
  ).toHaveCount(2);

  // Utólagos fotókezelés a már mentett eseményen: felvétel, aláírás, egyedi törlés.
  const eventPhotos = createdEvent.getByRole('list', { name: 'Közös metszés fotói' });
  await expect(createdEvent.getByText('Fotók 2/12')).toBeVisible();
  await createdEvent.locator('input[type="file"]').setInputFiles([
    { name: 'metszes-3.png', mimeType: 'image/png', buffer: pixel },
    { name: 'metszes-4.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(createdEvent.getByText('Fotók 4/12')).toBeVisible();
  await expect(eventPhotos.getByRole('listitem')).toHaveCount(4);

  await createdEvent
    .getByRole('button', { name: 'Közös metszés 3. fotó képaláírásának szerkesztése' })
    .click();
  await createdEvent
    .getByRole('textbox', { name: 'Közös metszés 3. fotó képaláírása' })
    .fill('  Utólag pótolt kép  ');
  await expect(page).toHaveScreenshot('toke-esemeny-foto-alairas-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await createdEvent.getByRole('button', { name: 'Aláírás mentése' }).click();
  await expect(createdEvent.getByText('Utólag pótolt kép', { exact: true })).toBeVisible();

  await expect(page).toHaveScreenshot('toke-esemeny-fotosor-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await createdEvent.scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot('toke-esemeny-fotosor-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  // A mentett felirat a közös nézőben is megjelenik.
  await createdEvent.getByRole('button', { name: 'Közös metszés 3. fotó megnyitása' }).click();
  const eventPhotoViewer = page.getByRole('dialog', { name: 'Eseményfotó' });
  await expect(eventPhotoViewer.getByText(/Utólag pótolt kép/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(eventPhotoViewer).toHaveCount(0);

  page.once('dialog', (dialog) => void dialog.accept());
  await createdEvent.getByRole('button', { name: 'Közös metszés 1. fotó törlése' }).click();
  await expect(eventPhotos.getByRole('listitem')).toHaveCount(3);
  await expect(createdEvent.getByText('Fotók 3/12')).toBeVisible();
  // A felirat a megmaradt fotón marad, a törlés nem tolta el a rekordokat.
  await expect(createdEvent.getByText('Utólag pótolt kép', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /#1 Kékfrankos/ }).click();
  const copiedEvent = page.getByTestId('vine-event').filter({ hasText: 'Közös metszés' });
  await copiedEvent.getByRole('button', { name: 'Szerkesztés', exact: true }).click();
  const editEventForm = page.getByRole('form', { name: 'Tőkeesemény szerkesztése' });
  await editEventForm.locator('[name="title"]').fill('Csak az első tőkén szerkesztve');
  await editEventForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(page.getByText('Csak az első tőkén szerkesztve')).toBeVisible();

  await page.getByRole('button', { name: /#4 Cabernet Franc/ }).click();
  await expect(page.getByText('Közös metszés')).toBeVisible();
  await expect(page.getByText('Csak az első tőkén szerkesztve')).toHaveCount(0);

  await page.getByRole('button', { name: /#1 Kékfrankos/ }).click();
  const editedEvent = page.getByTestId('vine-event').filter({ hasText: 'Csak az első tőkén szerkesztve' });
  page.once('dialog', (dialog) => void dialog.accept());
  await editedEvent.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(editedEvent).toHaveCount(0);

  await page.getByLabel('Állapot').selectOption('all');
  await page.getByRole('button', { name: /#3 Ismeretlen/ }).click();
  await page.getByRole('button', { name: 'Új esemény' }).click();
  const ceasedEventForm = page.getByRole('form', { name: 'Új tőkeesemény' });
  await expect(ceasedEventForm.getByText('#3 - Ismeretlen')).toBeVisible();
  await expect(ceasedEventForm.getByText('#2 - Irsai Olivér')).toBeVisible();
  await expect(ceasedEventForm.getByText('#1 - Kékfrankos')).toBeVisible();
  await ceasedEventForm.locator('[name="title"]').fill('Utólagos állapotfelmérés');
  await ceasedEventForm.getByRole('button', { name: 'Esemény mentése (1)' }).click();
  await expect(page.getByText('Utólagos állapotfelmérés')).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByText('Megszűnt', { exact: true })).toBeVisible();
});
