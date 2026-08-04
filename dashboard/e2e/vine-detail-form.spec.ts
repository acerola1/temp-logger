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
  await expect(page.getByText('Déli fekvésű, rendszeresen termő tőke.')).toBeVisible();
  // Az esemény címe a borítókép feliratában is szerepel, ezért a címsorra szűkítünk.
  await expect(page.getByRole('heading', { name: 'Első fürtök' })).toBeVisible();
  await expect(page.getByText('Egészséges lomb és két fürt.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Első fürtök 1. fotó megnyitása' })).toBeVisible();
  await expect(page.getByText('#1 - Kékfrankos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alapadatok szerkesztése' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új tőke' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új esemény' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Szerkesztés' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Törlés' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /borítóképnek/ })).toHaveCount(0);

  // A közös képnéző: eseményen belüli lapozás, számláló, nem körkörös szélek.
  await page.getByRole('button', { name: 'Első fürtök 1. fotó megnyitása' }).click();
  const photoViewer = page.getByRole('dialog', { name: 'Eseményfotó' });
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

  // A borítókép kijelölés nélkül a legutóljára fényképezett kép. A seed két
  // fotója közül a `capturedAt` nélküli feltöltése a frissebb, ezért az a
  // borító — a feliratban a `Feltöltve` ezt ki is mondja.
  const coverPhoto = page.getByRole('button', { name: 'Borítókép megnyitása' });
  await expect(coverPhoto).toBeVisible();
  await expect(
    page.getByText(/^Automatikus borítókép • Első fürtök • Feltöltve:/),
  ).toBeVisible();
  await coverPhoto.click();
  const coverViewer = page.getByRole('dialog', { name: 'Eseményfotó' });
  await expect(coverViewer.getByText(/Kép 2\/2/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(coverViewer).toHaveCount(0);

  // A lista kártyáján ugyanaz a fotó jelenik meg, de a kis bélyegváltozatában: a
  // 80 px-es keret nem tölti le az eredetit, és a képernyőn kívüli kártyák képe
  // csak görgetésre jön le.
  const listCover = page.getByTestId('vine-card').filter({ hasText: '#1' }).locator('img');
  await expect(listCover).toBeVisible();
  await expect(listCover).toHaveAttribute('src', SEED_PHOTO_THUMBNAIL_URL);
  await expect(listCover).toHaveAttribute('loading', 'lazy');

  // Az adatlap fejlécének borítója viszont a nagy képet tartja: egy 320 px-es
  // bélyeg ezen a méreten már mosott lenne.
  await expect(coverPhoto.locator('img')).toHaveAttribute('src', SEED_PHOTO_URL);

  // Az eseménykártya fotósora is a bélyeget mutatja, ahol van; a bélyeg nélküli
  // seed-fotó a nagy képre esik vissza, hibaüzenet és üres keret nélkül.
  await expect(
    page.getByRole('button', { name: 'Első fürtök 1. fotó megnyitása' }).locator('img'),
  ).toHaveAttribute('src', SEED_PHOTO_URL);
  await expect(
    page.getByRole('button', { name: 'Első fürtök 2. fotó megnyitása' }).locator('img'),
  ).toHaveAttribute('src', SEED_PHOTO_THUMBNAIL_URL);

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
  // Desktopon (érintés nélküli böngészőben) egyetlen választógomb jelenik meg.
  await expect(form.getByRole('button', { name: 'Kép kiválasztása' })).toBeVisible();
  await expect(form.getByRole('button', { name: 'Fotózás' })).toHaveCount(0);
  await expect(form.getByText('Legfeljebb 6 fotó választható ki.')).toBeVisible();
  await expect(form.getByRole('checkbox')).toHaveCount(2);
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
  await form.getByRole('checkbox', { name: '#1 - Kékfrankos' }).uncheck();
  await form.getByRole('checkbox', { name: '#2 - Irsai Olivér' }).check();
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU9WQAAAAASUVORK5CYII=',
    'base64',
  );
  await form.locator('input[type="file"]').setInputFiles([
    { name: 'allapot.png', mimeType: 'image/png', buffer: pixel },
    { name: 'eltavolitando.png', mimeType: 'image/png', buffer: pixel },
  ]);

  // A bélyegek látszanak, és a törölt kép a feltöltésbe sem kerül bele.
  const previews = form.getByRole('list', { name: 'Kiválasztott fotók' });
  await expect(previews.getByRole('img')).toHaveCount(2);
  await expect(form.getByText('2/6 fotó kiválasztva')).toBeVisible();
  await form.getByRole('button', { name: 'eltavolitando.png eltávolítása' }).click();
  await expect(previews.getByRole('img')).toHaveCount(1);
  await expect(form.getByText('1/6 fotó kiválasztva')).toBeVisible();

  let releaseUpload!: () => void;
  const uploadGate = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });
  await page.route('http://127.0.0.1:9199/**', async (route) => {
    await uploadGate;
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 403, message: 'Teszt feltöltési hiba' } }),
    });
  });

  await form.getByRole('button', { name: 'Esemény mentése (1)' }).click();
  try {
    await expect(form.getByRole('button', { name: 'Esemény mentése (1)' })).toBeDisabled();
    await expect(form.getByRole('status')).toContainText('Fotók feltöltése');
    await expect(form.getByRole('progressbar', { name: 'Fotók feltöltése' })).toHaveAttribute('aria-valuenow', '0');
    await expect(form.getByRole('button', { name: 'Kép kiválasztása' })).toBeDisabled();
    await expect(form.getByRole('button', { name: 'allapot.png eltávolítása' })).toBeDisabled();
    await expect(page).toHaveScreenshot('toke-esemeny-urlap-pending-desktop.png', {
      fullPage: true,
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await form.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page).toHaveScreenshot('toke-esemeny-urlap-pending-mobile.png', {
      fullPage: true,
      animations: 'disabled',
    });
  } finally {
    releaseUpload();
  }
  await page.setViewportSize({ width: 1280, height: 1100 });
  await expect(form.getByRole('alert')).toBeVisible();
  await expect(form.getByRole('button', { name: 'Esemény mentése (1)' })).toBeEnabled();
  await expect(form.locator('[name="occurredAt"]')).toHaveValue('2026-08-02T19:30');
  await expect(page).toHaveScreenshot('toke-esemeny-urlap-hiba-desktop.png', {
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 375, height: 812 });
  await form.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('toke-esemeny-urlap-hiba-mobile.png', {
    fullPage: true,
    animations: 'disabled',
  });
  await page.unroute('http://127.0.0.1:9199/**');

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
  await page.getByRole('button', { name: 'Első fürtök 1. fotó megnyitása' }).click();
  const mobileViewer = page.getByRole('dialog', { name: 'Eseményfotó' });
  await expect(mobileViewer).toBeVisible();
  await mobileViewer.getByRole('button', { name: 'Bezárás' }).click();
  await expect(mobileViewer).toHaveCount(0);
  await expect(detail).toBeVisible();

  await page.getByRole('button', { name: 'Részletek bezárása' }).click();
  await expect(page).toHaveURL(/\/tokek$/);
  await expect(detail).toHaveCount(0);
});
