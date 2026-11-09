import { expect, type Page, test } from '@playwright/test';
import { finishKeycapCentre, openRoute } from './helpers';

// L4 (#286), phone cards, from the ride review #280 (defects 7 and 10):
//  A. the drive-by card's Noticed pill is a 44 px tap target, the touch hint
//     strip is clear of it, and the d-pad and the corner chips are clear of the card;
//  B. finishing a buurt's checklist shows the stamped postcard on the phone too,
//     and the coin is in frame or the radar carries its bearing at every frame;
//  C. the arrival card's keycaps are drawn ≥ 44 CSS px tall on the phone.
// Set PHONE_CARDS_SHOTS=<dir> to save the strip's frames.

const SHOTS = process.env.PHONE_CARDS_SHOTS || '';
type Box = { x: number; y: number; w: number; h: number };

const overlap = (a: Box | null, b: Box | null): number => {
  if (!a || !b) return 0;
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** The drive-by card, its pill, the touch hint, the d-pad and the corner chips, all in CSS px. */
async function driveByCard(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const landmark = g.landmarks.find((l: any) => l.name === 'Concertgebouw') ?? g.landmarks.find((l: any) => l.name === 'Westerkerk');
    g._landmarkSightingsCache = {};
    try { localStorage.removeItem('canalRecall.landmarkSightings.v1'); } catch { /* */ }
    g.quizFeedback = '';
    g.maxAsksPerMinute = 0;
    // The hint strip up, as on a fresh ride.
    g.input._showTouchHint = true;
    g.input._touchHintTimer = 60;
    // The corner chips revealed, as after a tap on the map: they must keep clear of the card (or stay tucked).
    g._utilityRevealUntil = performance.now() + 60_000;
    g._showLandmarkNotice(landmark, { kind: 'sticky' }, 'drive-by');
    g._landmarkNoticeAlpha = 1;
    g._landmarkNoticeState.elapsed = 1;
    return landmark?.name ?? null;
  }).then(async name => {
    // Two live frames: the card, the pad and the hint as the ride draws them.
    await page.waitForTimeout(300);
    return page.evaluate((name) => {
      const g = (window as any).canalRecallGame;
      const rect = g.canvas.getBoundingClientRect();
      const kx = rect.width / g.viewport.width, ky = rect.height / g.viewport.height;
      const css = (b: any): Box | null => b ? { x: rect.left + b.x * kx, y: rect.top + b.y * ky, w: (b.w ?? b.width) * kx, h: (b.h ?? b.height) * ky } : null;
      const pad = g.hud.layout?.dpad;
      const padRects = pad ? Object.values(window.CanalRecallUi.streetPadRects(pad)).map(css) : [];
      const hint = g.hud._touchHintDrawn && performance.now() - g.hud._touchHintDrawn.at < 200 ? css(g.hud._touchHintDrawn) : null;
      const chips = [...document.querySelectorAll('#utility-buttons > *')]
        .filter(el => (el as HTMLElement).checkVisibility({ opacityProperty: true, visibilityProperty: true }))
        .map(el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, id: (el as HTMLElement).className || el.id }; })
        .filter(r => r.w > 0 && r.h > 0);
      return {
        name,
        viewport: { w: window.innerWidth, h: window.innerHeight, canvasPerCss: 1 / kx },
        pill: css(g._landmarkActionBounds),
        card: css(g._landmarkCardBounds),
        hint,
        pad: pad ? css(pad.bounds) : null,
        padRects,
        chips,
        vehicle: (() => { const v = g.camera.worldToScreen(g.player.x, g.player.y); return { x: rect.left + v.x * kx, y: rect.top + v.y * ky }; })(),
      };
    }, name);
  });
}

