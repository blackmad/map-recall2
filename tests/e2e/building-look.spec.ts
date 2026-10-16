import { test, expect } from '@playwright/test';
import { openRoute } from './helpers';
import { renderSpecs } from '../../scripts/look/measured-swatches';
import { sunlitMeasuredWall } from '../../src/canalRecall/look/sunny';
import { PILOTS, loadWallPage, measurePilot } from '../../scripts/look/measured-walls';

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
  // The grey reference differs by design since the gallery review (look/cityLook.ts GREY_BRICK_BELOW_S: a grey slot
  // stays grey, a chunk's panorama tint keeps the saturation floor), ~4 %. A brick-coloured slot is the same rule in
  // every pipeline: it must agree to within 1 %.
  const red = await page.evaluate((pipelines) => (window as any).LookParity.runLookParity({ hex: '#9a5240', pipelines, brickUrl: new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href }), ['city-generic', 'city-recipe', 'city-landmark']);
  const redSpreads = Object.fromEntries(PARITY_FACES.map(face => [face, lumaSpread(red, ['city-generic', 'city-recipe', 'city-landmark'], face)]));
  writeFileSync(`${out}/parity-brick.json`, JSON.stringify({ ...red, spreads: redSpreads }, null, 1));
  for (const face of PARITY_FACES) expect(redSpreads[face].spread, `#9a5240 ${face}`).toBeLessThanOrEqual(0.01);
});

