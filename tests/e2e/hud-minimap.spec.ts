import { expect, test, type Page } from '@playwright/test';
import { openRoute } from './helpers';

// The 2026-10-16 HUD reports, pinned:
// 1. the DESTINATION pill's caps sit centred in the pill, whatever text
//    baseline an earlier draw left on the context;
// 2. map labels sit under the HUD canvas and are not placed under its cards
//    (a park name printed across RE-CENTER);
// 3. the corner utilities stay tucked over the overview flight and come back
//    on a mouse move;
// 4. the always-on minimap is the riding radar: square slot, centred on the
//    rider, turning with the main view; M cycles radar → whole city → off.

const near = async (page: Page) => page.evaluate(() => {
  const g = (window as any).canalRecallGame;
  const f = g.track.finishPoint;
  // ~70 m short: outside FINISH_RADIUS (80 px), which would end the ride.
  g.player.x = f.x - 150; g.player.y = f.y + 150; g.player.speed = 0;
  g.camera.resetForRide(g.player);
});

test('the DESTINATION pill centres its caps', async ({ page }) => {
  await openRoute(page, { travelMode: 'car', viewMode: 'heading' });
  await near(page);
  await page.waitForTimeout(800);
  const gaps = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    // A baseline leaked by another draw used to drop the caps to the pill's edge.
    g.ctx.textBaseline = 'top';
    g.renderer.ctx.textBaseline = 'top';
    g.renderer.drawTrack(g.camera, g.track);
    const r = g.renderer.destinationPillRect;
    const k = g.ctx.getTransform().a;
    // The pill: rows 38..58 of the pin+pill rect, inset from the rounded ends.
    const x = Math.round((r.x + 12) * k), y = Math.round((r.y + 38) * k);
    const w = Math.round((r.width - 24) * k), h = Math.round(20 * k);
    const data = g.ctx.getImageData(x, y, w, h).data;
    const inked: number[] = [];
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const i = (row * w + col) * 4;
        if (data[i + 3] > 200 && data[i] + data[i + 1] + data[i + 2] < 300) { inked.push(row); break; }
      }
    }
    return { top: inked[0], bottom: h - 1 - inked[inked.length - 1], rows: inked.length, k };
  });
  expect(gaps.rows, 'caps drawn').toBeGreaterThan(4);
  expect(Math.abs(gaps.top - gaps.bottom), JSON.stringify(gaps)).toBeLessThanOrEqual(Math.ceil(1.5 * gaps.k));
});

test('map labels are under the HUD canvas and kept out of its cards', async ({ page }) => {
  await openRoute(page, { travelMode: 'car', viewMode: 'heading' });
  const order = await page.evaluate(() => {
    const root = document.querySelector('.cr-map-labels');
    const canvas = document.getElementById('gameCanvas');
    if (!root || !canvas) return 'missing';
    return root.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING ? 'under' : 'over';
  });
  expect(order).toBe('under');
  // Pan so RE-CENTER shows, with the destination pin on screen too.
  await near(page);
  await page.evaluate(() => (window as any).canalRecallGame.camera.pan(0, -60));
  await page.waitForTimeout(800);
  const avoid = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const overlay = g.vectorMap._labelOverlay;
    const b = g._recenterBtnBounds, pill = g.renderer.destinationPillRect;
    if (!overlay || !b || !pill || g.state !== 4) return { ready: false, button: false, pill: false, radar: false };
    const box = g.canvas.getBoundingClientRect();
    const origin = overlay.root.getBoundingClientRect();
    const rects: Array<{ x: number; y: number; width: number; height: number }> = overlay.hudRects(g, origin);
    const s = box.width / g.viewport.width;
    const has = (r: { x: number; y: number; width: number; height: number }) => rects.some(q =>
      Math.abs(q.x - (box.left - origin.left + r.x * s)) < 1 && Math.abs(q.y - (box.top - origin.top + r.y * s)) < 1
      && Math.abs(q.width - r.width * s) < 1 && Math.abs(q.height - r.height * s) < 1);
    return { ready: true, button: has({ x: b.x, y: b.y, width: b.w, height: b.h }), pill: has(pill), radar: has(g._hudRects().minimap) };
  });
  // The plan places no label over any of these (labelPlan drops a box that meets a HUD rect).
  expect(avoid).toEqual({ ready: true, button: true, pill: true, radar: true });
});

