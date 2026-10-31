import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// POI labels behind buildings under ?engine=own (#129, user report 2026-10-31): on Eerste Constantijn Huygensstraat
// looking north from the Overtoom crossing (chase view), "Anmol" and "Snackbar Miriam" floated over the roofs of
// the blocks whose far side holds the shop. engine/labelOcclusion.ts hides a POI label whose shopfront faces away
// from the camera or whose sightline a nearer building blocks; the street-frontage shops stay labelled.
//
//   PW_PORT=4523 npx playwright test label-occlusion --project=desktop
//   LABEL_OCCLUSION_OUT=artifacts/label-occlusion also saves the before (occlusion off) and after frames.

const STAND = { lng: 4.87523, lat: 52.36262, bearing: 340 }; // 20 m south of the crossing, facing up the street
const HIDDEN = ['Anmol', 'Snackbar Miriam'];
const FRONTAGE = ['Albert Heijn', 'Kartika'];

async function teleport(page: Page, p: typeof STAND): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

const placedPois = (page: Page, occlusion: boolean): Promise<string[]> => page.evaluate(async on => {
  const vm = (window as any).canalRecallGame.vectorMap;
  vm.labelOcclusionOn = on;
  await new Promise(r => setTimeout(r, 1200)); // the switch forces a full placement on the next frame
  return vm._labels.placed.filter((l: { kind: string }) => l.kind === 'poi').map((l: { text: string }) => l.text);
}, occlusion);

test('a POI label behind a nearer building is not drawn; the street-frontage labels still are', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1800, height: 1100 });
  await openRoute(page, { query: '?engine=own', viewMode: 'chase' });
  expect(await page.evaluate(() => (window as any).canalRecallGame.vectorMap.engine)).toBe('own');
  await teleport(page, STAND);
  await page.waitForTimeout(2500);
  await teleport(page, STAND); // the game re-routes after the first jump; pin the spot again
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame.vectorMap.pendingWork().length), { timeout: 120_000, intervals: [500] }).toBe(0);
  await page.waitForTimeout(3000);

  const out = process.env.LABEL_OCCLUSION_OUT;
  const off = await placedPois(page, false);
  if (out) await page.screenshot({ path: `${out}/before-occlusion.png` });
  const on = await placedPois(page, true);
  if (out) await page.screenshot({ path: `${out}/after-occlusion.png` });
  console.log(JSON.stringify({ off, on }));

  for (const name of HIDDEN) {
    expect(off, `${name} competes at this pose with occlusion off (the user's report)`).toContain(name);
    expect(on, `${name} sits behind a nearer roof: not drawn`).not.toContain(name);
  }
  for (const name of FRONTAGE) expect(on, `${name} faces the street: still drawn`).toContain(name);
  const stats = await page.evaluate(() => ({ ...(window as any).canalRecallGame.vectorMap._labels.stats }));
  expect(stats.occluded, 'occlusion hid something at the last full placement').toBeGreaterThan(0);
});