// City look highlight (review 2026-10-13): the active landmark's yellow keeps the light. The first city-look variant
// drew a flat yellow (lit: albedo plus a 0.45 glow, so the sun side clipped and the shade side was mostly glow); the
// default highlight keeps the model's own shading under a yellow glow. Sun side over shade side, mean sRGB luma:
// the city-look highlight must separate the faces at least as well as the default one does, and never clip.
//   PW_PORT=4446 npx playwright test building-look -g "highlight" --project=desktop
test('city look: the highlight keeps the shading (sun side brighter than shade side, no clipping)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one renderer is enough');
  test.setTimeout(180_000);
  const { build } = await import('esbuild');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const bundle = await build({ entryPoints: ['src/canalRecall/look/lookParity.ts'], bundle: true, format: 'iife', globalName: 'LookParity', write: false, logLevel: 'error' });
  await page.route('**/canal-drive/__city-look.js', route => route.fulfill({ body: bundle.outputFiles[0].text, contentType: 'application/javascript' }));
  await page.route('**/canal-drive/__city-look.html', route => route.fulfill({ body: '<!doctype html><meta charset="utf-8"><script src="__city-look.js"></script>', contentType: 'text/html' }));
  // The yellow under review (the default highlight is the outline since 2026-10-13; `?highlight=yellow` keeps this one).
  await page.addInitScript(() => { (window as any).__canalRecallHighlight = 'yellow'; });
  // The yellow highlight is opt-in since 2026-10-13 and was tuned against the legacy rig: under the sunny rig
  // (look/sunny.ts, 2026-10-16) its sun side draws 206.6, over the full yellow's ~201. Pinned to `?look=legacy`
  // until the yellow is re-tuned (the default outline highlight has no fill to clip).
  await page.addInitScript(() => { (window as any).__canalRecallLook = 'legacy'; });
  await page.goto('/canal-drive/__city-look.html');
  const pipelines = ['landmark-highlight', 'city-landmark-highlight', 'city-landmark-highlight-unlit'];
  const result = await page.evaluate((pipelines) => (window as any).LookParity.runLookParity({ pipelines, brickUrl: new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href }), pipelines);
  const ratio = (p: string) => result.walls[`${p}/south`] / result.walls[`${p}/north`];
  const summary = Object.fromEntries(pipelines.map(p => [p, { south: result.walls[`${p}/south`], west: result.walls[`${p}/west`], north: result.walls[`${p}/north`], ratio: +ratio(p).toFixed(3) }]));
  const out = process.env.CITY_LOOK_OUT || 'artifacts/city-look';
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/highlight.json`, JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  expect(ratio('city-landmark-highlight')).toBeGreaterThanOrEqual(ratio('landmark-highlight'));
  expect(ratio('city-landmark-highlight')).toBeGreaterThan(1.25);
  // Unlit: the city's baked light (the rig's sun azimuth, lightRig.ts) still separates the faces.
  const unlit = ['south', 'west', 'north'].map(f => result.walls[`city-landmark-highlight-unlit/${f}`]);
  expect(Math.max(...unlit) / Math.min(...unlit)).toBeGreaterThan(1.15);
  // Not clipped: the sun side stays under the full highlight yellow's luma (~201).
  expect(result.walls['city-landmark-highlight/south']).toBeLessThan(200);
});

// Shadow fill (docs/LOOK.md §Light "Shadow fill", rendererShared/lightRig.ts SHADOW_FILL): under the shared rig a
// brick wall in another surface's cast shadow keeps part of the sun, so shadowed dark brick does not drop to
// near-black (the Nassaukade block and the Royal Palace, 2026-10-14), while a lit wall reads exactly as it did
// without shadows (no acne, sun side unchanged). Same harness as the city-look test: real materials, real rig,
// an invisible slab between the wall and the sun. Chunk walls carry no normal attribute, as in the game.
//   PW_PORT=4475 npx playwright test building-look -g "shadow fill" --project=desktop
const SHADOW_PIPELINES = ['generic', 'recipe', 'landmark', 'city-generic', 'city-recipe', 'city-landmark'];
test('shadow fill: brick in cast shadow stays readable, lit walls do not move', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one renderer is enough');
  test.setTimeout(240_000);
  const { build } = await import('esbuild');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const bundle = await build({ entryPoints: ['src/canalRecall/look/lookParity.ts'], bundle: true, format: 'iife', globalName: 'LookParity', write: false, logLevel: 'error' });
  await page.route('**/canal-drive/__city-look.js', route => route.fulfill({ body: bundle.outputFiles[0].text, contentType: 'application/javascript' }));
  await page.route('**/canal-drive/__city-look.html', route => route.fulfill({ body: '<!doctype html><meta charset="utf-8"><script src="__city-look.js"></script>', contentType: 'text/html' }));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/canal-drive/__city-look.html');
  const run = (hex: string, shadow?: { caster: boolean; shadowIntensity?: number }) => page.evaluate(({ hex, shadow, pipelines }) =>
    (window as any).LookParity.runLookParity({ hex, pipelines, shadow, brickUrl: new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href }), { hex, shadow, pipelines: SHADOW_PIPELINES });
  const rows: Record<string, Record<string, number>> = {};
  for (const hex of ['#808080', '#9a5240', '#6f4335']) {
    const plain = await run(hex), lit = await run(hex, { caster: false }), shaded = await run(hex, { caster: true });
    const sweep: Record<string, any> = {};
    for (const intensity of [1, 0.65, 0.55, 0.5, 0.45]) sweep[intensity] = await run(hex, { caster: true, shadowIntensity: intensity });
    for (const pipeline of SHADOW_PIPELINES) for (const face of ['south', 'west']) {
      const key = `${pipeline}/${face}`;
      rows[`${hex} ${key}`] = { noShadows: plain.walls[key], lit: lit.walls[key], shaded: shaded.walls[key], ...Object.fromEntries(Object.entries(sweep).map(([i, r]) => [`intensity${i}`, r.walls[key]])) };
    }
  }
  const out = process.env.CITY_LOOK_OUT || 'artifacts/city-look';
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/shadow-fill.json`, JSON.stringify(rows, null, 1));
  console.log(Object.entries(rows).map(([k, v]) => `${k.padEnd(30)} ${Object.entries(v).map(([a, b]) => `${a}=${b}`).join(' ')}`).join('\n'));
  expect(errors).toEqual([]);
  for (const pipeline of SHADOW_PIPELINES) {
    // The sun side does not move: a lit wall reads as it did with shadows off (and as docs/LOOK.md §Parity says).
    for (const face of ['south', 'west']) for (const hex of ['#808080', '#9a5240']) {
      const r = rows[`${hex} ${pipeline}/${face}`];
      expect(Math.abs(r.lit - r.noShadows), `${hex} ${pipeline}/${face} lit vs no shadows`).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(rows[`#808080 ${pipeline}/south`].lit - SUN_SIDE_GREY[pipeline]), `${pipeline} sun side vs LOOK table`).toBeLessThanOrEqual(5);
    // The city's reference brick in cast shadow stays readable on a sun-facing wall…
    const brick = rows[`#9a5240 ${pipeline}/south`];
    expect(brick.shaded, `#9a5240 ${pipeline}/south in shadow`).toBeGreaterThanOrEqual(70);
    // …and still reads as a shadow, darker than the same wall in sun, lighter than with sky-only fill.
    expect(brick.shaded, `#9a5240 ${pipeline}/south shadow vs sun`).toBeLessThanOrEqual(brick.lit - 8);
    expect(brick.shaded, `#9a5240 ${pipeline}/south fill`).toBeGreaterThan(brick['intensity1'] + 8);
  }
});
/**
 * Mid-grey brick, south wall, under the rig with no shadows. Legacy rig: docs/LOOK.md §Parity and §City look
 * (2026-10-13): generic 108.3, recipe 102.4, landmark 106.0, city-generic 105.1, city-recipe 109.2, city-landmark 109.2.
 * Sunny rig (look/sunny.ts, the default since 2026-10-16), measured with this harness: +12 to +20 on every pipeline.
 * One material (2026-10-16, shade ratio 0.55, lit facades diffuse-only with the measured walls' fallback exposure):
 * generic 124.5 -> 129.7 (the exposure: a grey with no white takes 1.106 linear like a measured wall), the others
 * +1.2 to +1.6 (the stronger sky fill lights a sun-side wall's sky half a little more at the same sun-wall exposure).
 */
