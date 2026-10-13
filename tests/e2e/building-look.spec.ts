import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';

// The Building look setting switches looks live without a reload (Photo by default;
// the retired MapLibre pattern layer survives as `?buildings3d=off`), and a
// `?buildings3d=` look beats the saved preference. Cloud sandboxes: PW_OFFLINE_MAP=1 PW_CHROME=<chromium> (see helpers).


test('building look switches live between the three.js looks and the retired pattern layer', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 90_000 });
  await page.waitForTimeout(6000);

  const read = () => page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, map = vm.map;
    const pattern = map.getLayer('osm-colored-building-facades') ? map.getLayoutProperty('osm-colored-building-facades', 'visibility') : 'absent';
    return { look: vm._buildings3dLook, pattern, three: vm._threeBuildings ? vm._threeBuildings.stats().chunks : 0,
      // Three looks draw the whole city: MapLibre's building layers are off, so no slab can hang in the air (user reports 2026-10-02).
      // The wall layer stays queryable (clicks, covered passages) but draws at opacity 0.
      maplibreBuildings: [map.getPaintProperty('osm-colored-buildings', 'fill-extrusion-opacity') === 0 ? 'none' : 'visible', map.getLayoutProperty('osm-colored-building-roofs', 'visibility') ?? 'visible'].join(',') };
  });

  // Photo is the default look (user request 2026-10-02).
  await expect.poll(async () => (await read()).three, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await read()).toMatchObject({ look: 'photo', maplibreBuildings: 'none,none' });

  for (const look of ['cartoon', 'untextured'] as const) {
    await page.evaluate((l) => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference(l), look);
    await expect.poll(async () => (await read()).look).toBe(look);
    await page.waitForTimeout(2000);
    expect(await read()).toMatchObject({ look, maplibreBuildings: 'none,none' });
    expect((await read()).three).toBeGreaterThan(0);
  }

  // The retired MapLibre pattern layer still works as an escape hatch (?buildings3d=off).
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLook('default'));
  await expect.poll(async () => (await read()).pattern).toBe('visible');
  expect(await read()).toMatchObject({ look: 'default', three: 0, maplibreBuildings: 'visible,visible' });
});

test('a URL look is not overridden by the saved preference', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => { (window as any).__canalRecallBuildings3d = 'cartoon'; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 90_000 });
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLookPreference('untextured'));
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap._buildings3dLook)).toBe('cartoon');
  await page.evaluate(() => (window as any).canalRecallGame.vectorMap.setBuildingLook('default'));
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap._buildings3dLook)).toBe('default');
});

test('B cycles the building look through every renderer and back, saved with the settings', async ({ page }) => {
  test.setTimeout(240_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: true, enterRacing: true });
  await page.waitForFunction(() => (window as any).canalRecallGame.vectorMap._facadesActive?.() === true, null, { timeout: 90_000 });
  const look = () => page.evaluate(() => (window as any).canalRecallGame.vectorMap.buildingLook());
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('canalRecall.preferences.v1') || '{}').buildingLook);

  expect(await look()).toBe('photo');
  const seen = ['photo'];
  for (const [expected, label] of [['procedural', 'Painted'], ['storybook', 'Storybook'], ['cartoon', 'Cartoon'], ['untextured', 'Untextured'], ['photo', 'Photo']] as const) {
    await page.keyboard.press('b');
    await expect.poll(look, { timeout: 15_000 }).toBe(expected);
    seen.push(expected);
    // A brief label says what changed, and the choice is saved like the Settings control would.
    await expect(page.locator('#canal-look-label')).toHaveText(`Buildings: ${label}`);
    await expect.poll(saved).toBe(expected);
  }
  expect(seen).toEqual(['photo', 'procedural', 'storybook', 'cartoon', 'untextured', 'photo']);
  // The Settings panel shows the same choice (it reads the same preferences).
  expect(await page.evaluate(() => (window as any).canalRecallGame._prefs().buildingLook)).toBe('photo');
});

// City look (`?cityLook=1`, src/canalRecall/look/cityLook.ts): a landmark GLB (untagged `brick` material, no UVs: its
// slot is inferred and its UVs box-projected), a recipe house (`materialSlot: brick`) and a generic streamed extrusion
// (the plain bay cell) all go through the one city-look shader and one texture array. Under the shared rig their mean
// wall luma must agree within CITY_LOOK_TOLERANCE on every orientation (docs/LOOK.md "Parity"). Bundles
// src/canalRecall/look/lookParity.ts on the fly (no committed bundle), like look-parity.spec.ts.
//   PW_PORT=4433 npx playwright test building-look -g "city look" --project=desktop
const CITY_LOOK_TOLERANCE = 0.06;
test('city look: landmark, recipe house and generic extrusion share one brick under the shared rig', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one renderer is enough');
  test.setTimeout(180_000);
  const { build } = await import('esbuild');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { PARITY_FACES, lumaSpread } = await import('../../src/canalRecall/look/lookParityMath');
  const bundle = await build({ entryPoints: ['src/canalRecall/look/lookParity.ts'], bundle: true, format: 'iife', globalName: 'LookParity', write: false, logLevel: 'error' });
  await page.route('**/canal-drive/__city-look.js', route => route.fulfill({ body: bundle.outputFiles[0].text, contentType: 'application/javascript' }));
  await page.route('**/canal-drive/__city-look.html', route => route.fulfill({ body: '<!doctype html><meta charset="utf-8"><script src="__city-look.js"></script>', contentType: 'text/html' }));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/canal-drive/__city-look.html');
  const pipelines = ['generic', 'recipe', 'landmark', 'city-generic', 'city-recipe', 'city-landmark', 'city-generic-unlit', 'city-recipe-unlit', 'city-landmark-unlit'];
  const result = await page.evaluate((pipelines) => (window as any).LookParity.runLookParity({ pipelines, brickUrl: new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href }), pipelines);
  expect(errors).toEqual([]);
  const out = process.env.CITY_LOOK_OUT || 'artifacts/city-look';
  mkdirSync(out, { recursive: true });
  const spreads = Object.fromEntries(PARITY_FACES.map(face => [face, {
    city: lumaSpread(result, ['city-generic', 'city-recipe', 'city-landmark'], face),
    cityUnlit: lumaSpread(result, ['city-generic-unlit', 'city-recipe-unlit', 'city-landmark-unlit'], face),
    legacyShared: lumaSpread(result, ['generic', 'recipe', 'landmark'], face),
  }]));
  writeFileSync(`${out}/parity.json`, JSON.stringify({ ...result, spreads }, null, 1));
  console.log(JSON.stringify({ walls: result.walls, spreads }, null, 1));
  for (const face of PARITY_FACES) {
    const { spread, min, max } = spreads[face].city;
    expect(spread, `${face}: ${min[0]} ${min[1]} vs ${max[0]} ${max[1]}`).toBeLessThanOrEqual(CITY_LOOK_TOLERANCE);
  }
});
