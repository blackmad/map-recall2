/**
 * Street-furniture frames (lane #170): the ride camera (?engine=own, chase) at three spots, with and without the
 * furniture layer (`?furniture=0`), for the likeness sheets beside the data.amsterdam panorama of the same corner
 * (scripts/street-furniture/likeness-sheet.ts). Asserts the layer drew instances within its draw budget.
 *
 *   PW_PORT=4818 SF_OUT=staging/street-furniture/frames npx playwright test tests/e2e/street-furniture-shots.spec.ts --workers=1 --project=desktop
 *
 * Before the integrator adds the script tag and rebuilds the bundles: SF_BUNDLES_DIR=staging/street-furniture/bundles
 * serves the lane's engine and furniture bundles, and the tag is injected after the trees bundle.
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openRoute } from './helpers';

import { SPOTS } from './street-furniture-spots';
const OUT = process.env.SF_OUT ?? 'staging/street-furniture/frames';
const only = process.env.SF_SPOTS?.split(',').filter(Boolean);

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

async function prepare(page: Page) {
  const dir = process.env.SF_BUNDLES_DIR;
  if (dir) {
    await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
      const file = join(dir, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
      return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
    });
    await page.addInitScript({ path: 'staging/street-furniture/inject.js' });
  }
}

for (const spot of SPOTS) {
  if (only && !only.includes(spot.name)) continue;
  for (const variant of ['before', 'after'] as const) {
    test(`street furniture: ${spot.name} ${variant}`, async ({ page }, info) => {
      test.setTimeout(300_000);
      if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
      await prepare(page);
      await openRoute(page, { travelMode: 'car', viewMode: 'chase', query: `?engine=own${variant === 'before' ? '&furniture=0' : ''}` });
      await teleport(page, spot.stand);
      await page.waitForTimeout(2500);
      await teleport(page, spot.stand);
      await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 150_000, intervals: [1000] }).toBe(0);
      if (variant === 'after') {
        await expect.poll(() => page.evaluate(() => (window as any).__canalStreetFurniture?.debug?.instances ?? 0), { timeout: 60_000, intervals: [500] }).toBeGreaterThan(0);
      }
      await page.waitForTimeout(Number(process.env.SF_WAIT ?? 4000));
      const debug = await page.evaluate(() => { const d = (window as any).__canalStreetFurniture?.debug; return d ? { ...d } : null; });
      console.log(JSON.stringify({ spot: spot.name, variant, project: info.project.name, debug }));
      if (variant === 'after') {
        expect(debug.draws, 'instanced furniture draws').toBeLessThanOrEqual(6);
        expect(debug.triangles, 'furniture triangles on screen').toBeLessThanOrEqual(40_000);
      } else expect(debug, '?furniture=0 builds no layer').toBeNull();
      mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: `${OUT}/${spot.name}-${variant}-${info.project.name}.png` });
    });
  }
}
