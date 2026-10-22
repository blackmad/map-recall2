import { test, expect, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// The bicycle's front wheel is on its native +X and the boat's bow is on -X, so
// the two vehicles need opposite heading offsets. Swapping them makes the boat
// sail stern-first — which looks almost right in a still and is invisible in a
// diff — so the offsets are pinned here alongside the fact that boat mode
// actually reaches the mesh and stops drawing the canvas glyph.
//
// Since the shared frame became the default (2026-10-14) the vehicles are no
// longer their own MapLibre custom layers (`player-boat-3d`): each registers in
// the frame's overlay pass and is drawn there. This spec follows that path
// (2026-10-22), keeping the legacy layer as the `?sharedFrame=0` fallback.

/** Pixels around the rider that change when the boat is hidden: the hull is really on screen. */
async function boatPixels(page: Page): Promise<number> {
  const box = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._playerBoat.screenBox);
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const clip = { x: Math.max(0, cx - 50), y: Math.max(0, cy - 50), width: 100, height: 100 };
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

test('boat mode draws the boat, facing forward, on the water', async ({ page }) => {
  test.setTimeout(180000);
  await openRoute(page, { travelMode: 'boat', viewMode: 'chase', seedRandom: false });
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame?.vectorMap?.isPlayerBoatReady?.())), { timeout: 90000 }).toBe(true);
  // Drawn this frame: the overlay pass asked the boat and it produced a screen box.
  await expect.poll(() => page.evaluate(() => Boolean((window as any).canalRecallGame.vectorMap._playerBoat.screenBox)), { timeout: 30000 }).toBe(true);
  await page.waitForTimeout(1500);

  const report = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const map = g.vectorMap;
    const boat = map._playerBoat;
    const bike = map._playerBike;
    const frame = map._sharedFrame;
    const entry = frame?.registry?.get('player-boat-3d');
    const ll = map.worldToLngLat(g.player.x, g.player.y, g.osmLoader);
    const ground = map._ownGround;
    const water = ground?.ready ? ground.waterLevelAt(ll) : 0;
    const box = boat.screenBox;
    const canvas = map.map.getCanvas();
    const drawn = {
      shared: Boolean(frame),
      registered: Boolean(entry),
      pass: entry?.pass ?? null,
      wrapperVisible: entry ? entry.participant.wrapper.visible : null,
      inScene: boat._modelRoot?.parent === boat._scene,
      legacyLayer: Boolean(map.map.getLayer('player-boat-3d')),
      overlayFrames: frame?.stats?.overlay?.frames ?? null,
      box,
      onScreen: Boolean(box && box.right > 0 && box.left < canvas.clientWidth && box.bottom > 0 && box.top < canvas.clientHeight),
    };
    // Heel: the hull has no steering geometry, so a turn has to show in the
    // whole boat. Hold a lock and check it leans, then check it rights itself.
    for (let i = 0; i < 200; i++) boat.update(ll, g.player.angle, true, 1);
    const heeled = boat.heel;
    for (let i = 0; i < 400; i++) boat.update(ll, g.player.angle, true, 0);
    return {
      travelMode: g.travelMode,
      drawn,
      boatHeading: boat.options.headingOffset,
      bikeHeading: bike ? bike.options.headingOffset : null,
      altitude: boat.altitudeM,
      water,
      heeled,
      righted: boat.heel,
    };
  });
  const pixels = await boatPixels(page);
  console.log(JSON.stringify({ ...report, pixels }));

  expect(report.travelMode).not.toBe('car');
  if (report.drawn.shared) {
    // The shared frame's overlay pass draws the boat: registered there, its wrapper shown this frame.
    expect(report.drawn.registered).toBe(true);
    expect(report.drawn.pass).toBe('overlay');
    expect(report.drawn.wrapperVisible).toBe(true);
    expect(report.drawn.overlayFrames).toBeGreaterThan(0);
  } else {
    expect(report.drawn.legacyLayer).toBe(true);
  }
  expect(report.drawn.inScene).toBe(true);
  expect(report.drawn.onScreen).toBe(true);
  expect(pixels, 'the hull is on screen, not hidden under the water or the ground').toBeGreaterThan(300);
  // Floats 0.22 m over the water it is on (own ground: per-polder level; else the flat map at 0).
  expect(report.altitude).toBeCloseTo(report.water + 0.22, 2);
  // Sloop bow is on -X (π offset). Omafiets front wheel is on +X (no offset).
  expect(report.boatHeading).toBeCloseTo(Math.PI, 5);
  expect(report.bikeHeading).toBeCloseTo(0, 5);
  // A held turn leans the hull; letting go brings it back upright.
  expect(Math.abs(report.heeled)).toBeGreaterThan(0.1);
  expect(Math.abs(report.righted)).toBeLessThan(0.01);
});
