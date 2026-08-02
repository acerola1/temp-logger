import { expect, test } from '@playwright/test';

test('az admin tőkét hoz létre, majd a sorszám változtatása nélkül szerkeszti és visszaaktiválja', async ({ page }) => {
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
});
