import { expect, test, type Page } from '@playwright/test';

// The neighbourhood explorer (canal-drive/explore.html). Dev server: /canal-drive/explore.html.
// The assembled site serves the same page at /explore behind a Hosting rewrite:
//   npm run build && node scripts/assemble-canalrecall-site.mjs
//   npx firebase-tools@15 serve --only hosting:canalrecall --port 4431
//   EXPLORE_PATH=http://localhost:4431/explore PW_PORT=4430 npx playwright test tests/e2e/explore.spec.ts
// EXPLORE_SHOTS=<dir> saves desktop/phone screenshots of the list, panel and request states.
const PATH = process.env.EXPLORE_PATH ?? '/canal-drive/explore.html';
const SHOTS = process.env.EXPLORE_SHOTS;

async function boot(page: Page, query = '') {
  const threeRequests: string[] = [];
  page.on('request', r => { if (/three\.bundle\.js/.test(r.url())) threeRequests.push(r.url()); });
  await page.goto(`${PATH}${query}`);
  await expect(page.locator('body[data-ready="1"]')).toBeAttached({ timeout: 20_000 });
  return threeRequests;
}

async function waitForMap(page: Page) {
  await expect(page.locator('body[data-map-ready="1"]')).toBeAttached({ timeout: 30_000 });
  await page.waitForFunction(() => (window as any).__explorerMap?.loaded?.() && !(window as any).__explorerMap.isMoving());
}

/** Screen position of a model's pin. */
async function pinPoint(page: Page, id: string) {
  return page.evaluate(id => {
    const w = window as any;
    const m = w.CanalRecallExplorer.byId.get(id);
    const p = w.__explorerMap.project(m.lngLat);
    const r = w.__explorerMap.getCanvas().getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }, id);
}

/** Records CanalFeedback.open calls instead of loading the real form. */
async function stubFeedback(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__feedbackCalls = [];
    w.CanalFeedback = { open: (o: unknown) => w.__feedbackCalls.push(o), attach: () => {} };
  });
}

test('loads without three.js, lists buildings and filters by neighbourhood', async ({ page }) => {
  const three = await boot(page);
  expect(await page.evaluate(() => typeof (window as any).CanalRecallThree)).toBe('undefined');
  await expect(page.locator('#list .row').first()).toBeVisible();
  await expect(page.locator('#count')).toHaveText(/^\d{3,}$/);

  await page.locator('#buurt').selectOption('Grachtengordel');
  await expect(page.locator('#list-title')).toHaveText(/^\d+ in Grachtengordel$/);
  const rows = await page.locator('#list .row').count();
  expect(rows).toBeGreaterThan(5);
  await expect(page.locator('#list .row-name', { hasText: 'Westerkerk' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('buurt')).toBe('Grachtengordel');

  await page.locator('#search').fill('wester');
  await expect(page.locator('#results .row').first()).toContainText('Westerkerk');
  await page.locator('#search').fill('');

  await waitForMap(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/explore-${test.info().project.name}-buurt.png` });
  expect(three).toEqual([]);
});

test('a pin opens the 3D viewer, download and report', async ({ page, request }) => {
  const three = await boot(page, '?buurt=Grachtengordel');
  await waitForMap(page);
  expect(three).toEqual([]);
  const at = await pinPoint(page, 'westerkerk');
  await page.mouse.click(at.x, at.y);
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#p-title')).toHaveText('Westerkerk / Westertoren');
  await expect(page.locator('#stage canvas')).toHaveCount(1);
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  expect(three.length).toBe(1);
  expect(new URL(page.url()).searchParams.get('model')).toBe('westerkerk');
  await expect(page.locator('#p-pands li').first()).toHaveText(/^BAG pand \d{16}$/);
  await expect(page.locator('#p-wiki')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Westerkerk');

  const download = page.locator('#download');
  await expect(download).toHaveAttribute('href', 'models/westerkerk.glb');
  await expect(download).toHaveAttribute('download', 'canal-recall-westerkerk.glb');
  await expect(download).toContainText(/Download GLB · \d+ KB/);
  const head = await request.head(new URL('models/westerkerk.glb', page.url()).href);
  expect(head.status()).toBe(200);
  await expect(page.locator('.licence')).toContainText('CC BY 4.0, derived from 3DBAG/BAG/OSM; see credits.html');

  await page.waitForTimeout(600);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/explore-${test.info().project.name}-panel.png` });

  await stubFeedback(page);
  await page.locator('#report').click();
  const calls = await page.evaluate(() => (window as any).__feedbackCalls);
  expect(calls).toEqual([{ category: 'building', subject: { kind: 'model', id: 'westerkerk', lngLat: [4.883896, 52.3745] }, label: 'Westerkerk / Westertoren (westerkerk)', id: 'explore:westerkerk' }]);

  // Another building reuses the one canvas; closing disposes the model.
  await page.locator('#close').click();
  await expect(page.locator('#panel')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('model')).toBeNull();
  await page.evaluate(() => (window as any).CanalRecallExplorer.open('van-gogh-museum', { fly: true }));
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(page.locator('canvas.viewer-canvas')).toHaveCount(1);
});

test('a deep link opens its building, and a click off the pins offers a request', async ({ page }) => {
  await boot(page, '?buurt=Jordaan&model=westerkerk');
  await expect(page.locator('#p-title')).toHaveText('Westerkerk / Westertoren');
  await expect(page.locator('#buurt')).toHaveValue('Jordaan');
  await page.locator('#close').click();
  await waitForMap(page);
  await stubFeedback(page);

  // Open water in the IJ, well away from any pin or footprint.
  const at = await page.evaluate(() => {
    const w = window as any, map = w.__explorerMap;
    map.jumpTo({ center: [4.905, 52.3835], zoom: 16 });
    const p = map.project([4.905, 52.3835]);
    const r = map.getCanvas().getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  });
  await page.waitForFunction(() => (window as any).__explorerMap.loaded());
  await page.mouse.click(at.x, at.y);
  const button = page.locator('#request-building');
  await expect(button).toBeVisible();
  await expect(page.locator('.req-meta')).not.toHaveText('Looking up the building…', { timeout: 20_000 });
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/explore-${test.info().project.name}-request.png` });
  await button.click();
  const calls = await page.evaluate(() => (window as any).__feedbackCalls);
  expect(calls).toHaveLength(1);
  expect(calls[0].category).toBe('request');
  expect(calls[0].label).toBe('Building request');
  expect(['point', 'pand', 'osm']).toContain(calls[0].subject.kind);
  expect(calls[0].subject.lngLat[0]).toBeCloseTo(4.905, 3);
});
