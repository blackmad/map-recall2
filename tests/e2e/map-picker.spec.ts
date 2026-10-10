import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// The custom-route map picker (game.mapPicker, src/canalRecall/ownMap/mapPicker.ts)
// draws our own extracts: no Leaflet from unpkg, no live tile.openstreetmap.org
// rasters, no Nominatim. Same three-step flow as before.
//   PW_PORT=4426 npx playwright test map-picker --project=desktop

const OUT = 'artifacts/own-map';
const THIRD_PARTY = /tile\.openstreetmap\.org|unpkg\.com\/leaflet|nominatim\.openstreetmap\.org/;

async function openPicker(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => !!(window as any).canalRecallGame?.mapPicker, null, { timeout: 60_000 });
  page.on('request', r => requests.push(r.url()));
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    (window as any).__picked = null;
    g.mapPicker.show((lat: number, lng: number, start: unknown, finish: unknown) => { (window as any).__picked = { lat, lng, start, finish }; });
  });
  await page.waitForFunction(() => !!(window as any).canalRecallGame.mapPicker.layers, null, { timeout: 30_000 });
  return requests;
}

/** Screen px of a lng/lat on the picker. */
const at = (page: Page, lng: number, lat: number) => page.evaluate(([lng, lat]) => (window as any).canalRecallGame.mapPicker.project(lng, lat), [lng, lat] as const);

test('map picker: own map, three steps, city choice, no third-party tiles', async ({ page }, info) => {
  test.setTimeout(120_000);
  const requests = await openPicker(page);
  const canvas = page.getByTestId('map-picker-canvas');
  await expect(canvas).toBeVisible();
  const instruction = page.getByTestId('map-picker-instruction');
  await expect(instruction).toHaveText(/Step 1/);
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${info.project.name}-map-picker-amsterdam.png` });

  // Area (Westermarkt), START (Dam), FINISH (Leidseplein): all inside the radius.
  for (const [lng, lat] of [[4.8837, 52.3747], [4.8930, 52.3731], [4.8826, 52.3641]] as const) {
    const p = await at(page, lng, lat);
    await canvas.click({ position: { x: p.x, y: p.y } });
  }
  await expect(instruction).toHaveText('Ready to race!');
  // Outside the circle is refused (Schiphol, ~13 km): the finish stays.
  const far = await at(page, 4.7639, 52.3105);
  if (far.x > 0 && far.y > 0) {
    await canvas.click({ position: { x: Math.min(far.x, 1000), y: Math.min(far.y, 800) } });
  }
  await page.screenshot({ path: `${OUT}/${info.project.name}-map-picker-picked.png` });
  await page.getByRole('button', { name: 'RACE!' }).click();
  const picked = await page.evaluate(() => (window as any).__picked);
  expect(picked.lat).toBeCloseTo(52.3747, 3);
  expect(picked.lng).toBeCloseTo(4.8837, 3);
  expect(picked.start.lat).toBeCloseTo(52.3731, 3);
  expect(picked.finish.lng).toBeCloseTo(4.8826, 3);
  await expect(canvas).toHaveCount(0);

  // City choice: Utrecht from the quick links, then a local search.
  await page.evaluate(() => (window as any).canalRecallGame.mapPicker.show(() => {}));
  await page.locator('button[data-city="utrecht"]').click();
  await page.waitForFunction(() => { const p = (window as any).canalRecallGame.mapPicker; return p.city.id === 'utrecht' && !!p.layers; }, null, { timeout: 30_000 });
  const centre = await page.evaluate(() => { const p = (window as any).canalRecallGame.mapPicker; const vp = { w: innerWidth, h: innerHeight }; return p.unproject(vp.w / 2, vp.h / 2); });
  expect(centre.lat).toBeGreaterThan(52.0); expect(centre.lat).toBeLessThan(52.15);
  expect(centre.lng).toBeGreaterThan(5.0); expect(centre.lng).toBeLessThan(5.25);
  await page.screenshot({ path: `${OUT}/${info.project.name}-map-picker-utrecht.png` });
  await page.locator('input[placeholder^="Search"]').fill('Oudegracht');
  await page.locator('input[placeholder^="Search"]').press('Enter');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.mapPicker.cam.zoom)).toBeGreaterThan(14);
  await page.getByRole('button', { name: 'CANCEL' }).click();
  await expect(canvas).toHaveCount(0);

  expect(requests.filter(u => THIRD_PARTY.test(u)), 'no live third-party map requests').toEqual([]);
});
