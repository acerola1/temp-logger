import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.BASE_URL;
const monitorOutput = process.env.MONITOR_SCREENSHOT_PATH ?? '../docs/dashboard-monitor.png';
const cuttingsOutput = process.env.CUTTINGS_SCREENSHOT_PATH ?? '../docs/dashboard-cuttings.png';

if (!baseUrl) {
  throw new Error('A BASE_URL környezeti változó megadása kötelező.');
}

function attachPageDebug(pageName: string, page: Page) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.error(`[${pageName}] console error: ${message.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    console.error(`[${pageName}] page error: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    console.error(
      `[${pageName}] request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`,
    );
  });
}

async function waitForLoadedState(pageName: string, page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const bodyText = document.body.innerText;
          return {
            hasLoadingText:
              bodyText.includes('Adatok betöltése...') || bodyText.includes('Dugványok betöltése...'),
            hasError:
              bodyText.includes('Nem sikerült betölteni az adatokat.') ||
              bodyText.includes('Nem sikerült betölteni a dugványokat.'),
          };
        }),
      {
        timeout: 30_000,
        message: `${pageName} oldal nem jutott túl a loading állapoton`,
      },
    )
    .toMatchObject({
      hasLoadingText: false,
      hasError: false,
    });
}

async function waitForLoadedImages(pageName: string, page: Page) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          const loadedImages = images.filter((image) => image.complete && image.naturalWidth > 0);

          return images.length > 0 && loadedImages.length === images.length;
        }),
      {
        timeout: 20_000,
        message: `${pageName} oldalon a képek nem töltődtek be időben`,
      },
    )
    .toBe(true);
}

test.describe('dashboard screenshots', () => {
  test('monitor screenshot', async ({ page }) => {
    attachPageDebug('monitor', page);

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForLoadedState('monitor', page);
    await expect(page.getByText('Utolsó mérések')).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: monitorOutput, fullPage: true });
  });

  test('cuttings screenshot', async ({ page }) => {
    attachPageDebug('cuttings', page);

    await page.goto(new URL('/dugvanyok', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await waitForLoadedState('cuttings', page);
    await expect(page.getByText('Esemény napló')).toBeVisible({ timeout: 15_000 });
    await waitForLoadedImages('cuttings', page);

    await page.screenshot({ path: cuttingsOutput, fullPage: true });
  });
});
