import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Named regression (lane R3-F #241, the user 2026-11-07: "can we get better aerial pan?"): from the air over the
// Zuidas (the S4 pose of scripts/aerial-pan.mjs, 4.8775, 52.3385) the own ground installs a cell every few hundred
// ms, and each install re-lifted every resident building chunk on the frame (`sync: ground update: building bases`,
// 609-656 ms summed over the 36 samples' slowest frames of the 3-minute pan). Now the re-base is held while the
// view is aerial and runs as a sliced catch-up when the camera comes down (`?groundBasesAerial=0` restores the old).
// Asserted: no unbudgeted re-base while aerial, a held revision, and after landing a catch-up whose slices stay near
// their 4 ms budget and finish. The A/B (`?groundBasesAerial=0`) shows the old path re-basing on aerial frames.

type Calls = { sliced: number[]; aerialSync: number; streetSync: number };

async function flyAndLand(page: Page, qs: string): Promise<{ calls: Calls; stats: any; slicing: boolean }> {
  const bundles = process.env.BUNDLES_DIR;
  if (bundles) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = `${bundles}/${/\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]}`;
    return existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.continue();
  });
  await page.goto(`/canal-drive/?ride=free&engine=own${qs}`);
  await page.waitForFunction(() => { const g = (window as any).canalRecallGame; return g?.state === 4 && g.camera?.introOverview === 0 && g.freeRide && g.vectorMap?._ownGround?.ready && g.vectorMap?._threeBuildings; }, null, { timeout: 180_000 });
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, tb = vm._threeBuildings, cam = g.camera;
    g.player.update = function () { this.speed = 0; this.vx = 0; this.vy = 0; };
    const calls: Calls = { sliced: [], aerialSync: 0, streetSync: 0 };
    (window as any).__baseCalls = calls;
    const original = tb.refreshGroundBases.bind(tb);
    tb.refreshGroundBases = (budget?: unknown) => {
      const t = performance.now(), n = original(budget);
      if (budget) calls.sliced.push(performance.now() - t);
      else if (vm.labelAerial) calls.aerialSync++; else calls.streetSync++;
      return n;
    };
    (window as any).__home = { zoom: cam.zoom, tilt: vm._cameraTilt ?? 0, rotation: cam.rotation };
  });
  // Up to the S4 pose and across the Zuidas for 12 s (the ground streams in under the moving view).
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER'), cam = g.camera, vm = g.vectorMap;
    const world = ([lng, lat]: number[]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm });
    const a = world([4.8926, 52.3731]), b = world([4.8775, 52.3385]);
    cam.pan(1, 0);
    const t0 = performance.now();
    const step = (now: number) => {
      const f = Math.min(1, (now - t0) / 12_000);
      cam.detached = true; cam.anchorX = a.x + (b.x - a.x) * f; cam.anchorY = a.y + (b.y - a.y) * f;
      cam.zoom = 0.25; vm.setCameraTilt?.(15); vm._cameraTilt = 15; cam.rotation = 0;
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await page.waitForTimeout(13_000);
  const aerial = await page.evaluate(() => (window as any).canalRecallGame.vectorMap.labelAerial);
  expect(aerial, 'the S4 pose is aerial (rendererShared/aerialView.ts)').toBe(true);
  // Back down to the rider at street level.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame, cam = g.camera, vm = g.vectorMap, home = (window as any).__home;
    cam.detached = false; cam.zoom = home.zoom; cam.rotation = home.rotation; vm.setCameraTilt?.(home.tilt); vm._cameraTilt = home.tilt;
  });
  await page.waitForFunction(() => { const vm = (window as any).canalRecallGame.vectorMap; return !vm.labelAerial && !vm.groundBasesSlicing; }, null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  return page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap;
    return { calls: (window as any).__baseCalls, stats: vm.groundBaseStats ? { ...vm.groundBaseStats } : null, slicing: !!vm.groundBasesSlicing };
  });
}

test.describe('aerial ground bases', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the own engine on Chromium');

  test('Zuidas from the air (4.8775, 52.3385): no re-base on aerial frames; a sliced catch-up on landing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one camera is enough');
    test.setTimeout(300_000);
    const run = await flyAndLand(page, '');
    const worst = Math.max(0, ...run.calls.sliced);
    console.log(`held ${JSON.stringify(run.stats)}; sync while aerial ${run.calls.aerialSync}, at street level ${run.calls.streetSync}; sliced calls ${run.calls.sliced.length}, worst ${worst.toFixed(1)} ms`);
    expect(run.calls.aerialSync, 'no unbudgeted re-base while aerial').toBe(0);
    expect(run.stats.held, 'a ground revision arrived while aerial and was held').toBeGreaterThan(0);
    expect(run.stats.catchUps, 'landing ran the catch-up').toBeGreaterThan(0);
    expect(run.calls.sliced.length).toBeGreaterThan(0);
    expect(run.slicing, 'the catch-up finished').toBe(false);
    // 4 ms budget; one chunk's bounding sphere and tile growth may land after the deadline.
    expect(worst, 'each catch-up slice stays near its budget').toBeLessThan(25);
  });

  test('A/B (?groundBasesAerial=0): the old path re-bases on aerial frames', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one camera is enough');
    test.setTimeout(300_000);
    const run = await flyAndLand(page, '&groundBasesAerial=0');
    console.log(`flag off: sync while aerial ${run.calls.aerialSync}, sliced ${run.calls.sliced.length}`);
    expect(run.calls.aerialSync, 'the pin discriminates: the old path re-bases from the air').toBeGreaterThan(0);
    expect(run.calls.sliced.length).toBe(0);
  });
});
