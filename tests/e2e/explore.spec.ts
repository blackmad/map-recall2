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
  await expect(page.locator('.licence')).toContainText('CC BY 4.0 · credit Canal Recall, 3DBAG, BAG and OpenStreetMap contributors; see credits.html');

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

// Buurt looks (?buurt=<slug>): a buurt drawn from its own district recipes, shown in the same viewer.
// Live: the buurt's own recipes are in the published recipe tiles, drawn by the ride's own near tier. Chunk: they are
// not (yet), so the installed chunk GLB stands in.
for (const [slug, path] of [['rijnbuurt-oost', 'chunk'], ['bellamybuurt-zuid', 'chunk'], ['osdorp-zuidoost', 'live'], ['da-costabuurt-noord', 'live']] as const) {
  test(`?buurt=${slug} shows that buurt's own look in 3D (${path})`, async ({ page, request }) => {
    const three = await boot(page, `?buurt=${slug}`);
    await expect(page.locator('#panel')).toBeVisible();
    await expect(page.locator('#look-details')).toBeVisible();
    await expect(page.locator('#model-details')).toBeHidden();
    await expect(page.locator('#p-kind')).toHaveText(/^Own look/);
    await expect(page.locator('#l-uses .use').first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#stage')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    expect(three.length).toBe(1);
    await expect(page.locator('#stage-path')).toHaveAttribute('data-path', path);
    await expect(page.locator('#stage-path')).toHaveText(path === 'live' ? 'Live recipe tiles · as the ride draws them' : 'Installed chunk GLB');
    await expect(page.locator('#l-path-note')).toContainText(path === 'live' ? 'index.html?recipeTiles=1' : 'Installed chunk');
    if (path === 'live') {
      const stats = await page.evaluate(() => (window as any).__explorerLive.stats());
      expect(stats.ready).toBeGreaterThan(0);
      expect(stats.ready).toBe(stats.tiles.length);
      expect(stats.errors).toEqual([]);
      await expect(page.locator('canvas.viewer-canvas')).toHaveCount(0);
      expect(await page.locator('#l-ride').getAttribute('href')).toMatch(/recipeTiles=1#race=/);
    } else {
      await expect(page.locator('#stage-map')).toBeHidden();
    }
    await expect(page.locator('#l-sw-own .sw').first()).toBeVisible();
    await expect(page.locator('#l-sw-city .sw').first()).toBeAttached();
    await expect(page.locator('#l-licence-line')).toContainText('CC BY 4.0 · credit Canal Recall, 3DBAG, BAG and OpenStreetMap contributors');
    const href = await page.locator('#l-download').getAttribute('href');
    expect((await request.head(new URL(href!, page.url()).href)).status()).toBe(200);
    expect(new URL(page.url()).searchParams.get('buurt')).toBe(slug);
    await waitForMap(page);
    await page.waitForTimeout(800);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/explore-${test.info().project.name}-look-${slug}.png` });

    await stubFeedback(page);
    await page.locator('#l-report').click();
    const calls = await page.evaluate(() => (window as any).__feedbackCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ category: 'building', subject: { kind: 'point' } });
    expect(calls[0].id).toMatch(/^explore:look:[A-Z]{2}\d{2}$/);
  });
}

test('a pand picked in the live recipe tiles shows its recipe, layers and tints; a recipe tab highlights its pands', async ({ page }) => {
  await boot(page, '?buurt=jacob-geelbuurt');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
  await expect(page.locator('#stage-path')).toHaveAttribute('data-path', 'live');
  // Find a screen point over a recipe-tile building through the runtime's own picking.
  const hit = await page.evaluate(() => {
    const live = (window as any).__explorerLive, c = live.map.getCanvas(), w = c.clientWidth, h = c.clientHeight, box = c.getBoundingClientRect();
    // A point the canvas itself receives (not under the badges), over a recipe-tile building.
    for (let y = h * 0.3; y < h * 0.85; y += 10) for (let x = w * 0.15; x < w * 0.85; x += 10) {
      if (document.elementFromPoint(box.left + x, box.top + y) !== c) continue;
      if (live.tiles.inspectAtScreen(x, y, w, h)) return { x, y };
    }
    return null;
  });
  expect(hit).not.toBeNull();
  // MapLibre's click, as a tap or a mouse click: down and up on the same point without moving.
  const box = (await page.locator('#stage-map canvas').boundingBox())!;
  await page.mouse.click(box.x + hit!.x, box.y + hit!.y);
  await expect(page.locator('#l-pick')).toBeVisible();
  await expect(page.locator('#l-pick-facts')).toContainText('Recipe');
  await expect(page.locator('#l-pick-facts')).toContainText('type:nw-');
  await expect(page.locator('#l-pick-slots .sw').first()).toBeVisible();
  await expect(page.locator('#l-live-count')).toContainText('Picked building highlighted');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/explore-${test.info().project.name}-look-live-pick.png` });
  await page.locator('#l-uses .use').nth(1).click();
  await expect(page.locator('#l-live-count')).toContainText(/\d+ pands? of this recipe highlighted/);
  await page.locator('#l-live-count button').click();
  await expect(page.locator('#l-pick')).toBeHidden();
  // Leaving the look takes the live map down.
  await page.locator('#close').click();
  await expect(page.locator('#stage-map')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__explorerLive?.map?._removed)).toBe(true);
});

test('the rail offers a neighbourhood its look, says when there is none, and a model link leaves the look', async ({ page }) => {
  await boot(page, '?buurt=Rijnbuurt');
  const entry = page.locator('#look-entry');
  await expect(entry.locator('button[data-look="rijnbuurt-oost"]')).toBeVisible();
  await entry.locator('button[data-look="rijnbuurt-oost"]').click();
  await expect(page.locator('#l-title')).toHaveText('Rijnbuurt-Oost');
  expect(new URL(page.url()).searchParams.get('buurt')).toBe('rijnbuurt-oost');
  // A second recipe swaps the model in the one viewer.
  await page.locator('#l-uses .use').nth(1).click();
  await expect(page.locator('#l-uses .use').nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#stage')).toHaveAttribute('data-state', 'ready', { timeout: 45_000 });
  await expect(page.locator('canvas.viewer-canvas')).toHaveCount(1);
  // Its modelled buildings open as ?model= panels.
  await page.locator('#l-models .row').first().click();
  await expect(page.locator('#model-details')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('model')).toBeTruthy();
  await page.locator('#close').click();

  // A buurt without a look says so and lists those that have one.
  await page.goto(`${PATH}?buurt=cornelis-schuytbuurt`);
  await expect(page.locator('body[data-ready="1"]')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#l-summary')).toContainText('has no building look of its own');
  await expect(page.locator('#l-all li').first()).toBeVisible();
  expect(await page.locator('#l-all li').count()).toBeGreaterThan(30);
  await page.locator('#close').click();
  await expect(page.locator('#panel')).toBeHidden();
});
