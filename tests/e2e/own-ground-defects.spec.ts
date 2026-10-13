import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { openRoute } from './helpers';

// Own-ground defect spots (lane own-ground-defects 2026-10-13): junction cycle-lane smear,
// De Clercqstraat area:highway, the Magere Brug frames and railings, BRU0077's hump.
// Chase shot, a 300 m shot and a 40 m shot per spot; SHOT_TAG=before|after. Opt-in:
//   OWN_GROUND=1 PW_PORT=4460 SHOT_TAG=before npx playwright test own-ground-defects --project=desktop
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-defects';
const TAG = process.env.SHOT_TAG ?? 'after';
type Place = { lng: number; lat: number; bearing: number };

export const DEFECT_SPOTS: [string, Place][] = [
  ['rozengracht-marnixstraat', { lng: 4.8748, lat: 52.37195, bearing: 70 }],
  ['rozengracht-junction', { lng: 4.874103, lat: 52.371797, bearing: 250 }],
  ['de-clercqstraat-22', { lng: 4.8696, lat: 52.37077, bearing: 250 }],
  ['bilderdijk-crossing', { lng: 4.870286, lat: 52.370936, bearing: 70 }],
  ['magere-brug', { lng: 4.90237, lat: 52.36358, bearing: 90 }],
  ['BRU0077', { lng: 4.90263, lat: 52.36151, bearing: 343 }],
];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

async function teleport(page: Page, p: Place): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number, vm = g.vectorMap;
    if (vm.__syncOriginal) vm.sync = vm.__syncOriginal;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

const status = (page: Page) => page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());

async function settle(page: Page, ms = 4000): Promise<Record<string, any>> {
  await expect.poll(async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 180_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(ms);
  return status(page);
}

/** Freeze the camera `dist` m behind the spot along its bearing, `up` m above, looking at it. */
async function look(page: Page, p: Place, dist: number, up: number): Promise<void> {
  await page.evaluate(({ p, dist, up }) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, map = vm.map, ground = vm._ownGround;
    vm.__syncOriginal = vm.__syncOriginal || vm.sync;
    vm.sync = () => {};
    const rad = p.bearing * Math.PI / 180, ux = Math.sin(rad), uy = Math.cos(rad);
    const from: [number, number] = [p.lng - ux * dist / (111320 * Math.cos(p.lat * Math.PI / 180)), p.lat - uy * dist / 111320];
    const to: [number, number] = [p.lng, p.lat];
    map.setMaxPitch?.(85);
    map.jumpTo(map.calculateCameraOptionsFromTo(from, ground.heightAt(from) + up, to, ground.heightAt(to)));
    map.triggerRepaint();
  }, { p, dist, up });
  await page.waitForTimeout(2500);
}

test('defect spots: chase, 300 m and 40 m shots', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const only = process.env.SPOTS?.split(',');
  for (const [name, place] of DEFECT_SPOTS) {
    if (only && !only.includes(name)) continue;
    await teleport(page, place);
    await settle(page);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-chase.png` });
    await look(page, place, 300, 120);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-300m.png` });
    await look(page, place, 40, 25);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-40m.png` });
    await look(page, place, 3, 55);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-top.png` });
  }
  expect(errors).toEqual([]);
});