test('utilities stay tucked over the overview flight and return on a mouse move', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'desktop cluster rule');
  await page.addInitScript(() => { (window as any).__canalRecallForceIntro = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: false });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._intro, null, { timeout: 120_000, polling: 'raf' });
  await page.waitForTimeout(400);
  const during = await page.evaluate(() => ({
    intro: !!(window as any).canalRecallGame._intro,
    tucked: document.getElementById('utility-buttons')!.classList.contains('tucked'),
    opacity: Number(getComputedStyle(document.getElementById('open-settings')!).opacity),
  }));
  test.skip(!during.intro, 'flight ended before the probe');
  expect(during.tucked).toBe(true);
  await page.mouse.move(400, 300);
  await page.mouse.move(520, 380);
  await page.waitForTimeout(350);
  const shown = await page.evaluate(() => document.getElementById('utility-buttons')!.classList.contains('tucked'));
  expect(shown).toBe(false);
});

test('the minimap is a heading-up radar centred on the rider', async ({ page }) => {
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await expect.poll(() => page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return !!g._radar?.ready;
  }), { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(800);
  const probe = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const radar = g._radar;
    let view: any = null;
    const draw = radar.draw.bind(radar);
    radar.draw = (ctx: any, rect: any, v: any, min: number) => { view = { rect, ...v, route: !!v.route }; return draw(ctx, rect, v, min); };
    g._render();
    radar.draw = draw;
    const rect = g._hudRects().minimap;
    const k = g.ctx.getTransform().a;
    const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
    // The rider's arrow tip, 6 px above the centre on a heading-up radar.
    const px = (x: number, y: number) => Array.from(g.ctx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data);
    // Count map ink in the radar: water or streets, not just land.
    const d = g.ctx.getImageData(Math.round(rect.x * k), Math.round(rect.y * k), Math.round(rect.width * k), Math.round(rect.height * k)).data;
    let water = 0, street = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - 79) < 12 && Math.abs(d[i + 1] - 134) < 12 && Math.abs(d[i + 2] - 163) < 12) water++;
      if (d[i] > 240 && d[i + 1] > 236 && d[i + 2] > 225) street++;
    }
    return {
      square: rect.width === rect.height,
      rotation: view?.rotation, cameraRotation: g.camera.rotation,
      atMatches: !!view,
      tip: px(cx, cy - 6), tail: px(cx, cy + 9),
      water, street,
      heading: Math.atan2(Math.sin(g.player.angle - view.rotation + Math.PI / 2), Math.cos(g.player.angle - view.rotation + Math.PI / 2)),
    };
  });
  expect(probe.square).toBe(true);
  expect(probe.rotation).toBeCloseTo(probe.cameraRotation, 5);
  // Heading-up: in chase view the arrow points (nearly) straight up.
  expect(Math.abs(probe.heading)).toBeLessThan(0.35);
  expect(probe.tip[0] + probe.tip[1] + probe.tip[2], `tip ${probe.tip}`).toBeLessThan(250);
  expect(probe.street + probe.water, 'streets or water drawn').toBeGreaterThan(150);

  // M: radar → whole city → off → radar.
  const modes = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const out: string[] = [];
    for (let i = 0; i < 3; i++) { g._cycleMinimap(); out.push(g.showMiniMap ? g.minimapMode : 'off'); }
    return out;
  });
  expect(modes).toEqual(['city', 'off', 'radar']);
});
