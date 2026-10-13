import { expect, test, type Page } from '@playwright/test';

// Street-survey catalogue (street-surveys.html) and the taxonomy split of the galleries.
//   PW_PORT=4427 npx playwright test street-surveys --project=desktop --project=iphone

const ready = (page: Page) => page.waitForFunction(() => (window as any).streetSurveys?.ready === true, undefined, { timeout: 30_000 });
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('street surveys: faces with photo vs model, superseded per-house models, the Bilderdijkstraat pand table', async ({ page }, info) => {
  await page.goto('/canal-drive/street-surveys.html');
  await ready(page);
  expect(await page.evaluate(() => (window as any).streetSurveys.errors)).toEqual([]);

  // The 122–134 face is installed and shows its strip and model thumbnails.
  const face = page.locator('article.face#bilder-081118-155417');
  await expect(face.locator('.badge.installed')).toHaveText('Installed');
  await expect(face.locator('figure.shot img')).toHaveCount(2);
  // Thumbnails are lazy: bring each into view before checking it decoded.
  for (const img of await face.locator('figure.shot img').all()) await img.scrollIntoViewIfNeeded(), await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(100);
  expect(await face.locator('details.house').count()).toBe(7);

  // The stale per-house 1903 orange-brick model is superseded: a link to the face, no model image.
  const stale = page.locator('article.recipe#bilder-156287');
  await expect(stale.locator('.badge')).toHaveText('Superseded');
  await expect(stale.locator('img')).toHaveCount(0);
  await expect(stale.locator('a[href="#chunk-face-bilder-081118-155417"]')).toBeVisible();

  // Still-standalone houses show their model and status.
  await expect(page.locator('article.recipe#bilder-153622 .badge')).toHaveText('Standalone');
  await expect(page.locator('article.recipe#bilder-153622 figure.shot img')).toHaveCount(2);

  // Held faces state why.
  await expect(page.locator('article.face#bilder-236022-167243 .reason')).toContainText('3DBAG');

  // Every Bilderdijkstraat pand has a row.
  expect(await page.locator('#bilderdijkstraat-pands tbody tr').count()).toBeGreaterThan(100);

  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `artifacts/street-surveys/e2e-${info.project.name}-top.png` });
  await face.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/street-surveys/e2e-${info.project.name}-face.png` });
  await page.locator('#bilderdijkstraat-pands').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `artifacts/street-surveys/e2e-${info.project.name}-table.png` });
});

test('street surveys: long names and missing images degrade without horizontal scroll', async ({ page }, info) => {
  const long = 'Bilderdijkstraat 102–106 / Kinkerstraat 1–9 / Jacob van Lennepstraat 66 hoek Bellamyplein-zuidzijde';
  await page.route('**/street-surveys-data/surveys.json', route => route.fulfill({ json: {
    version: 1, generatedAt: '2026-10-10T00:00:00Z',
    streets: [{ street: 'Eerste Constantijn Huygensstraat-en-zijstraten', faces: [
      { id: 'fixture-face', street: 'x', title: long, status: 'held', statusReason: 'Held: fixture with a very long reason '.repeat(6), houses: [
        { pandId: '0363100012999999', address: long, shop: { use: 'shop', name: 'Een heel lange winkelnaam zonder spaties: Voedingsmiddelenspeciaalzaak' }, limits: ['limit '.repeat(30)], defects: ['defect'] }],
        photo: { src: './street-surveys-data/thumbs/does-not-exist.webp', width: 760, height: 300, caption: 'missing' } },
      { id: 'fixture-staged', street: 'x', title: 'Staged face', status: 'staged', statusReason: 'Staged', houses: [] }],
    recipeHouses: [{ id: 'fixture-recipe', pandId: '0363100012999998', address: long, name: long, status: 'standalone' }] }],
  } }));
  await page.goto('/canal-drive/street-surveys.html');
  await ready(page);
  await expect(page.locator('#fixture-face figure.missing')).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator('#fixture-recipe figure.missing')).toHaveCount(2);
  await page.locator('#fixture-face details.house summary').click();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `artifacts/street-surveys/e2e-${info.project.name}-fixture.png`, fullPage: true });
});

test('landmark gallery lists landmarks only; ordinary gallery lists no street-survey houses', async ({ page }) => {
  await page.goto('/canal-drive/manual-landmarks.html');
  const names = await page.locator('main article h2').allTextContents();
  expect(names.length).toBeGreaterThan(100);
  expect(names.filter(n => /Bilderdijkstraat|^face-|Haparandaweg 9$|Het Pakhuis/.test(n))).toEqual([]);
  await expect(page.locator('header a[href="street-surveys.html"]').first()).toBeVisible();

  await page.goto('/canal-drive/manual-ordinary-buildings.html?sort=name');
  await page.waitForFunction(() => (window as any).review?.total >= 0);
  const ordinary = await page.locator('main article h2').allTextContents();
  expect(ordinary.some(n => /Bilderdijkstraat/.test(n))).toBe(false);
  expect(ordinary.some(n => /Keizersgracht 569/.test(n))).toBe(true);
});
