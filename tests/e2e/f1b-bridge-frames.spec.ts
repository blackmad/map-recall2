import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';

// Lane F1b 2026-11-14: in-game frames at the bridge follow-ups of lane F1 (scripts/own-ground/bridge-feedback-pins.ts
// f1bRegressions), own engine. F1B_BEFORE=1 shoots the before with the three fixes off (`?medianEdges=0&capSmooth=0
// &holeStreets=0`). Compare against the PDOK orthophoto (audit-bridge-railings --plot, probe-way-deck-plot). Opt-in:
//   F1B_FRAMES=1 [F1B_BEFORE=1] F1B_OUT=dir PW_PORT=4431 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/f1b-bridge-frames.spec.ts --project=desktop --workers=1
test.skip(!process.env.F1B_FRAMES, 'set F1B_FRAMES=1');

const BEFORE = process.env.F1B_BEFORE === '1';
const OUT = process.env.F1B_OUT || `artifacts/own-ground/f1b-bridge-frames/${BEFORE ? 'before' : 'after'}`;

/**
 * Poses: an oblique aerial (centre, bearing, zoom, pitch) and a top-down one at the same centre (railings against the
 * orthophoto); `ride`: a chase pose at the feedback note's player position, its heading as a bearing.
 */
const SPOTS: readonly { name: string; lng: number; lat: number; bearing: number; zoom: number; pitch: number; top?: boolean; ride?: { lng: number; lat: number; bearing: number } }[] = [
  // Ringweg-Noord over the Noordhollandsch Kanaal: the A10's south parapet on the hard shoulder (medianEdges).
  { name: 'ringweg-noord-7376770', lng: 4.89915, lat: 52.42368, bearing: 50, zoom: 19.2, pitch: 55, top: true },
  { name: 'ringweg-noord-7376548', lng: 4.90766, lat: 52.42084, bearing: 140, zoom: 19.2, pitch: 55, top: true },
  // Survey-cap railing steps (capSmooth): BRU0407 lamp-pier bays, BRU0415 a slanted deck edge.
  { name: 'bru0407', lng: 4.87885, lat: 52.35103, bearing: 20, zoom: 20, pitch: 45, top: true },
  { name: 'bru0415', lng: 4.868152, lat: 52.344118, bearing: 270, zoom: 19.6, pitch: 50, top: true },
  // Lelylaan 07ec0473: the cycle path and street under the Ringweg-West decks (holeStreets); the note's own pose.
  { name: 'lelylaan-07ec0473', lng: 4.8424, lat: 52.35628, bearing: 95, zoom: 19.6, pitch: 62, top: true, ride: { lng: 4.842787644249858, lat: 52.3560454902552, bearing: 188 } },
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

test('f1b bridges: oblique and top-down frames, the Lelylaan ride pose', async ({ page }, info) => {
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  await page.goto(`/canal-drive/?ride=free&engine=own${BEFORE ? '&medianEdges=0&capSmooth=0&holeStreets=0' : ''}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.F1B_ONLY?.split(',');
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
