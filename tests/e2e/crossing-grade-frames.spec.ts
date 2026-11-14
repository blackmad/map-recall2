import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';

// Lane crossing-grade 2026-11-14 (user: "these roads should probably figure out 'I don't dip down'"): in-game frames at
// the crossings bankClimb levels (wayDecks.ts BANK_CLIMB_MAX_M), own engine. CG_BEFORE=1 shoots the before
// (`?bankClimb=0`). Compare against the PDOK orthophoto (plot-way-decks.ts). Opt-in:
//   CG_FRAMES=1 [CG_BEFORE=1] CG_OUT=dir PW_PORT=4463 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/crossing-grade-frames.spec.ts --project=desktop --workers=1
test.skip(!process.env.CG_FRAMES, 'set CG_FRAMES=1');

const BEFORE = process.env.CG_BEFORE === '1';
const OUT = process.env.CG_OUT || `artifacts/own-ground/crossing-grade-frames/${BEFORE ? 'before' : 'after'}`;

const SPOTS: readonly { name: string; lng: number; lat: number; bearing: number; zoom: number; pitch: number; top?: boolean; ride?: { lng: number; lat: number; bearing: number } }[] = [
  // The user's shot: the Ringweg-West and its slip (OSM 7382981, 7382983) over the Slotervaart from the north.
  { name: 'lelylaan-user', lng: 4.8428, lat: 52.3563, bearing: 180, zoom: 18.4, pitch: 58 },
  // The trial's side pose: across the slip, where its extended deck opened the carriageway beside it.
  { name: 'lelylaan-side', lng: 4.84294, lat: 52.35607, bearing: 90, zoom: 19.4, pitch: 72 },
  // Haarlemmer Houttuinen (OSM 7376117) over the Westerdok's mouth beside the railway viaduct.
  { name: 'haarlemmer-houttuinen', lng: 4.89017, lat: 52.38213, bearing: 45, zoom: 18.8, pitch: 64 },
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

test('crossing grade: oblique frames at the Lelylaan slip and Haarlemmer Houttuinen', async ({ page }, info) => {
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  await page.goto(`/canal-drive/?ride=free&engine=own${BEFORE ? '&bankClimb=0' : ''}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.CG_ONLY?.split(',');
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
