import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Parks on the own ground (lane parks 2026-10-13, docs/handoffs/lane-parks-20261013.md): BGT park
// surfaces, hedges, fences, benches, lamps, the playground kit. Chase, 300 m and 40 m shots per park
// spot plus the cost of each park cell (triangles, build ms). SHOT_TAG=before|after. Opt-in:
//   OWN_GROUND=1 PW_PORT=4471 SHOT_TAG=after npx playwright test own-ground-parks --project=desktop
// PARKS=0 turns the parks layer off (`__canalRecallParks = false`) for the "before" set.
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-parks';
const TAG = process.env.SHOT_TAG ?? 'after';
type Place = { lng: number; lat: number; bearing: number };

export const PARK_SPOTS: [string, Place][] = [
  // The user's screenshot (2026-10-13): J.J. Cremerplein playground and the neighbourhood centre.
  ['cremerplein', { lng: 4.85860, lat: 52.35935, bearing: 300 }],
  ['bellamyplein', { lng: 4.86770, lat: 52.36795, bearing: 30 }],
  ['vondelpark-blauwe-theehuis', { lng: 4.87200, lat: 52.35860, bearing: 80 }],
  ['oosterpark', { lng: 4.91900, lat: 52.35940, bearing: 40 }],
  ['sarphatipark', { lng: 4.89480, lat: 52.35400, bearing: 70 }],
  ['westerpark', { lng: 4.87100, lat: 52.38640, bearing: 80 }],
];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript((parks: boolean) => {
    (window as any).__canalRecallOwnGround = true;
    if (!parks) (window as any).__canalRecallParks = false;
  }, process.env.PARKS !== '0');
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

/** rAF cadence and the cell under the spot: its triangles per layer and build time. */
async function cost(page: Page, p: Place): Promise<Record<string, unknown>> {
  return page.evaluate(async ({ lng, lat }) => {
    const vm = (window as any).canalRecallGame.vectorMap, ground = vm._ownGround, map = vm.map;
    const times: number[] = [];
    let last = performance.now();
    for (let i = 0; i < 120; i++) { map.triggerRepaint(); await new Promise<void>(r => requestAnimationFrame(() => r())); const t = performance.now(); times.push(t - last); last = t; }
    times.sort((a, b) => a - b);
    const key = ground.cellKeyAt ? ground.cellKeyAt([lng, lat]) : null;
    const cell = key && ground.cellStats ? ground.cellStats(key) : {};
    return { key, frameMedianMs: +times[60].toFixed(1), frameP95Ms: +times[114].toFixed(1), ...cell };
  }, p);
}

test('park spots: chase, 300 m and 40 m shots, cost per park cell', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const only = process.env.SPOTS?.split(',');
  const rows: Record<string, unknown>[] = [];
  for (const [name, place] of PARK_SPOTS) {
    if (only && !only.includes(name)) continue;
    await teleport(page, place);
    await settle(page);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-chase.png` });
    rows.push({ name, ...(await cost(page, place)) });
    console.log(JSON.stringify(rows[rows.length - 1]));
    await look(page, place, 300, 300);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-300m.png` });
    await look(page, place, 40, 40);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${TAG}-${name}-40m.png` });
  }
  writeFileSync(`${OUT}/${info.project.name}-${TAG}-cost.json`, JSON.stringify(rows, null, 1));
  expect(errors).toEqual([]);
});
