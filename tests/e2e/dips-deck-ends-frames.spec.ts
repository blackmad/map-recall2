import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';

// Lane dips-deck-ends 2026-11-14: in-game frames at the crossings and deck ends wayEnds changes (wayDecks.ts
// WAY_END_DIP_M), own engine. DD_BEFORE=1 shoots the before (`?wayEnds=0`). Opt-in:
//   DD_FRAMES=1 [DD_BEFORE=1] DD_OUT=dir PW_PORT=4533 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/dips-deck-ends-frames.spec.ts --project=desktop --workers=1
test.skip(!process.env.DD_FRAMES, 'set DD_FRAMES=1');

const BEFORE = process.env.DD_BEFORE === '1';
const OUT = process.env.DD_OUT || `artifacts/own-ground/dips-deck-ends-frames/${BEFORE ? 'before' : 'after'}`;

const SPOTS: readonly { name: string; lng: number; lat: number; bearing: number; zoom: number; pitch: number; top?: boolean; ride?: { lng: number; lat: number; bearing: number } }[] = [
  // Haarlemmer Houttuinen (OSM 7376117) on the viaduct under the flat footprint BRU0095, over the Westerdok's mouth.
  { name: 'haarlemmer-houttuinen', lng: 4.89017, lat: 52.38213, bearing: 45, zoom: 18.8, pitch: 64 },
  // The Amsterdamse Baan links (424283770 / 424283771) flying over the polder.
  { name: 'amsterdamse-baan', lng: 4.7565, lat: 52.34344, bearing: 120, zoom: 18.2, pitch: 62 },
  // The Kabouterbrug (BRU0360, flat) carrying the Schinkelhavenstraat cycleway (OSM 38282903).
  { name: 'kabouterbrug', lng: 4.85372, lat: 52.35476, bearing: 0, zoom: 19.4, pitch: 66 },
  // Van der Madeweg (1251743255 / 1339616201) over the water, the bundle's deck to its ends.
  { name: 'van-der-madeweg', lng: 4.93744, lat: 52.32953, bearing: 90, zoom: 18.8, pitch: 64 },
];

async function place(page: Page, lng: number, lat: number, bearing: number): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
  }, { lng, lat, bearing });
}

test('dips: oblique frames at Haarlemmer Houttuinen, the Amsterdamse Baan, the Kabouterbrug and Van der Madeweg', async ({ page }, info) => {
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  await page.goto(`/canal-drive/?ride=free&engine=own${BEFORE ? '&wayEnds=0' : ''}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.DD_ONLY?.split(',');
  for (const spot of SPOTS) {
    if (only && !only.includes(spot.name)) continue;
    if (spot.ride) {
      await place(page, spot.ride.lng, spot.ride.lat, spot.ride.bearing);
      await settleWorld(page, `${spot.name} ride`);
      await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.ready) { g.residencyAt = null; g.updateResidency(); } });
      await settleWorld(page, `${spot.name} ride re-planned`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.name}-ride.png` });
    }
    await place(page, spot.lng, spot.lat, spot.bearing);
    for (const [view, pitch, zoom] of [['air', spot.pitch, spot.zoom], ...(spot.top ? [['top', 0, spot.zoom + 0.3]] : [])] as [string, number, number][]) {
      const pose = { center: [spot.lng, spot.lat], zoom, pitch, bearing: view === 'top' ? 0 : spot.bearing };
      const jump = () => page.evaluate((p) => {
        const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
        vm.__held ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
        vm.sync = () => {}; vm.aimAtWorld = () => {};
        vm.jumpToLngLat({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, elevation: g?.ready ? g.heightAt(p.center) : 0 });
      }, pose);
      await jump();
      await settleWorld(page, `${spot.name} ${view}`);
      await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.ready) { g.residencyAt = null; g.updateResidency(); } });
      await jump();
      await settleWorld(page, `${spot.name} ${view} again`);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.name}-${view}.png` });
      await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if (vm.__held) { vm.sync = vm.__held.sync; vm.aimAtWorld = vm.__held.aimAtWorld; vm.__held = null; } });
    }
  }
});
