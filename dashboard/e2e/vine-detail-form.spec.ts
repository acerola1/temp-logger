import { expect, test } from '@playwright/test';

// A `scripts/seed-e2e-data.mjs` két különböző képpontot használ a nagy képhez és
// a bélyeghez, hogy itt eldönthető legyen, melyik változat töltődik le.
const SEED_PHOTO_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=';
const SEED_PHOTO_THUMBNAIL_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVR4nGNgQAcAABIAAXfx+gAAAAAASUVORK5CYII=';

test('a publikus adatlap közvetlenül nyitható, megőrzi a listaállapotot és csak olvasható', async ({ page }) => {
  await page.goto('/tokek/vine-e2e-1?q=k%C3%A9k');

  await expect(page).toHaveURL(/\/tokek\/vine-e2e-1\?q=/);
  await expect(page.getByText('Szőlőtőke #1')).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByRole('heading', { name: 'Kékfrankos' })).toBeVisible();
  await expect(page.getByText('Déli kerítés mellett')).toBeVisible();
  await expect(page.getByTestId('vine-detail').locator('dt', { hasText: 'Helyszín' }).locator('xpath=following-sibling::dd')).toHaveText('Telek');
  await expect(page.getByText('Déli fekvésű, rendszeresen termő tőke.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Első fürtök' })).toBeVisible();
  await expect(page.getByText('Egészséges lomb és két fürt.')).toBeVisible();
  await expect(page.getByText('#1 - Kékfrankos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alapadatok szerkesztése' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új tőke' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új esemény' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Szerkesztés' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Törlés' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Borítóképnek' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Automatikus borító', exact: true })).toHaveCount(0);

  // A tőke fotói egyetlen galériában, írási művelet nélkül. Az eseménykártyán
  // nincs fotósor: a fotó a tőke önálló képe.
  const gallery = page.getByRole('region', { name: 'Fotók' });
  await expect(gallery.getByText('Fotók (2)')).toBeVisible();
  await expect(gallery.getByRole('button', { name: 'Fotó hozzáadása' })).toHaveCount(0);
  await expect(gallery.getByRole('button', { name: 'Képaláírás szerkesztése' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: /fotói/ })).toHaveCount(0);

  // A közös képnéző a teljes tőkefotólistát lapozza: számláló, nem körkörös szélek.
  await gallery.getByTitle('Teljes képernyős nézet').click();
  const photoViewer = page.getByRole('dialog', { name: 'Tőkefotók' });
  await expect(photoViewer).toBeVisible();
  await expect(photoViewer.getByText(/Kép 1\/2/)).toBeVisible();
  await expect(photoViewer.getByRole('button', { name: 'Előző kép' })).toBeDisabled();
  await photoViewer.getByRole('button', { name: 'Következő kép' }).click();
  await expect(photoViewer.getByText(/Kép 2\/2/)).toBeVisible();
  await expect(photoViewer.getByRole('button', { name: 'Következő kép' })).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(photoViewer.getByText(/Kép 1\/2/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photoViewer).toHaveCount(0);

  // A borítókép kijelölés nélkül a rendezés első képe. A seed két fotója közül a
  // `capturedAt` nélküli feltöltése a frissebb, ezért az a borító — a feliratban
  // a `Feltöltve` ezt ki is mondja. A galéria első képe ugyanez.
  const coverPhoto = page.getByRole('button', { name: 'Borítókép megnyitása' });
  await expect(coverPhoto).toBeVisible();
  await expect(page.getByText(/^Automatikus borítókép • Feltöltve:/)).toBeVisible();
  await expect(gallery.getByText('Automatikus borító')).toBeVisible();
  await coverPhoto.click();
  const coverViewer = page.getByRole('dialog', { name: 'Tőkefotók' });
  await expect(coverViewer.getByText(/Kép 1\/2/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(coverViewer).toHaveCount(0);

  // A lista kártyáján ugyanaz a fotó jelenik meg, de a kis bélyegváltozatában: a
  // 80 px-es keret nem tölti le az eredetit, és a képernyőn kívüli kártyák képe
  // csak görgetésre jön le.
  const listCover = page.getByTestId('vine-card').filter({ hasText: '#1' }).locator('img');
  await expect(listCover).toBeVisible();
  await expect(listCover).toHaveAttribute('src', SEED_PHOTO_THUMBNAIL_URL);
  await expect(listCover).toHaveAttribute('loading', 'lazy');

  // Az adatlap fejlécének borítója is a bélyeget tölti: az adatlap megnyitása
  // mobilon se hozzon le nagy képet. A részletes változat csak koppintásra, a
  // képnézőben jön le.
  await expect(coverPhoto.locator('img')).toHaveAttribute('src', SEED_PHOTO_THUMBNAIL_URL);

  // A galéria bélyegrácsa is a bélyeget mutatja, ahol van; a bélyeg nélküli
  // seed-fotó a nagy képre esik vissza, hibaüzenet és üres keret nélkül. A
  // sorrend legújabbtól a legrégebbi felé megy, tehát a bélyeges fotó az első.
  const thumbnails = gallery.getByRole('button', { name: 'Kékfrankos fotó megnyitása' });
  await expect(thumbnails).toHaveCount(2);
  await expect(thumbnails.nth(0).locator('img')).toHaveAttribute('src', SEED_PHOTO_THUMBNAIL_URL);
  await expect(thumbnails.nth(1).locator('img')).toHaveAttribute('src', SEED_PHOTO_URL);

  await page.getByRole('button', { name: '#1 - Kékfrankos' }).click();
  await expect(page).toHaveURL(/\/dugvanyok\/cutting-e2e-1$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/tokek\/vine-e2e-1\?q=/);
  await expect(page.getByLabel('Keresés')).toHaveValue('kék');
});

test('az admin eseményűrlap desktopon és mobilon a prototípust követi', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('/tokek/vine-e2e-1');
  await page.getByRole('button', { name: 'Teszt admin belépés' }).click();
  await page.getByRole('button', { name: 'Új esemény' }).click();

  const form = page.getByRole('form', { name: 'Új tőkeesemény' });
  await expect(form).toBeVisible();
  await form.locator('[name="occurredAt"]').fill('2026-08-02T19:30');
  // Az eseményűrlap nem fogad fotót: a fotó külön tőkeművelet.
  await expect(form.locator('input[type="file"]')).toHaveCount(0);
  await expect(form.getByText(/fotó választható ki/)).toHaveCount(0);
  // A célválasztó dialógusban van, az űrlapon csak az összefoglaló sor és a
  // nyitó gomb: a nyitott tőke előre ki van jelölve, dialógus nélkül mentődik.
  await expect(form.getByRole('checkbox')).toHaveCount(0);
  await expect(form.getByText('1 tőke kiválasztva')).toBeVisible();
  await expect(form.getByText('#1', { exact: true })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Esemény mentése (1)' })).toBeVisible();
  await expect(page).toHaveScreenshot('toke-esemeny-urlap-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByTestId('vine-detail')).toHaveCSS('position', 'fixed');
  await expect(form).toBeVisible();
  await form.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('toke-esemeny-urlap-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 1280, height: 1100 });

  // A célválasztó dialógus: a tőkelista szűrőivel, checkboxos kártyasorokkal.
  await form.getByRole('button', { name: 'Kiválasztás…' }).click();
  const targetPicker = page.getByRole('dialog', { name: 'Érintett tőkék kiválasztása' });
  await expect(targetPicker).toHaveAttribute('aria-modal', 'true');
  // A nyitva tartás alatt a háttéroldal nem görgethető.
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  // A sorok a bélyeget töltik lustán, nem az 1280 px-es képet.
  const pickerCover = targetPicker
    .getByTestId('vine-target-row')
    .filter({ hasText: '#1' })
    .locator('img');
  await expect(pickerCover).toHaveAttribute('src', SEED_PHOTO_THUMBNAIL_URL);
  await expect(pickerCover).toHaveAttribute('loading', 'lazy');
  // Itt szándékosan a dialógus elemére, nem `fullPage`-re fényképezünk: a
  // `fixed` overlay a teljes lapos kompozitban a pillanatnyi görgetési
  // pozíciótól függő helyre esik, ami környezetenként elmozdul.
  await expect(targetPicker).toHaveScreenshot('toke-celvalaszto-desktop.png', {
    animations: 'disabled',
  });

  // A dialógus szűrése nem szivárog ki: sem a lap szűrőpaneljébe, sem az URL-be.
  await targetPicker.getByLabel('Keresés').fill('irsai');
  await expect(targetPicker.getByTestId('vine-target-row')).toHaveCount(1);
  await expect(page.locator('aside').getByLabel('Keresés')).toHaveValue('');
  await expect(page).toHaveURL(/\/tokek\/vine-e2e-1$/);
  await targetPicker.getByRole('button', { name: 'Alaphelyzet' }).click();
  await expect(targetPicker.getByTestId('vine-target-row')).toHaveCount(2);

  await targetPicker.getByRole('checkbox', { name: '#1 - Kékfrankos' }).uncheck();
  await targetPicker.getByRole('checkbox', { name: '#2 - Irsai Olivér' }).check();
  await expect(targetPicker.getByText('1 kiválasztva')).toBeVisible();
  await targetPicker.getByRole('button', { name: 'Kész' }).click();
  await expect(targetPicker).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(form.getByText('1 tőke kiválasztva')).toBeVisible();
  await expect(form.getByText('#2', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.getByRole('button', { name: 'Új esemény bezárása' }).click();
  const seededEvent = page.getByTestId('vine-event').filter({ hasText: 'Első fürtök' });
  await seededEvent.getByRole('button', { name: 'Szerkesztés', exact: true }).click();
  const editForm = page.getByRole('form', { name: 'Tőkeesemény szerkesztése' });
  await expect(editForm).toBeVisible();
  await expect(editForm.locator('input[type="file"]')).toHaveCount(0);
  // A `Szerkesztés` gomb kattintása görget, a dev módban futó devtools-gomb
  // viszont fix pozíciójú: a görgetést nullázni kell, különben a teljes lapos
  // képen a gomb máshova esik futásonként.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('toke-esemeny-urlap-szerkesztes-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await editForm.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('toke-esemeny-urlap-szerkesztes-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
});

test('az alapadat-szerkesztő elrejti az olvasó nézet duplikált blokkjait', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('/tokek/vine-e2e-1');

  const detail = page.getByTestId('vine-detail');
  const meta = detail.getByTestId('vine-meta');
  const notes = detail.getByTestId('vine-notes');
  await expect(meta).toBeVisible();
  await expect(notes).toBeVisible();

  await page.getByRole('button', { name: 'Teszt admin belépés' }).click();
  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();

  // Szerkesztés közben a metaadat-rács és a jegyzet blokk kiesik, az azonosító
  // fejléc viszont marad, hogy látszódjon, melyik tőkét szerkesztjük.
  const editForm = page.getByRole('form', { name: 'Szőlőtőke #1 űrlap' });
  await expect(editForm).toBeVisible();
  await expect(meta).toHaveCount(0);
  await expect(notes).toHaveCount(0);
  await expect(detail.getByText('Szőlőtőke #1')).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Kékfrankos' })).toBeVisible();
  // Az űrlap `Állapot` legördülőjében is szerepel az `Aktív` szöveg, ezért a
  // fejléc badge-ére a span-re szűkítve horgonyzunk.
  await expect(detail.locator('span', { hasText: /^Aktív$/ })).toBeVisible();
  // A címkebadge szövege csak itt fordul elő szövegként: az űrlapon input értéke.
  await expect(detail.getByText('öreg tőke')).toBeVisible();
  // Az eseménynapló nem duplikálja az űrlapot, ezért nyitott szerkesztő mellett is marad.
  await expect(detail.getByTestId('vine-event').first()).toBeVisible();
  await expect(page).toHaveScreenshot('toke-alapadat-szerkeszto-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(detail).toHaveCSS('position', 'fixed');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('toke-alapadat-szerkeszto-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 1100 });

  // Sikertelen mentés: az űrlap a hibaüzenettel nyitva marad, az olvasó nézet
  // ekkor sem jön vissza a szerkesztő mellé.
  await editForm.locator('[name="variety"]').fill('   ');
  await editForm.getByRole('button', { name: 'Mentés' }).click();
  await expect(editForm.getByRole('alert')).toHaveText('A fajta megadása kötelező.');
  await expect(editForm).toBeVisible();
  await expect(meta).toHaveCount(0);
  await expect(notes).toHaveCount(0);

  // `Mégse` után az olvasó nézet hiánytalanul visszatér, mentés nélkül.
  await editForm.getByRole('button', { name: 'Mégse' }).click();
  await expect(editForm).toHaveCount(0);
  await expect(meta).toBeVisible();
  await expect(notes).toBeVisible();
  await expect(detail.getByRole('heading', { name: 'Kékfrankos' })).toBeVisible();

  // `Szerkesztő bezárása` ugyanúgy visszaadja az olvasó nézetet.
  await page.getByRole('button', { name: 'Alapadatok szerkesztése' }).click();
  await expect(meta).toHaveCount(0);
  await page.getByRole('button', { name: 'Szerkesztő bezárása' }).click();
  await expect(meta).toBeVisible();
  await expect(notes).toBeVisible();
});

test('a hiányzó forrásdugvány érthető állapotként jelenik meg', async ({ page }) => {
  await page.goto('/tokek/vine-e2e-3');
  await expect(page.getByText('A hivatkozott dugvány nem elérhető')).toBeVisible();
});

test('a desktop master-detail és a mobil részletmodal a prototípust követi', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tokek/vine-e2e-1');
  await expect(page.getByTestId('vine-detail')).toBeVisible();
  await expect(page).toHaveScreenshot('toke-adatlap-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/tokek/vine-e2e-1');
  const detail = page.getByTestId('vine-detail');
  await expect(detail).toBeVisible();
  await expect(detail).toHaveCSS('position', 'fixed');
  await expect(page.getByRole('button', { name: 'Részletek bezárása' })).toBeVisible();
  await expect(page).toHaveScreenshot('toke-adatlap-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });

  // A képnéző a mobil részletmodal fölött nyílik, és a zárása csak őt zárja.
  await page.getByRole('button', { name: 'Borítókép megnyitása' }).click();
  const mobileViewer = page.getByRole('dialog', { name: 'Tőkefotók' });
  await expect(mobileViewer).toBeVisible();
  await mobileViewer.getByRole('button', { name: 'Bezárás' }).click();
  await expect(mobileViewer).toHaveCount(0);
  await expect(detail).toBeVisible();

  await page.getByRole('button', { name: 'Részletek bezárása' }).click();
  await expect(page).toHaveURL(/\/tokek$/);
  await expect(detail).toHaveCount(0);
});
