import { expect, test, type Page } from '@playwright/test';
import { setHiddenSelect } from './helpers';

// Named regression (user report 2026-10-21, "why are we sometimes not seeing the boat?"): a boat
// ride in chase view from the Amstel at Royal Theater Carré (Weesperbuurt) to the Raw Aron Schuster
// synagogue opened high over the Amstel, the Magere Brug in view, the green START tag on open water
// and no boat under it.
//
// Cause: from `_prepareIntro` until the start flight lands, the camera holds the overview's zoom
// (0.012–0.13). Any setting saved in that window (B, L, [ ], R, G) wrote `camera.zoom` into the
// preferences, clamped to the 0.1 minimum, so every later ride opened 2.7 map levels out, where the
// world-sized boat is ~9 px long under a screen-sized START tag. The ride that saved looked fine;
// the next ones did not, which is why it was intermittent. The bike shrank too but has a zoom
// compensation (vehicleZoomScale.ts); the boat had none.
//
// Automated browsers skip the flight; `__canalRecallForceIntro` brings it back here.
const CARRE = { id: 'boat-start-zoom-carre', name: 'Amstel at Royal Theater Carré', lat: 52.3612, lng: 4.9043 };
const SYNAGOGUE = { id: 'boat-start-zoom-synagogue', name: 'Raw Aron Schuster Synagoge', lat: 52.3533, lng: 4.879 };
const PREFS_KEY = 'canalRecall.preferences.v1';

async function launch(page: Page): Promise<void> {
  await page.evaluate(([from, to]) => { (window as any).canalRecallGame._launchPoiRoute(from, to, { explicitDestination: true }); }, [CARRE, SYNAGOGUE] as const);
  await page.waitForFunction(() => (window as any).canalRecallGame?._intro, null, { timeout: 120_000 });
}

const zoomState = (page: Page) => page.evaluate((key) => {
  const g = (window as any).canalRecallGame;
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  return { camera: g.camera.zoom as number, flying: !!g._intro, store: g._prefs().zoom as number, saved: saved.zoom as number };
}, PREFS_KEY);

/** Pixels around the rider that change when the boat is hidden: the boat is on screen. */
async function boatPixels(page: Page): Promise<number> {
  const [x, y] = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    const p = vm.map.project(vm.worldToLngLat(g.player.x, g.player.y, g.osmLoader));
    return [p.x, p.y];
  });
  const clip = { x: Math.max(0, x - 50), y: Math.max(0, y - 50), width: 100, height: 100 };
  const hide = (hidden: boolean) => page.evaluate((h) => {
    const boat = (window as any).canalRecallGame.vectorMap._playerBoat;
    boat.__update ||= boat.update;
    boat.update = h ? function (this: any, ll: unknown, angle: number) { boat.__update.call(this, ll, angle, false); } : boat.__update;
  }, hidden);
  const shown = await page.screenshot({ clip });
  await hide(true);
  await page.waitForTimeout(300);
  const hidden = await page.screenshot({ clip });
  await hide(false);
  return page.evaluate(async ([a, b]) => {
    const pixels = async (src: string) => {
      const img = new Image(); img.src = `data:image/png;base64,${src}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const pa = await pixels(a), pb = await pixels(b);
    let n = 0;
    for (let i = 0; i < pa.length; i += 4) if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 40) n++;
    return n;
  }, [shown.toString('base64'), hidden.toString('base64')] as const);
}

test('a setting saved during the start flight keeps the ride zoom, and the next boat ride shows the boat', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => !!(window as any).canalRecallGame);
  await setHiddenSelect(page, 'travel-mode', 'boat');
  await setHiddenSelect(page, 'view-mode', 'chase');

  await launch(page);
  const before = await zoomState(page);
  expect(before.flying).toBe(true);
  expect(before.camera, 'the overview holds the camera far out').toBeLessThan(0.2);
  // What B, L, [ ], R and G all do: save the settings, here while the overview is up.
  await page.evaluate(() => (window as any).canalRecallGame._savePreferences());
  const during = await zoomState(page);
  expect(during.saved, 'saved zoom is the landing zoom, not the overview').toBeCloseTo(before.store, 5);
  expect(during.store).toBeCloseTo(before.store, 5);

  await page.waitForFunction(() => !(window as any).canalRecallGame._intro, null, { timeout: 30_000 });
  await launch(page);
  await page.waitForFunction(() => !(window as any).canalRecallGame._intro, null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const second = await zoomState(page);
  expect(second.camera, 'the next ride opens at the player zoom').toBeCloseTo(before.store, 5);
  const shot = testInfo.outputPath('boat-second-ride.png');
  await page.screenshot({ path: shot });
  const pixels = await boatPixels(page);
  console.log(JSON.stringify({ before, during, second, boatPixels: pixels, shot }));
  expect(pixels, 'the boat is drawn under the START tag').toBeGreaterThan(300);
});

test('a zoomed-out chase grows the boat instead of losing it', async ({ page }) => {
  test.setTimeout(180_000);
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/');
  await page.waitForFunction(() => !!(window as any).canalRecallGame);
  await setHiddenSelect(page, 'travel-mode', 'boat');
  await setHiddenSelect(page, 'view-mode', 'chase');
  await page.evaluate(([from, to]) => { (window as any).canalRecallGame._launchPoiRoute(from, to, { explicitDestination: true }); }, [CARRE, SYNAGOGUE] as const);
  await page.waitForFunction(() => (window as any).canalRecallGame?.state === 4 && (window as any).canalRecallGame.vectorMap.isPlayerBoatReady(), null, { timeout: 120_000 });
  const scaleAt = (zoom: number) => page.evaluate(async (z) => {
    const g = (window as any).canalRecallGame;
    g.camera.zoom = z;
    await new Promise(r => setTimeout(r, 400));
    return g.vectorMap._playerBoat.zoomScale as number;
  }, zoom);
  expect(await scaleAt(0.65), 'default zoom: the tuned size').toBeCloseTo(1, 5);
  expect(await scaleAt(1.2), 'zoomed in: never smaller').toBeCloseTo(1, 5);
  expect(await scaleAt(0.1), 'slider minimum: grown').toBeGreaterThan(2);
});