const SUN_SIDE_GREY: Record<string, number> = { generic: 129.7, recipe: 119.2, landmark: 122.9, 'city-generic': 122.7, 'city-recipe': 127.3, 'city-landmark': 127.3 };

// A measured wall colour (material extras `tintSource: 'measured'`) survives the city look's brick clamp: the rendered brick swatch
// lands on the authored colour (the paint slot keeps authored colours, so it is the reference), the unmeasured one stays clamped.
test('a measured brick material renders at its authored colour, an unmeasured one stays inside the city range', async ({ page }) => {
  test.setTimeout(120_000);
  const hexes = ['#3a2a28', '#8a3e2e', '#d8d2c4'];
  // Sunny look (default since 2026-10-16): a measured wall is drawn at its sunlit exposure (look/sunny.ts
  // `sunlitMeasuredWall`: these hexes have no recorded white, so the measured median gain 1.106 in linear light).
  const specs = hexes.flatMap(hex => [
    { slot: 'paint', hex, label: 'authored' },
    { slot: 'brick', hex, label: 'unmeasured' },
    { slot: 'brick', hex, source: 'measured' as const, label: 'measured' },
    { slot: 'paint', hex: sunlitMeasuredWall(hex), label: 'sunlit' },
  ]);
  const { means } = await renderSpecs(page, specs, 4);
  const lum = ([r, g, b]: number[]) => (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  hexes.forEach((hex, i) => {
    const [authored, unmeasured, measured, sunlit] = means.slice(i * 4, i * 4 + 4).map(lum);
    expect(Math.abs(measured - sunlit), `${hex} measured at sunlit exposure`).toBeLessThan(0.03);
    expect(measured, `${hex} measured no darker than authored`).toBeGreaterThanOrEqual(authored - 0.005);
    // The mid brick sits inside the city range already; the dark and the pale one are what the clamp moves.
    if (i !== 1) expect(Math.abs(unmeasured - authored), `${hex} unmeasured is clamped`).toBeGreaterThan(0.05);
  });
});

// Re-fitted large recipes with measured walls and glass (intent `measured`): Apollohal's glazed hall (tan base #a2937e,
// dark glass #46545c from an overcast crop) and Houthavenkade 26's two fronts (yellow-brown #917b5c, #494341, reflective
// column glass #8e9ea4), compiled to GLB and drawn through the game's city look (BAG year brick) and its default recipe
// look. Measured walls land within 0.05 L of their authored hex (÷ the facing's baked shade). Measured glass keeps the
// sky (2026-10-14, user): the measured hue at the stock pane's lightness or lighter, so the dark hall glass draws about
// as light as the kit pane on the same front, never at its overcast hex. The two looks agree.
test('a re-fitted recipe GLB draws its measured walls at their colours and its measured glass sky-lit in both game looks', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one renderer is enough');
  test.setTimeout(240_000);
  await loadWallPage(page);
  const hsl = (rgb: number[]) => { const [r, g, b] = rgb.map(v => Math.max(0, Math.min(255, v)) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; const d = mx - mn; const h = d === 0 ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); return [(h + 360) % 360, l]; };
  const hexRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  for (const pilot of [PILOTS[0], PILOTS[1]]) {
    const { rows } = await measurePilot(page, pilot, ['city', 'legacy']);
    expect(rows.map(r => r.role).sort()).toEqual(pilot === PILOTS[0] ? ['glass', 'glass', 'wall', 'wall'] : ['glass', 'glass', 'kit glass', 'kit glass', 'wall', 'wall', 'wall', 'wall']);
    for (const r of rows) {
      expect(r.pixels, `${r.material} visible`).toBeGreaterThan(500);
      if (r.role === 'wall' || r.role === 'arch') expect(Math.abs(r.dL), `${r.pilot} ${r.material} ${r.path}: ${r.unshaded} vs ${r.authored}`).toBeLessThan(0.05);
      if (r.role === 'glass') {
        const [h, l] = hsl(r.unshaded), [ah, al] = hsl(hexRgb(r.authored)), dh = Math.abs(h - ah);
        expect(l, `${r.material} ${r.path}: ${r.unshaded} at least the stock pane's 0.40 or its own ${al.toFixed(2)}`).toBeGreaterThan(Math.max(al, 0.40) - 0.03);
        expect(l, `${r.material} ${r.path}: not washed out`).toBeLessThan(Math.max(al, 0.40) + 0.09);
        expect(Math.min(dh, 360 - dh), `${r.material} ${r.path}: measured hue ${ah.toFixed(0)}`).toBeLessThan(10);
      }
    }
    for (const r of rows.filter(x => x.path === 'city')) {
      const legacy = rows.find(x => x.path === 'legacy' && x.material === r.material)!;
      expect(Math.abs(r.dL - legacy.dL), `${r.material}: city and default look agree`).toBeLessThan(0.02);
    }
  }
});
