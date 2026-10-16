import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PARITY_FACES, PARITY_TOLERANCE, lumaSpread, type ParityResult } from '../../src/canalRecall/look/lookParityMath';

// Look parity (docs/LOOK.md, "Parity"): the same mid-grey brick slot on a landmark
// GLB, a recipe house and a generic streamed extrusion must land within
// PARITY_TOLERANCE of each other under the shared light rig (`?sharedFrame=1`).
// Guards the "is this building really this dark?" / "unlit against the shaded
// city" complaints. Bundles src/canalRecall/look/lookParity.ts with three.js on
// the fly (no committed bundle) and renders it in the dev server's origin so the
// real Bricks057 photo and cell painters are used.
//   PW_PORT=4424 npx playwright test look-parity --project=desktop
const OUT = process.env.LOOK_PARITY_OUT || 'artifacts/look-parity';

test('shared rig: landmark, recipe house and generic extrusion brick within tolerance', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one renderer is enough');
  test.setTimeout(180_000);
  const bundle = await build({ entryPoints: ['src/canalRecall/look/lookParity.ts'], bundle: true, format: 'iife', globalName: 'LookParity', write: false, logLevel: 'error' });
  const js = bundle.outputFiles[0].text;
  await page.route('**/canal-drive/__look-parity.js', route => route.fulfill({ body: js, contentType: 'application/javascript' }));
  await page.route('**/canal-drive/__look-parity.html', route => route.fulfill({ body: '<!doctype html><meta charset="utf-8"><script src="__look-parity.js"></script>', contentType: 'text/html' }));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/canal-drive/__look-parity.html');
  const result: ParityResult = await page.evaluate(() => (window as any).LookParity.runLookParity({ brickUrl: new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href }));
  expect(errors).toEqual([]);
  mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = { ...result, spreads: {} };
  for (const face of PARITY_FACES) {
    (report.spreads as any)[face] = { shared: lumaSpread(result, ['generic', 'recipe', 'landmark'], face), legacyUnlit: lumaSpread(result, ['generic-unlit', 'recipe-unlit'], face) };
  }
  writeFileSync(`${OUT}/parity.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
  // The grey reference has three colour rules since the one-material pass (2026-10-16): the generic wall reads #808080
  // as a photo colour at sunlit exposure (x1.106 linear), the unmeasured recipe slot lifts it into the city brick range
  // (cityWallTint) and the landmark keeps it as authored. Their light is one (next test); the spread is the colour.
  for (const face of PARITY_FACES) {
    const { spread, min, max } = lumaSpread(result, ['generic', 'recipe', 'landmark'], face);
    expect(spread, `${face}: ${min[0]} ${min[1]} vs ${max[0]} ${max[1]}`).toBeLessThanOrEqual(PARITY_TOLERANCE + 0.02);
  }
});

// One material (docs/one-material-20261016.md, user 2026-10-16: "can't you just match the materials between them?"):
// a wall of one measured colour draws the same pixel on a generic extrusion, a street chunk (its strip says the wall is
// that colour) and a measured recipe house, on every orientation; and every path, landmarks and unmeasured recipe
// slots included, has the one light response: the same shade-to-sun ratio per orientation.
//   PW_PORT=4561 npx playwright test look-parity -g "one material" --project=desktop
/** Max luma (0-255) between the three paths for one measured colour; measured 0.2-1.9 (the chunk's strip ratio is luma-only). */
const ONE_MATERIAL_LUMA = 2.5;
test('one material: same measured colour, same pixel; same light response on every path', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one renderer is enough');
  test.setTimeout(240_000);
  const bundle = await build({ entryPoints: ['src/canalRecall/look/lookParity.ts'], bundle: true, format: 'iife', globalName: 'LookParity', write: false, logLevel: 'error' });
  await page.route('**/canal-drive/__look-parity.js', route => route.fulfill({ body: bundle.outputFiles[0].text, contentType: 'application/javascript' }));
  await page.route('**/canal-drive/__look-parity.html', route => route.fulfill({ body: '<!doctype html><meta charset="utf-8"><script src="__look-parity.js"></script>', contentType: 'text/html' }));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/canal-drive/__look-parity.html');
  const pipelines = ['generic', 'chunk', 'recipe-measured', 'recipe', 'landmark'];
  const report: Record<string, unknown> = {};
  for (const hex of ['#808080', '#9a5240', '#6f4335', '#4a3a33', '#c9b9a0']) {
    const r: ParityResult = await page.evaluate(({ hex, pipelines }) => (window as any).LookParity.runLookParity({ hex, pipelines, brickUrl: new URL('materials/ambientcg/Bricks057/colour.jpg', document.baseURI).href }), { hex, pipelines });
    report[hex] = r.walls;
    for (const face of PARITY_FACES) {
      const { spread, min, max } = lumaSpread(r, ['generic', 'chunk', 'recipe-measured'], face);
      expect(max[1] - min[1], `${hex} ${face}: ${min[0]} ${min[1]} vs ${max[0]} ${max[1]} (spread ${spread})`).toBeLessThanOrEqual(ONE_MATERIAL_LUMA);
      // The light response: each path's face over its own sun-facing (south) wall matches the generic wall's.
      const ratio = (p: string) => r.walls[`${p}/${face}`] / r.walls[`${p}/south`];
      for (const p of pipelines) expect(Math.abs(ratio(p) - ratio('generic')), `${hex} ${p} ${face}/south ${ratio(p)} vs generic ${ratio('generic')}`).toBeLessThanOrEqual(0.02);
    }
  }
  expect(errors).toEqual([]);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/one-material.json`, JSON.stringify(report, null, 1));
});
