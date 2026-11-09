/**
 * Yard-fill frames (lane new-bag-prisms-20261109): the ride camera at the three 2026-11-09 feedback spots, with and
 * without `?yardFill=1`. The engine bundle and the staged data are served from the lane's staging dir until the
 * integrator publishes them:
 *   node scripts/build-canal-engine.mjs --outdir=staging/yard-fill/bundles
 *   PW_PORT=4749 bash /tmp/canal-pw.sh tests/e2e/yard-fill-shots.spec.ts --workers=1 --project=desktop
 * Frames: staging/yard-fill/frames/<spot>-<before|after>.png
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

export const YARD_SPOTS = [
  { name: 'moermanskkade', lng: 4.8721, lat: 52.3992, bearing: 90 },
  { name: 'hornweg', lng: 4.8041, lat: 52.4076, bearing: 0 },
  { name: 'zaanstraat', lng: 4.8739, lat: 52.3899, bearing: 0 },
];
const OUT = 'staging/yard-fill/frames';

async function teleport(page: Page, p: { lng: number; lat: number; bearing: number }) {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

for (const spot of YARD_SPOTS) for (const variant of ['before', 'after'] as const) {
  test(`yard fill: ${spot.name} ${variant}`, async ({ page }, info) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(/\/canal-drive\/js\/(engine\.bundle\.js)(\?.*)?$/, route => {
      const file = join('staging/yard-fill/bundles', 'engine.bundle.js');
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    await page.route(/\/data\/extracts\/amsterdam\/yard-fill\/([\w-]+\.json)$/, route => {
      const name = /yard-fill\/([\w-]+\.json)/.exec(route.request().url())![1];
      return route.fulfill({ body: readFileSync(join('scripts/data/yard-fill', name)), contentType: 'application/json' });
    });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: `?engine=own${variant === 'after' ? '&yardFill=1' : ''}` });
    await teleport(page, spot);
    await page.waitForTimeout(2500);
    await teleport(page, spot);
    await page.evaluate(() => { (window as any).canalRecallGame.camera.zoom = 0.5; });
    await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 150_000, intervals: [1000] }).toBe(0);
    await page.waitForTimeout(4000);
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: `${OUT}/${spot.name}-${variant}.png` });
  });
}