for (const size of [{ width: 414, height: 896 }, { width: 390, height: 664 }]) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    test('drive-by card: Noticed pill ≥ 44 px, hint strip, d-pad and chips clear', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
      test.setTimeout(180_000);
      await openRoute(page, { travelMode: 'car', query: '?landmarkQuestions=1', controlMode: 'street' });
      const m = await driveByCard(page);
      console.log('L4 drive-by', size.width, JSON.stringify(m));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/driveby-${size.width}.png` });
      expect(m.pill, 'the drive-by card has a Noticed pill').not.toBeNull();
      expect(m.pill!.h, 'Noticed is a 44 px tap target').toBeGreaterThanOrEqual(44);
      // The hint strip yields to the card while it is open; if it is drawn, it is clear of it.
      expect(overlap(m.pill, m.hint), 'hint strip over the pill').toBe(0);
      expect(overlap(m.card, m.hint), 'hint strip over the card').toBe(0);
      for (const r of m.padRects) expect(overlap(m.card, r), 'd-pad under the card').toBe(0);
      for (const chip of m.chips) expect(overlap(m.card, chip), `${chip.id} over the card`).toBe(0);
      // The corridor stays visible: the card starts below the bike. Not on a 664 px phone, where any
      // card with a photo already covered it before #286 (OPEN on the issue).
      if (size.height >= 800) expect(m.card!.y, 'the card clears the vehicle').toBeGreaterThan(m.vehicle.y + 20);
    });
  });
}

test('arrival keycaps are drawn ≥ 44 CSS px on the phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
  test.setTimeout(180_000);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase' });
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    if (g.routeTo.reviewStop) g.routeTo = { ...g.routeTo, reviewStop: undefined };
    Object.assign(g, { quizCorrect: 2, quizAttempts: 3, quizPoints: 200, quizBestStreak: 2 });
    g._rideNamedNames = [`Street ${g.routeTo.id}`];
    g.player.x = g.track.finishPoint.x; g.player.y = g.track.finishPoint.y; g.player.speed = 0;
  });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 5, null, { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as any).canalRecallGame._finishButtonBounds?.length, null, { timeout: 10_000 });
  await page.waitForTimeout(400);
  const ids = await page.evaluate(() => ((window as any).canalRecallGame._finishButtonBounds as Array<{ id: string }>).map(b => b.id));
  const caps = [];
  for (const id of ids) caps.push({ id, ...(await finishKeycapCentre(page, id))! });
  console.log('L4 keycaps', JSON.stringify(caps));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/arrival-keycaps.png` });
  for (const cap of caps) expect(cap.h, `${cap.id} keycap height`).toBeGreaterThanOrEqual(44);
});

async function startFreeRide(page: Page) {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto('/canal-drive/?ride=free');
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
}

