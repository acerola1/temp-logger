import { expect, test } from '@playwright/test';

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
});

test('a desktop és mobil tőkelista a prototípus elrendezését követi', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tokek');
  await expect(page.getByTestId('vine-card')).toHaveCount(2);

  const desktopWidth = await page.getByLabel('Tőkelista').evaluate((element) =>
    Math.round(element.getBoundingClientRect().width),
  );
  expect(desktopWidth).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: /#1/ }).click();
  await expect(page.getByRole('button', { name: /#1/ })).toHaveAttribute('aria-pressed', 'true');
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
