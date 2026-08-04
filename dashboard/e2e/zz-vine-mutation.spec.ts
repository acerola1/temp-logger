import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { expect, test, type Locator } from '@playwright/test';

test.describe.configure({ retries: 0 });

const FIXED_TIMESTAMP = '2026-08-03T16:45:00Z';
const FIXED_VINE_TIMESTAMP = '2026-08-03T16:45:59Z';

async function stabilizeVineTimestamps(
  vineId: string,
  detail: Locator,
) {
  const adminApp =
    getApps().find((app) => app.name === 'e2e-mutation') ??
    initializeApp({ projectId: 'demo-esp32-e2e' }, 'e2e-mutation');
  const timestamp = Timestamp.fromDate(new Date(FIXED_VINE_TIMESTAMP));

  await getFirestore(adminApp).doc(`vines/${vineId}`).update({
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await expect(
    detail.locator('dt', { hasText: 'Módosítva' }).locator('xpath=following-sibling::dd'),
  ).toHaveText('2026.08.03. 18:45');
}

test('az admin tőkét hoz létre, majd a sorszám változtatása nélkül szerkeszti és visszaaktiválja', async ({ page }) => {
  test.setTimeout(60_000);
  await page.clock.setFixedTime(new Date(FIXED_TIMESTAMP));
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
  const createdVineId = new URL(page.url()).pathname.split('/').at(-1)!;
  const vineDetail = page.getByTestId('vine-detail');
  await expect(page.getByText('Szőlőtőke #4')).toBeVisible();
  await expect(vineDetail.getByRole('heading', { name: 'Cabernet franc' })).toBeVisible();
  await expect(page.getByText('2025', { exact: true })).toBeVisible();
  await expect(page.getByText('#1 - Kékfrankos')).toBeVisible();

  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();
  let editForm = page.getByRole('form', { name: 'Szőlőtőke #4 űrlap' });
  await expect(editForm.getByText('#4', { exact: true })).toBeVisible();
  await editForm.locator('[name="variety"]').fill('Cabernet Franc');
  await editForm.locator('[name="status"]').selectOption('ceased');
  await editForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(editForm).toHaveCount(0);
  await expect(page.getByTestId('vine-detail').getByText('Megszűnt', { exact: true })).toBeVisible();
  // Sikeres mentés után az olvasó nézet hiánytalanul visszatér, a mentett értékkel
  // és egy frissült `Módosítva` időponttal.
  await expect(vineDetail.getByTestId('vine-meta')).toBeVisible();
  await expect(vineDetail.getByTestId('vine-notes')).toBeVisible();
  await expect(vineDetail.getByRole('heading', { name: 'Cabernet Franc' })).toBeVisible();
  // A szerver írja az `updatedAt`-ot, ezért a formátumra horgonyzunk: a perces
  // felbontáson a mentés előtti érték is ugyanaz lehetne.
  await expect(
    vineDetail.locator('dt', { hasText: 'Módosítva' }).locator('xpath=following-sibling::dd'),
  ).toHaveText(/^\d{4}\.\d{2}\.\d{2}\. \d{2}:\d{2}$/);

  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();
  editForm = page.getByRole('form', { name: 'Szőlőtőke #4 űrlap' });
  await editForm.locator('[name="status"]').selectOption('active');
  await editForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(editForm).toHaveCount(0);
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
  await expect(editForm).toHaveCount(0);
  await expect(page.getByTestId('vine-detail').getByText('Aktív', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Új esemény' }).click();
  const addEventForm = page.getByRole('form', { name: 'Új tőkeesemény' });
  // A második célt a dialógusban jelöljük ki; a nyitott tőke már be van jelölve.
  await expect(addEventForm.getByText('1 tőke kiválasztva')).toBeVisible();
  await addEventForm.getByRole('button', { name: 'Kiválasztás…' }).click();
  const targetPicker = page.getByRole('dialog', { name: 'Érintett tőkék kiválasztása' });
  const firstVineTarget = targetPicker.getByRole('checkbox', { name: '#1 - Kékfrankos' });
  await firstVineTarget.check();
  await expect(firstVineTarget).toBeChecked();
  await expect(targetPicker.getByText('2 kiválasztva')).toBeVisible();
  await targetPicker.getByRole('button', { name: 'Kész' }).click();
  await expect(targetPicker).toHaveCount(0);
  await expect(addEventForm.getByText('2 tőke kiválasztva')).toBeVisible();
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
  await stabilizeVineTimestamps(createdVineId, vineDetail);
  await expect(page).toHaveScreenshot('toke-esemeny-foto-alairas-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await createdEvent.getByRole('button', { name: 'Aláírás mentése' }).click();
  await expect(createdEvent.getByText('Utólag pótolt kép', { exact: true })).toBeVisible();

  await stabilizeVineTimestamps(createdVineId, vineDetail);
  await expect(page).toHaveScreenshot('toke-esemeny-fotosor-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await createdEvent.scrollIntoViewIfNeeded();
  // A fotónkénti gombsor (borító, aláírás, törlés) 375 px-en sem lóghat ki a
  // fotókártyából.
  const buttonOverflow = await eventPhotos
    .getByRole('listitem')
    .first()
    .evaluate((row) => {
      const rowRight = row.getBoundingClientRect().right;
      return Math.max(
        ...[...row.querySelectorAll('button')].map(
          (button) => button.getBoundingClientRect().right - rowRight,
        ),
      );
    });
  expect(buttonOverflow).toBeLessThanOrEqual(0);
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

  // Borítókép: kijelölés nélkül automatikus, kijelölés után új fotó sem veszi át.
  await expect(vineDetail.getByRole('button', { name: 'Borítókép megnyitása' })).toBeVisible();
  await expect(vineDetail.getByText(/^Automatikus borítókép • Közös metszés/)).toBeVisible();
  await expect(
    page.getByTestId('vine-card').filter({ hasText: '#4' }).locator('img'),
  ).toBeVisible();

  await createdEvent
    .getByRole('button', { name: 'Közös metszés 1. fotó kijelölése borítóképnek' })
    .click();
  const pinnedCoverButton = createdEvent.getByRole('button', {
    name: 'Közös metszés 1. fotó borítóképkijelölésének visszavonása',
  });
  await expect(pinnedCoverButton).toHaveAttribute('aria-pressed', 'true');
  await expect(vineDetail.getByText(/^Kijelölt borítókép • Közös metszés/)).toBeVisible();

  await createdEvent.locator('input[type="file"]').setInputFiles([
    { name: 'metszes-5.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(createdEvent.getByText('Fotók 4/12')).toBeVisible();
  await expect(pinnedCoverButton).toHaveAttribute('aria-pressed', 'true');
  await expect(vineDetail.getByText(/^Kijelölt borítókép • Közös metszés/)).toBeVisible();

  await stabilizeVineTimestamps(createdVineId, vineDetail);
  await expect(page).toHaveScreenshot('toke-boritokep-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 375, height: 812 });
  // A mobil részletmodal a desktop görgetési pozíciójával nyílik, ezért a
  // borítót vissza kell húzni a képbe.
  await vineDetail.getByRole('button', { name: 'Borítókép megnyitása' }).scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot('toke-boritokep-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  // Másik kép kijelölése felváltja az előzőt, külön visszavonás nélkül.
  await createdEvent
    .getByRole('button', { name: 'Közös metszés 2. fotó kijelölése borítóképnek' })
    .click();
  const secondCoverButton = createdEvent.getByRole('button', {
    name: 'Közös metszés 2. fotó borítóképkijelölésének visszavonása',
  });
  await expect(secondCoverButton).toHaveAttribute('aria-pressed', 'true');
  await expect(pinnedCoverButton).toHaveCount(0);
  await expect(vineDetail.getByText(/^Kijelölt borítókép • Közös metszés/)).toBeVisible();

  // A kijelölés visszavonása után újra a legfrissebb fotó a borító.
  await secondCoverButton.click();
  await expect(vineDetail.getByText(/^Automatikus borítókép • Közös metszés/)).toBeVisible();
  await expect(
    createdEvent.getByRole('button', { name: 'Közös metszés 2. fotó kijelölése borítóképnek' }),
  ).toBeVisible();

  // A borító törlése után a mutató nem ragad be: a tőke marad automatikus borítón.
  await createdEvent
    .getByRole('button', { name: 'Közös metszés 2. fotó kijelölése borítóképnek' })
    .click();
  await expect(vineDetail.getByText(/^Kijelölt borítókép • Közös metszés/)).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await createdEvent.getByRole('button', { name: 'Közös metszés 2. fotó törlése' }).click();
  await expect(eventPhotos.getByRole('listitem')).toHaveCount(3);
  await expect(vineDetail.getByText(/^Automatikus borítókép • Közös metszés/)).toBeVisible();

  await page.getByRole('button', { name: /#1 Kékfrankos/ }).click();
  const copiedEvent = page.getByTestId('vine-event').filter({ hasText: 'Közös metszés' });
  await copiedEvent.getByRole('button', { name: 'Szerkesztés', exact: true }).click();
  const editEventForm = page.getByRole('form', { name: 'Tőkeesemény szerkesztése' });
  await editEventForm.locator('[name="title"]').fill('Csak az első tőkén szerkesztve');
  await editEventForm.getByRole('button', { name: 'Mentés' }).click();
  // A cím a borítókép feliratában is megjelenik, ezért itt is a címsor a horgony.
  await expect(page.getByRole('heading', { name: 'Csak az első tőkén szerkesztve' })).toBeVisible();

  await page.getByRole('button', { name: /#4 Cabernet Franc/ }).click();
  await expect(page.getByRole('heading', { name: 'Közös metszés' })).toBeVisible();
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
  // A megszűnt tőke előre ki van jelölve, pedig a dialógus alapszűrője `Aktív`.
  await expect(ceasedEventForm.getByText('1 tőke kiválasztva')).toBeVisible();
  await ceasedEventForm.getByRole('button', { name: 'Kiválasztás…' }).click();
  const ceasedPicker = page.getByRole('dialog', { name: 'Érintett tőkék kiválasztása' });
  // A lap `Mind` állapotszűrője nem szivárog be: a dialógus alaphelyzetből indul.
  await expect(ceasedPicker.getByLabel('Állapot')).toHaveValue('active');
  await expect(ceasedPicker.getByRole('checkbox', { name: '#3 - Ismeretlen' })).toHaveCount(0);
  await ceasedPicker.getByRole('checkbox', { name: 'Csak a kiválasztottak' }).check();
  await expect(ceasedPicker.getByTestId('vine-target-row')).toHaveCount(1);
  await expect(ceasedPicker.getByRole('checkbox', { name: '#3 - Ismeretlen' })).toBeChecked();
  await ceasedPicker.getByRole('checkbox', { name: 'Csak a kiválasztottak' }).uncheck();
  // Megszűnt tőke is választható célnak, ha az állapotszűrő engedi.
  await ceasedPicker.getByLabel('Állapot').selectOption('all');
  await expect(ceasedPicker.getByTestId('vine-target-row')).toHaveCount(4);
  await ceasedPicker.getByRole('button', { name: 'Mégse' }).click();
  await expect(ceasedPicker).toHaveCount(0);
  await expect(ceasedEventForm.getByText('1 tőke kiválasztva')).toBeVisible();
  await ceasedEventForm.locator('[name="title"]').fill('Utólagos állapotfelmérés');
  await ceasedEventForm.getByRole('button', { name: 'Esemény mentése (1)' }).click();
  await expect(page.getByText('Utólagos állapotfelmérés')).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByText('Megszűnt', { exact: true })).toBeVisible();
});
