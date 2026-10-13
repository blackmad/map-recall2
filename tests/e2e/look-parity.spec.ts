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
  for (const face of PARITY_FACES) {
    const { spread, min, max } = lumaSpread(result, ['generic', 'recipe', 'landmark'], face);
    expect(spread, `${face}: ${min[0]} ${min[1]} vs ${max[0]} ${max[1]}`).toBeLessThanOrEqual(PARITY_TOLERANCE);
  }
});
