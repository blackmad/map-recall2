import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';
import { OPEN_GROUND_SPOTS } from '../../src/canalRecall/ownGround/openGroundRegressions';

// Lane open-ground-look 2026-11-10: ride frames at the open-ground spots (openGroundRegressions.ts), own engine, the
// rider stood at each spot's frame pose with the chase camera, then a low aerial over it. OPEN_GROUND_BEFORE=1 shoots
// with `?openGround=0` (open ground drawn as the land, the before). Opt-in:
//   OPEN_GROUND_FRAMES=1 [OPEN_GROUND_BEFORE=1] [BUNDLES_DIR=dir] OPEN_GROUND_SHOTS_OUT=dir PW_PORT=4436 \
//     bash /tmp/canal-pw.sh npx playwright test tests/e2e/open-ground-frames.spec.ts --project=desktop --workers=1
test.skip(!process.env.OPEN_GROUND_FRAMES, 'set OPEN_GROUND_FRAMES=1');

const BEFORE = process.env.OPEN_GROUND_BEFORE === '1';
const OUT = process.env.OPEN_GROUND_SHOTS_OUT || `artifacts/own-ground/open-ground-frames/${BEFORE ? 'before' : 'after'}`;

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

test('open ground: ride frames at the named spots', async ({ page }, info) => {
  test.setTimeout(1_500_000);
  mkdirSync(OUT, { recursive: true });
  await useBundlesDir(page);
  await page.goto(`/canal-drive/?ride=free&engine=own${BEFORE ? '&openGround=0' : ''}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.OPEN_GROUND_ONLY?.split(',');
  for (const spot of OPEN_GROUND_SPOTS) {
    if (only && !only.includes(spot.name)) continue;
    const f = spot.frame;
    // Ride: the rider at the frame pose, the game's own chase camera.
    await place(page, f.lng, f.lat, f.bearing);
    await settleWorld(page, `${spot.name} ride`);
    await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.ready) { g.residencyAt = null; g.updateResidency(); } });
    await settleWorld(page, `${spot.name} ride re-planned`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.name}-ride.png` });
  }
  // Aerial: the camera held over each spot (the rider stays there, so its cells are the near ring's).
  for (const spot of OPEN_GROUND_SPOTS) {
    if (only && !only.includes(spot.name)) continue;
    const f = spot.frame;
    await place(page, f.lng, f.lat, f.bearing);
    const pose = { center: [spot.lng, spot.lat], zoom: 18.6, pitch: 45, bearing: f.bearing };
    const jump = () => page.evaluate((p) => {
      const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
      vm.__held ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      vm.jumpToLngLat({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, elevation: g?.ready ? g.heightAt(p.center) : 0 });
    }, pose);
    await jump();
    await settleWorld(page, `${spot.name} air`);
    await jump();
    await settleWorld(page, `${spot.name} air again`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.name}-air.png` });
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if (vm.__held) { vm.sync = vm.__held.sync; vm.aimAtWorld = vm.__held.aimAtWorld; vm.__held = null; } });
  }
});
