import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const baseUrl = arg('base-url') ?? 'http://127.0.0.1:5187';
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(arg('output') ?? `.cache/facade-rebuild/reports/baseline-${runId}`);
const viewport = { width: 1440, height: 900 };
const routeSeed = 0x5eed1234;
await mkdir(output, { recursive: true });
const manifest: Record<string, unknown> = {
  schemaVersion: 1, runId, baseUrl, viewport, routeSeed, travelMode: 'car', viewMode: 'north', capturedAt: new Date().toISOString(),
  scope: 'Loaded Waag comparison and seeded gameplay spawn; no identity certification or hardware performance claim.',
  inputs: {}, views: [],
};
for (const file of ['public/data/extracts/amsterdam/building-tiles/index-z14.json',
  'public/canal-drive/building-compare.html', 'public/canal-drive/js/building-tiles.bundle.js',
  'public/canal-drive/js/pyramidal-roofs.bundle.js', 'public/canal-drive/js/building-style.bundle.js']) {
  (manifest.inputs as Record<string, string>)[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const browser = await chromium.launch({ headless: true });
try {
  for (const kind of ['comparison', 'gameplay'] as const) {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(initialSeed => {
      let state = initialSeed;
      Math.random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
      };
    }, routeSeed);
    await page.goto(`${baseUrl}/canal-drive/${kind === 'comparison' ? 'building-compare.html' : ''}`);
    if (kind === 'comparison') {
      await page.waitForFunction(() => {
        const status = (window as any).canalRecallBuildingCompare?.status();
        return status?.tiles > 0 && status.inFlight === 0 && status.queued === 0;
      }, {}, { timeout: 60000 });
    } else {
      await page.locator('#route-card').waitFor({ state: 'visible', timeout: 45000 });
      // These selects back the visible preference controls and are intentionally hidden.
      await page.locator('#travel-mode').selectOption('car', { force: true });
      await page.locator('#view-mode').selectOption('north', { force: true });
      await page.locator('#route-card').evaluate((form: HTMLFormElement) => form.requestSubmit());
      await page.waitForFunction(() => {
        const view = (window as any).canalRecallGame?.vectorMap;
        const status = view?._completeCity?.status();
        return status?.tiles > 0 && status.inFlight === 0 && status.queued === 0
          && view.map?.querySourceFeatures('osm-building-appearance').length > 100;
      }, {}, { timeout: 90000 });
    }
    // Let the final setData finish drawing before capturing its source features.
    await page.waitForTimeout(2000);
    const state = await page.evaluate(kind => {
      if (kind === 'comparison') {
        const note = document.querySelector<HTMLElement>('#right-note')!;
        const diagnostics = (window as any).canalRecallBuildingCompare;
        return { streaming: diagnostics.status(), ...diagnostics.camera(), note: note.textContent, userAgent: navigator.userAgent };
      }
      const view = (window as any).canalRecallGame.vectorMap, map = view.map;
      return { streaming: view._completeCity.status(), centre: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(),
        sourceFeatures: map.querySourceFeatures('osm-building-appearance').length,
        basemapVisibility: map.getLayoutProperty('building-3d', 'visibility'), userAgent: navigator.userAgent };
    }, kind);
    await page.screenshot({ path: path.join(output, `${kind}.png`) });
    (manifest.views as unknown[]).push({ kind, state, errors, image: `${kind}.png` });
    if (errors.length) throw new Error(`${kind}: ${errors.join('; ')}`);
    await page.close();
  }
  manifest.status = 'loaded';
} catch (error) {
  manifest.status = 'failed';
  manifest.error = String(error);
  throw error;
} finally {
  await browser.close();
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`Loaded city baseline: ${output}`);
