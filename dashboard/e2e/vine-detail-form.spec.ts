import { expect, test } from '@playwright/test';

test('a publikus adatlap közvetlenül nyitható, megőrzi a listaállapotot és csak olvasható', async ({ page }) => {
  await page.goto('/tokek/vine-e2e-1?q=k%C3%A9k');

  await expect(page).toHaveURL(/\/tokek\/vine-e2e-1\?q=/);
  await expect(page.getByText('Szőlőtőke #1')).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByRole('heading', { name: 'Kékfrankos' })).toBeVisible();
  await expect(page.getByText('Déli kerítés mellett')).toBeVisible();
  await expect(page.getByText('Déli fekvésű, rendszeresen termő tőke.')).toBeVisible();
  await expect(page.getByText('Első fürtök')).toBeVisible();
  await expect(page.getByText('Egészséges lomb és két fürt.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Első fürtök 1. fotó megnyitása' })).toBeVisible();
  await expect(page.getByText('#1 - Kékfrankos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alapadatok szerkesztése' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új tőke' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új esemény' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Szerkesztés' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Törlés' })).toHaveCount(0);

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