test('collecting a buurt on the phone draws the stamped postcard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
  test.setTimeout(240_000);
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  await startFreeRide(page);
  const list = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const lists = [...g._freeRideChecklists().values()] as Array<{ hood: string; places: Array<{ key: string; x: number; y: number }> }>;
    const list = lists.find(l => /marineterrein/i.test(l.hood)) ?? lists.sort((a, b) => a.places.length - b.places.length)[0];
    // Count every stamped postcard the renderer draws.
    (window as any).__l4Postcards = [];
    const draw = g.renderer.drawPostcard.bind(g.renderer);
    g.renderer.drawPostcard = (ctx: unknown, card: any, x: number, y: number, img: unknown) => {
      (window as any).__l4Postcards.push({ stamped: !!g._neighborhoodNotice?.stamped, name: g._neighborhoodNotice?.name, x, y, w: card.width, h: card.height });
      return draw(ctx, card, x, y, img);
    };
    return { hood: list.hood, places: list.places.map(p => ({ key: p.key, x: p.x, y: p.y })) };
  });
  // Ride through every place but the last (the phone collects without a card).
  for (const place of list.places) {
    await page.evaluate((p) => {
      const g = (window as any).canalRecallGame;
      g._clearLandmarkNotice?.();
      g.player.x = p.x; g.player.y = p.y + 3; g.player.speed = 0;
      g._freeRideRefresh = 0;
    }, place);
    await expect.poll(() => page.evaluate((key) => {
      const g = (window as any).canalRecallGame;
      // The coin is the place's own unless another is nearer; open it the way a tap would.
      if (!g._freeRideCollection.opened.has(key)) g._noteFreeRideOpened(key);
      return g._freeRideCollection.opened.has(key);
    }, place.key), { timeout: 10_000 }).toBe(true);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__l4Postcards.filter((c: any) => c.stamped).length), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const drawn = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const rect = g.canvas.getBoundingClientRect();
    const last = (window as any).__l4Postcards.filter((c: any) => c.stamped).at(-1);
    return { last, hood: g._neighborhoodNotice?.name, landmarkCard: !!g._landmarkNotice, vh: rect.height, kx: rect.width / g.viewport.width };
  });
  console.log('L4 stamp postcard', list.hood, JSON.stringify(drawn));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/stamp-postcard.png` });
  expect(drawn.hood).toBe(list.hood);
  expect(drawn.landmarkCard, 'one card at a time').toBe(false);
  // On screen, in the bottom half (the corridor above it stays clear).
  expect(drawn.last.y * drawn.kx).toBeGreaterThan(drawn.vh / 2);
  expect((drawn.last.y + drawn.last.h) * drawn.kx).toBeLessThanOrEqual(drawn.vh);
});

test('the coin is in frame or on the radar at every frame of a ride past it', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone', 'the phone layout');
  test.setTimeout(240_000);
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  await startFreeRide(page);
  const start = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const lists = [...g._freeRideChecklists().values()] as Array<{ hood: string; places: Array<{ key: string; x: number; y: number }> }>;
    const list = lists.find(l => /marineterrein/i.test(l.hood)) ?? lists[0];
    const target = list.places[0];
    // Capture what the radar is handed each frame.
    (window as any).__l4Radar = null;
    return { x: target.x, y: target.y, key: target.key, hood: list.hood };
  });
  const samples: Array<{ step: number; key: string | null; screen: boolean; hidden: string | null; onRadar: boolean; radarDrawn: boolean }> = [];
  // From 150 m west of the place, through it, to 60 m beyond, facing east (world px: 3 per metre).
  for (let step = 0; step <= 21; step++) {
    const dx = (-150 + step * 10) * 3;
    await page.evaluate(({ x, y }) => {
      const g = (window as any).canalRecallGame;
      g._clearLandmarkNotice?.();
      Object.assign(g.player, { x, y, angle: 0, speed: 0, vx: 0, vy: 0 });
      g._freeRideRefresh = 0;
      const radar = g._radar;
      if (radar && !radar.__l4) {
        const draw = radar.draw.bind(radar);
        radar.draw = (ctx: unknown, rect: unknown, view: any, ...rest: unknown[]) => { (window as any).__l4Radar = { at: performance.now(), places: view.places?.length ?? 0 }; return draw(ctx, rect, view, ...rest); };
        radar.__l4 = true;
      }
    }, { x: start.x + dx, y: start.y });
    await page.waitForTimeout(250);
    samples.push(await page.evaluate(() => {
      const g = (window as any).canalRecallGame;
      const c = g._freeRideCollection;
      const token = c.token;
      const radar = (window as any).__l4Radar;
      const places = g._freeRideRadarPlaces() as Array<{ x: number; y: number }>;
      return {
        step: 0,
        key: token?.key ?? null,
        screen: !!c.tokenScreen,
        hidden: c.tokenHidden ?? null,
        onRadar: !!token && places.some(p => Math.hypot(p.x - token.x, p.y - token.y) < 1),
        radarDrawn: !!radar && performance.now() - radar.at < 200 && radar.places === places.length,
      };
    }).then(s => ({ ...s, step })));
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/coin-after.png` });
  console.log('L4 coin', start.hood, JSON.stringify(samples));
  const withToken = samples.filter(s => s.key);
  expect(withToken.length, 'a coin was up on the approach').toBeGreaterThan(5);
  for (const s of withToken) {
    expect(s.screen || (s.onRadar && s.radarDrawn), `step ${s.step}: coin ${s.key} hidden (${s.hidden}) and not on the radar`).toBe(true);
  }
});
