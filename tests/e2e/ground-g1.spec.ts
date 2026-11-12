import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { settleWorld, useBundlesDir } from './helpers';
import { GROUND_SPOTS } from '../../src/canalRecall/ownGround/groundRegressions';

// Lane G1 of the Ground v2 plan (issue #376), own engine.
//
// 1. The underpass ride (always): Overschiestraat under the rail embankment, the user's "black portal box on grass"
//    place. The ground under the street drops into the slot (one slot since portal sanity) and comes back up, and the
//    bike rides through it with ArrowUp held, from 70 m west of the slot to past its east end.
// 2. Ride frames at the G0 named places (opt-in, G1_FRAMES=1): the rider stood at each place with the chase camera,
//    then a low aerial. G1_BEFORE=1 shoots with every G1 fix off (the before).
//      G1_FRAMES=1 [G1_BEFORE=1] [BUNDLES_DIR=dir] G1_SHOTS_OUT=dir PW_PORT=4472 \
//        /tmp/canal-pw.sh npx playwright test tests/e2e/ground-g1.spec.ts --project=desktop --workers=1

const G1_OFF = 'openGroundClip=0&roadStrips=0&portalSanity=0&floatBound=0';

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

async function boot(page: Page, query: string): Promise<void> {
  await useBundlesDir(page);
  await page.goto(`/canal-drive/?ride=free&engine=own${query}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
}

test('Overschiestraat underpass: the ground drops into one slot and the bike rides through', async ({ page }) => {
  test.setTimeout(420_000);
  const LAT = 52.34335, WEST = 4.8394, EAST = 4.8428;
  // A street ride (`?travel=car` applies only with a #race= hash; Free Ride boots on the water as the boat).
  await useBundlesDir(page);
  await page.goto(`/canal-drive/?engine=own&travel=car&governor=0#race=${LAT},${WEST},${LAT},${WEST},${LAT},${EAST}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return !!g?.player?.x && g.vectorMap?._ownGround?.ready; }, null, { timeout: 180_000 });
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.state = 4; g._quizFreezesRide = () => false; });
  await place(page, WEST, LAT, 90);
  await settleWorld(page, 'overschiestraat west');
  // The ground along the street: open road at both ends, the slot floor under the embankment (relief +3 m) between,
  // no higher than the higher end (the street falls ~0.6 m west to east here).
  const profile = await page.evaluate(({ LAT, WEST, EAST }) => {
    const g = (window as any).canalRecallGame.vectorMap._ownGround, out: number[] = [];
    for (let k = 0; k <= 34; k++) out.push(g.heightAt([WEST + ((EAST - WEST) * k) / 34, LAT]));
    return out;
  }, { LAT, WEST, EAST });
  const mid = profile.slice(14, 21), ends = [profile[0], profile[profile.length - 1]];
  expect(Math.max(...mid), `slot floor ${mid.map(z => z.toFixed(2)).join(' ')}`).toBeLessThan(Math.max(...ends) + 0.4);
  expect(Math.max(...profile) - Math.min(...profile), 'no step over the embankment along the street').toBeLessThan(2.5);
  // Ride east through the slot (centreline 4.84037-4.84162 at this latitude) with ArrowUp held, from its west mouth to
  // 30 m past its east end. West of the mouth the street bends off this latitude into the park, so the ride starts at
  // the mouth; the heading is held on the slot's line (the car's free steering is not street-follow).
  const RW = 4.8401, RE = 4.8421;
  await place(page, RW, LAT, 90);
  await page.waitForTimeout(500);
  const x0 = await page.evaluate(() => (window as any).canalRecallGame.player.x);
  await page.keyboard.down('ArrowUp');
  let travelled = 0;
  for (let t = 0; t < 160 && travelled < 1; t++) {
    await page.waitForTimeout(250);
    const r = await page.evaluate(({ x0, EAST, WEST, LAT }) => {
      const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
      const tx = l._lastOffsetX + (EAST + 0.0005 - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      const ty = l._lastOffsetY - (LAT - l._lastCenterLat) * 111320 * ppm;
      g.player.angle = Math.atan2(ty - g.player.y, tx - g.player.x);
      const span = (EAST - WEST) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
      return (g.player.x - x0) / span;
    }, { x0, EAST: RE, WEST: RW, LAT });
    travelled = r;
  }
  await page.keyboard.up('ArrowUp');
  expect(travelled, 'share of the 135 m from the west mouth to 30 m past the east end').toBeGreaterThan(0.85);
});

test('ground G1: ride frames at the named places', async ({ page }, info) => {
  test.skip(!process.env.G1_FRAMES, 'set G1_FRAMES=1');
  test.setTimeout(1_800_000);
  const BEFORE = process.env.G1_BEFORE === '1';
  const OUT = process.env.G1_SHOTS_OUT || `artifacts/own-ground/g1-frames/${BEFORE ? 'before' : 'after'}`;
  mkdirSync(OUT, { recursive: true });
  await boot(page, BEFORE ? `&${G1_OFF}` : '');
  await page.evaluate(() => { const g = (window as any).canalRecallGame; g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; }; });
  const only = process.env.G1_ONLY?.split(',');
  for (const spot of GROUND_SPOTS) {
    if (only && !only.includes(spot.id)) continue;
    const bearing = FRAME_BEARING[spot.id] ?? 0;
    await place(page, spot.lng, spot.lat, bearing);
    await settleWorld(page, `${spot.id} ride`);
    await page.evaluate(() => { const g = (window as any).canalRecallGame.vectorMap._ownGround; if (g?.ready) { g.residencyAt = null; g.updateResidency(); } });
    await settleWorld(page, `${spot.id} ride re-planned`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.id}-ride.png` });
    const pose = { center: [spot.lng, spot.lat], zoom: 18.4, pitch: 50, bearing };
    const jump = () => page.evaluate((p) => {
      const vm = (window as any).canalRecallGame.vectorMap, g = vm._ownGround;
      vm.__held ??= { sync: vm.sync, aimAtWorld: vm.aimAtWorld };
      vm.sync = () => {}; vm.aimAtWorld = () => {};
      vm.jumpToLngLat({ center: p.center, zoom: p.zoom, pitch: p.pitch, bearing: p.bearing, elevation: g?.ready ? g.heightAt(p.center) : 0 });
    }, pose);
    await jump();
    await settleWorld(page, `${spot.id} air`);
    await jump();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${spot.id}-air.png` });
    await page.evaluate(() => { const vm = (window as any).canalRecallGame.vectorMap; if (vm.__held) { vm.sync = vm.__held.sync; vm.aimAtWorld = vm.__held.aimAtWorld; vm.__held = null; } });
  }
});

/** The heading per place: along the way named in groundRegressions.ts, toward the defect. */
const FRAME_BEARING: Record<string, number> = {
  'piet-kranenbergpad': 0, 'amstelveenseweg-viaduct': 180, 'schinkel-jachthavenweg': 200, overschiestraat: 90, sportparklaan: 90,
  'anthony-fokkerweg': 270, 'vlaardingenlaan-naaldwijkstraat': 90, 'lelylaan-delflandlaan': 0, 'radarweg-south-abutment': 0,
};
