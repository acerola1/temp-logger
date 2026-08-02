import { expect, test } from '@playwright/test';

test('a publikus adatlap közvetlenül nyitható, megőrzi a listaállapotot és csak olvasható', async ({ page }) => {
  await page.goto('/tokek/vine-e2e-1?q=k%C3%A9k');

  await expect(page).toHaveURL(/\/tokek\/vine-e2e-1\?q=/);
  await expect(page.getByText('Szőlőtőke #1')).toBeVisible();
  await expect(page.getByTestId('vine-detail').getByRole('heading', { name: 'Kékfrankos' })).toBeVisible();
  await expect(page.getByText('Déli kerítés mellett')).toBeVisible();
  await expect(page.getByText('Déli fekvésű, rendszeresen termő tőke.')).toBeVisible();
  await expect(page.getByText('#1 - Kékfrankos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alapadatok szerkesztése' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Új tőke' })).toHaveCount(0);

  await page.getByRole('button', { name: '#1 - Kékfrankos' }).click();
  await expect(page).toHaveURL(/\/dugvanyok\/cutting-e2e-1$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/tokek\/vine-e2e-1\?q=/);
  await expect(page.getByLabel('Keresés')).toHaveValue('kék');
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

  await page.getByRole('button', { name: 'Részletek bezárása' }).click();
  await expect(page).toHaveURL(/\/tokek$/);
  await expect(detail).toHaveCount(0);
});
