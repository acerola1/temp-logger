import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { expect, test, type Locator } from '@playwright/test';

test.describe.configure({ retries: 0 });

const FIXED_TIMESTAMP = '2026-08-03T16:45:00Z';
const FIXED_VINE_TIMESTAMP = '2026-08-03T16:45:59Z';
// A feltöltés a böngésző órájából veszi a fotó `uploadedAt` értékét, és egy
// művelet minden képe ugyanezt az egy időpontot kapja. Az órát ezért műveletenként
// előretoljuk: így a galéria sorrendje — és vele minden képernyőkép — nem az
// azonosítók véletlen összehasonlításán múlik.
const PHOTO_UPLOAD_TIMES = {
  quickAction: '2026-08-03T17:10:00Z',
  gallery: '2026-08-03T17:20:00Z',
  afterPinning: '2026-08-03T17:30:00Z',
} as const;

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
  await addEventForm.getByRole('button', { name: 'Esemény mentése (2)' }).click();
  await expect(addEventForm).toHaveCount(0);

  const createdEvent = page.getByTestId('vine-event').filter({ hasText: 'Közös metszés' });
  await expect(createdEvent).toBeVisible();
  // Az eseménykártyán nincs fotósor és fotóművelet.
  await expect(createdEvent.locator('input[type="file"]')).toHaveCount(0);
  await expect(createdEvent.getByRole('button', { name: /fotó megnyitása/ })).toHaveCount(0);
  await expect(createdEvent.getByRole('button', { name: /Borító/ })).toHaveCount(0);
  // Több célpontnál nincs fotógyorsművelet: a fotó tőkéje kétértelmű lenne.
  await expect(
    page.getByRole('button', { name: 'Fotó hozzáadása ehhez a tőkéhez' }),
  ).toHaveCount(0);

  // Egyetlen tőkére mentett esemény után viszont felajánlja a fotófelvételt.
  await page.getByRole('button', { name: 'Új esemény' }).click();
  const singleTargetForm = page.getByRole('form', { name: 'Új tőkeesemény' });
  await expect(singleTargetForm.getByText('1 tőke kiválasztva')).toBeVisible();
  await singleTargetForm.locator('[name="title"]').fill('Egytőkés megfigyelés');
  await singleTargetForm.getByRole('button', { name: 'Esemény mentése (1)' }).click();
  await expect(singleTargetForm).toHaveCount(0);
  const quickActionBanner = page.getByRole('status').filter({ hasText: 'Az esemény mentve.' });
  await expect(
    quickActionBanner.getByRole('button', { name: 'Fotó hozzáadása ehhez a tőkéhez' }),
  ).toBeVisible();

  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=',
    'base64',
  );
  const gallery = page.getByRole('region', { name: 'Fotók' });
  await expect(gallery.getByText('Fotók (0)')).toBeVisible();
  await expect(gallery.getByText('Még nincs fotó ehhez a tőkéhez.')).toBeVisible();

  // A gyorsművelet a tőke fotóválasztóját nyitja meg: a kép a tőke `photos[]`
  // tömbjébe kerül, eseményhivatkozás nélkül.
  await page.clock.setFixedTime(new Date(PHOTO_UPLOAD_TIMES.quickAction));
  await quickActionBanner.locator('input[type="file"]').setInputFiles([
    { name: 'gyors-1.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(gallery.getByText('Fotók (1)')).toBeVisible();
  await expect(quickActionBanner).toHaveCount(0);

  // Az egyetlen kép egyben az automatikus borító is, és a felirata utólag
  // szerkeszthető.
  await expect(gallery.getByText('Automatikus borító')).toBeVisible();
  await gallery.getByRole('button', { name: 'Képaláírás szerkesztése' }).click();
  await gallery.getByRole('textbox', { name: 'Képaláírás' }).fill('  Utólag pótolt kép  ');
  await gallery.getByRole('button', { name: 'Mentés' }).click();
  await expect(gallery.getByText('Utólag pótolt kép', { exact: true })).toBeVisible();
  await expect(vineDetail.getByText(/^Automatikus borítókép • Utólag pótolt kép/)).toBeVisible();

  // A mentett felirat a közös nézőben is megjelenik.
  await gallery.getByTitle('Teljes képernyős nézet').click();
  const singlePhotoViewer = page.getByRole('dialog', { name: 'Tőkefotók' });
  await expect(singlePhotoViewer.getByText(/Kép 1\/1/)).toBeVisible();
  await expect(singlePhotoViewer.getByText(/Utólag pótolt kép/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(singlePhotoViewer).toHaveCount(0);

  // A galéria saját választója további képeket vesz fel, egy műveletben többet is.
  const galleryInput = gallery.locator('input[type="file"]');
  await page.clock.setFixedTime(new Date(PHOTO_UPLOAD_TIMES.gallery));
  await galleryInput.setInputFiles([
    { name: 'metszes-1.png', mimeType: 'image/png', buffer: pixel },
    { name: 'metszes-2.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(gallery.getByText('Fotók (3)')).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Cabernet Franc fotó megnyitása' })).toHaveCount(
    3,
  );
  await expect(gallery.getByText(/Kép \d\/3/)).toBeVisible();
  // Az új kép lett az aktív, felirat nélkül.
  await expect(gallery.getByText('Nincs képaláírás.')).toBeVisible();

  // A frissebb feltöltés a rács elejére kerül, tehát az aktív kép egyben az
  // automatikus borító is.
  await expect(gallery.getByText('Kép 1/3')).toBeVisible();
  await expect(gallery.getByText('Automatikus borító')).toBeVisible();

  await stabilizeVineTimestamps(createdVineId, vineDetail);
  await expect(page).toHaveScreenshot('toke-fotogaleria-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await gallery.scrollIntoViewIfNeeded();
  // Az aktív kép műveleti sávja 375 px-en sem lóghat ki a galéria szakaszából.
  const buttonOverflow = await gallery.evaluate((section) => {
    const sectionRight = section.getBoundingClientRect().right;
    return Math.max(
      ...[...section.querySelectorAll('button')].map(
        (button) => button.getBoundingClientRect().right - sectionRight,
      ),
    );
  });
  expect(buttonOverflow).toBeLessThanOrEqual(0);
  await expect(page).toHaveScreenshot('toke-fotogaleria-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });

  // A néző a teljes tőkefotólistát lapozza, egyetlen sorrendben.
  await gallery.getByTitle('Teljes képernyős nézet').click();
  const photoViewer = page.getByRole('dialog', { name: 'Tőkefotók' });
  await expect(photoViewer.getByText(/Kép \d\/3/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photoViewer).toHaveCount(0);

  // Borítókép: kijelölés nélkül automatikus, kijelölés után új fotó sem veszi át.
  await expect(vineDetail.getByRole('button', { name: 'Borítókép megnyitása' })).toBeVisible();
  await expect(vineDetail.getByText(/^Automatikus borítókép/)).toBeVisible();
  await expect(
    page.getByTestId('vine-card').filter({ hasText: '#4' }).locator('img'),
  ).toBeVisible();

  // A kijelölés az aktív, azaz a rács első fotójára esik: a jelvény ilyenkor a
  // pontosabb `Kijelölt borító` állításra vált.
  await gallery.getByRole('button', { name: 'Borítóképnek' }).click();
  const unpinButton = gallery.getByRole('button', { name: 'Automatikus borító', exact: true });
  await expect(unpinButton).toHaveAttribute('aria-pressed', 'true');
  await expect(gallery.getByText('Kijelölt borító')).toBeVisible();
  await expect(gallery.getByText('Automatikus borító', { exact: true })).toHaveCount(1);
  await expect(vineDetail.getByText(/^Kijelölt borítókép/)).toBeVisible();

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

  // Új fotó nem veszi át a kézzel kijelölt borítót.
  await page.clock.setFixedTime(new Date(PHOTO_UPLOAD_TIMES.afterPinning));
  await galleryInput.setInputFiles([
    { name: 'metszes-3.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(gallery.getByText('Fotók (4)')).toBeVisible();
  await expect(vineDetail.getByText(/^Kijelölt borítókép/)).toBeVisible();

  // Másik kép kijelölése felváltja az előzőt, külön visszavonás nélkül.
  await gallery.getByRole('button', { name: 'Borítóképnek' }).click();
  await expect(gallery.getByText('Kijelölt borító')).toBeVisible();
  await expect(vineDetail.getByText(/^Kijelölt borítókép/)).toBeVisible();

  // A kijelölés visszavonása után újra a legfrissebb fotó az automatikus borító.
  await gallery.getByRole('button', { name: 'Automatikus borító', exact: true }).click();
  await expect(vineDetail.getByText(/^Automatikus borítókép/)).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Borítóképnek' })).toBeVisible();

  // A kijelölt borító törlése után a mutató nem ragad be: marad automatikus borító.
  await gallery.getByRole('button', { name: 'Borítóképnek' }).click();
  await expect(vineDetail.getByText(/^Kijelölt borítókép/)).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await gallery.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(gallery.getByText('Fotók (3)')).toBeVisible();
  await expect(vineDetail.getByText(/^Automatikus borítókép/)).toBeVisible();
  // A felirat a megmaradt fotón marad, a törlés nem tolta el a rekordokat. A
  // galéria csak az aktív kép feliratát mutatja, ezért végiglapozzuk a maradékot.
  const caption = gallery.getByText('Utólag pótolt kép', { exact: true });
  let captionFound = await caption.isVisible();
  for (let step = 0; step < 2 && !captionFound; step += 1) {
    await gallery.getByRole('button', { name: 'Következő kép' }).click();
    captionFound = await caption.isVisible();
  }
  expect(captionFound).toBe(true);

  // Sikertelen feltöltés: a galéria hibát ír ki, a meglévő képek megmaradnak. A
  // lapozás a feliratos, azaz a legrégebbi fotón állt meg — a képernyőkép így
  // ugyanazt az aktív képet mutatja minden futásban.
  await page.route('http://127.0.0.1:9199/**', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 403, message: 'Teszt feltöltési hiba' } }),
    }),
  );
  await galleryInput.setInputFiles([
    { name: 'nem-menthet.png', mimeType: 'image/png', buffer: pixel },
  ]);
  await expect(gallery.getByRole('alert')).toBeVisible();
  await expect(gallery.getByText('Fotók (3)')).toBeVisible();
  await stabilizeVineTimestamps(createdVineId, vineDetail);
  // A Firebase hibaüzenete a feltöltés véletlen fotóazonosítóját is tartalmazza,
  // ezért a hibasáv szövegét kimaszkoljuk: a képernyőkép a sáv helyét és a
  // körülötte lévő elrendezést őrzi, nem a futásonként változó útvonalat.
  await expect(page).toHaveScreenshot('toke-fotogaleria-hiba-desktop.png', {
    fullPage: true,
    animations: 'disabled',
    mask: [gallery.getByRole('alert')],
  });
  await page.unroute('http://127.0.0.1:9199/**');

  // Esemény törlése egyetlen fotót sem visz magával.
  const singleTargetEvent = page
    .getByTestId('vine-event')
    .filter({ hasText: 'Egytőkés megfigyelés' });
  page.once('dialog', (dialog) => void dialog.accept());
  await singleTargetEvent.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(singleTargetEvent).toHaveCount(0);
  await expect(gallery.getByText('Fotók (3)')).toBeVisible();
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
