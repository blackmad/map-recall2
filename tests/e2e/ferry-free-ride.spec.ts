import { test, expect, type Page } from '@playwright/test';

// #318 (user 2026-11-09, build ef73a29, `?ride=free`): aboard a ferry on the
// IJ off De Ruijterkade, 61 m from the Centraal pier, "ferry still getting
// stuck, should let me free ride and not force me along an invisible path".
// In Free Ride the vessel lands at any quay with a street beside it and shows
// no pier banner (ferry/travel.ts freeLanding); quiz rides are unchanged.
//
// `before` re-creates the old Free Ride ferry (the ferry ignored Free Ride):
// the host's freeRide flag is cleared with the quizzes stubbed.

const USER_POSE = { lat: 52.381133, lng: 4.898421 };
const OUT = process.env.F3_SHOTS_DIR || '';

async function startFreeRide(page: Page) {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  // Cycling: a fresh profile's Free Ride starts by boat, which never boards a ferry.
  await page.goto('/canal-drive/');
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame), { timeout: 90000 }).toBe(true);
  // What `?ride=free` does (game-route.js), with cycling chosen.
  await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    g._overlay.store.patchPrefs({ cityId: 'amsterdam', routePattern: 'free', travelMode: 'car' }, g._overlayZoom());
    g._startConfiguredRoute();
  });
  const diag = () => page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return { game: !!g, player: !!g?.player, freeRide: g?.freeRide, state: g?.state, travelMode: g?.travelMode,
      segments: g?.track?.segments?.length ?? 0, ferryLinks: g?.track?.segments?.filter((s: any) => s.ferryLink).length ?? 0 };
  });
  await expect.poll(async () => { const d = await diag(); return d.player && d.segments > 0 && d.freeRide && d.travelMode === 'car'; }, { timeout: 150000 }).toBe(true);
  await page.waitForTimeout(3000);
  console.log('DIAG', JSON.stringify(await diag()));
  expect((await diag()).ferryLinks, 'ferry links on the Free Ride track').toBeGreaterThan(0);
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame, W = window as any;
    g._intro = null;
    g.player.controlMode = 'relative'; if (g.input.setPadMode) g.input.setPadMode('relative');
    const rt = W.CanalRecallFerryTravel, orig = rt.afterMove.bind(rt);
    W.__f3 = { lastMove: null, banner: 0, log: [] as any[], logging: false };
    rt.afterMove = (game: any, prev: any) => { const r = orig(game, prev); W.__f3.lastMove = r; return r; };
    const fill = g.ctx.fillText.bind(g.ctx);
    g.ctx.fillText = (text: string, ...rest: any[]) => { if (/^Ferry from /.test(String(text))) W.__f3.banner++; return fill(text, ...rest); };
    const racing = g._updateRacing.bind(g);
    g._updateRacing = (dt: number) => {
      W.__f3.lastMove = null;
      const before = W.__f3.banner;
      racing(dt);
      if (!W.__f3.logging) return;
      const p = g.player;
      W.__f3.log.push({ t: +performance.now().toFixed(0), x: +p.x.toFixed(1), y: +p.y.toFixed(1), speed: Math.round(p.speed),
        boat: !!p.isBoat, aboard: !!p.ferryOrigin, move: W.__f3.lastMove, bannerBefore: before,
        nearest: p.ferryNearest ? Math.round(p.ferryNearest.distance / 3) : null,
        water: g.vectorMap.isWater(p.x, p.y, g.osmLoader) });
    };
    const ids = new Map<string, string>();
    for (const s of g.track.segments) if (s.ferryLink) { ids.set(s.ferryLink.from.id, s.ferryLink.from.name); ids.set(s.ferryLink.to.id, s.ferryLink.to.name); }
    return [...ids.entries()];
  });
}

/** Board at `id` the way a player does, then (optionally) put the vessel at `pose`, crossing already under way. */
async function boardAt(page: Page, id: string, freeRide: boolean, pose?: { lat: number; lng: number; degrees: number }) {
  return page.evaluate(async ({ id, freeRide, pose }) => {
    const g = (window as any).canalRecallGame, p = g.player, F = (window as any).CanalRecallFerry;
    g.freeRide = freeRide;
    if (!freeRide) { g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {}; g.track.getDistanceToFinish = () => 1e9; }
    const t = g.track.segments.flatMap((s: any) => s.ferryLink ? [s.ferryLink.from, s.ferryLink.to] : []).find((t: any) => t.id === id);
    if (p.ferryOrigin) F.disembark(p, p.ferryOrigin);
    g.state = 4;
    p.x = t.x; p.y = t.y; p.speed = 0; p.vx = 0; p.vy = 0; g.camera.x = p.x; g.camera.y = p.y;
    const isWater = (x: number, y: number) => g.vectorMap.isWater(x, y, g.osmLoader);
    let shore = null;
    for (let i = 0; i < 40 && !shore; i++) { await new Promise(r => setTimeout(r, 300)); shore = F.nearestWater(t, isWater); }
    p.angle = shore?.angle ?? Math.atan2(t.y - t.land.y, t.x - t.land.x);
    p.speed = 20; p.vx = Math.cos(p.angle) * 20; p.vy = Math.sin(p.angle) * 20;
    for (let i = 0; i < 60 && !p.ferryOrigin; i++) await new Promise(r => setTimeout(r, 50));
    const boarded = !!p.ferryOrigin;
    if (boarded && pose) {
      const l = g.osmLoader, mLat = 111320, mLng = 111320 * Math.cos(l._lastCenterLat * Math.PI / 180);
      p.x = l._lastOffsetX + (pose.lng - l._lastCenterLng) * mLng * 3;
      p.y = l._lastOffsetY - (pose.lat - l._lastCenterLat) * mLat * 3;
      p.angle = pose.degrees * Math.PI / 180; p.speed = 0; p.vx = 0; p.vy = 0;
      p.ferryDeparted = true; p.ferryUnarmed = [];
      g.camera.x = p.x; g.camera.y = p.y;
    }
    return { name: t.name, boarded, pierMetres: Math.round(Math.hypot(p.x - t.x, p.y - t.y) / 3), water: isWater(p.x, p.y) };
  }, { id, freeRide, pose });
}

async function steer(page: Page, plan: Array<[string[], number]>) {
  await page.evaluate(() => { const W = window as any; W.__f3.log = []; W.__f3.logging = true; W.__f3.banner = 0; });
  for (const [keys, ms] of plan) {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for (const k of keys) await page.keyboard.up(k);
  }
  return page.evaluate(() => { const W = window as any; W.__f3.logging = false; return { log: W.__f3.log, banner: W.__f3.banner }; });
}

function windows(log: any[], ms: number) {
  if (!log.length) return { windows: 0, least: 0 };
  const out: number[] = [];
  let i = 0;
  for (let start = log[0].t; start + ms <= log[log.length - 1].t; start += ms) {
    while (i < log.length && log[i].t < start) i++;
    let j = i; while (j < log.length && log[j].t < start + ms) j++;
    if (j >= log.length) break;
    out.push(Math.hypot(log[j].x - log[i].x, log[j].y - log[i].y) / 3);
  }
  return { windows: out.length, least: out.length ? +Math.min(...out).toFixed(1) : 0 };
}

function summary(log: any[]) {
  const moves: Record<string, number> = {};
  for (const e of log) moves[e.move ?? (e.aboard ? 'none' : 'bike')] = (moves[e.move ?? (e.aboard ? 'none' : 'bike')] ?? 0) + 1;
  const landedAt = log.findIndex(e => e.move === 'landed' || e.move === 'docked');
  const aboard = log.filter(e => e.aboard);
  return { frames: log.length, moves, landedAfterMs: landedAt >= 0 ? log[landedAt].t - log[0].t : null,
    aboardMeanSpeed: aboard.length ? Math.round(aboard.reduce((s, e) => s + e.speed, 0) / aboard.length) : null,
    w5: windows(log, 5000) };
}

test('#318 host-state log at the user pose, 20 s steering away from the pier (before and after)', async ({ page }, testInfo) => {
  test.setTimeout(600000);
  const piers = await startFreeRide(page);
  const f4 = piers.find(([id]) => id === '3980457');
  expect(f4, 'Centraal F4 pier on the Free Ride track').toBeTruthy();
  for (const mode of ['before', 'after'] as const) {
    const placed = await boardAt(page, '3980457', mode === 'after', { ...USER_POSE, degrees: -135 });
    console.log('PLACED', mode, testInfo.project.name, JSON.stringify(placed));
    expect(placed.boarded).toBe(true);
    // Away from the pier and towards the De Ruijterkade quay: turn left (to the
    // south-west), then hold on, then a second turn, throttle open throughout.
    const shotAt = mode === 'before' ? 6000 : 0;
    const run = steer(page, [[['ArrowUp', 'ArrowLeft'], 2000], [['ArrowUp'], 6000], [['ArrowUp', 'ArrowLeft'], 1500], [['ArrowUp'], 5000], [['ArrowUp', 'ArrowRight'], 1500], [['ArrowUp'], 4000]]);
    if (OUT && mode === 'before') {
      await page.waitForTimeout(shotAt);
      await page.screenshot({ path: `${OUT}/${testInfo.project.name}-before-aboard-at-quay.jpg`, type: 'jpeg', quality: 80 });
    }
    if (OUT && mode === 'after') {
      await expect.poll(() => page.evaluate(() => !(window as any).canalRecallGame.player.ferryOrigin), { timeout: 15000 }).toBe(true);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${testInfo.project.name}-after-landed-on-quay.jpg`, type: 'jpeg', quality: 80 });
    }
    const { log, banner } = await run;
    const s = summary(log);
    console.log('HOSTLOG', mode, testInfo.project.name, JSON.stringify({ ...s, bannerDraws: banner }));
    console.log('HOSTTRAIL', mode, testInfo.project.name, log.filter((_: any, i: number) => i % 30 === 0).map((e: any) =>
      `${e.aboard ? 'F' : 'B'}${e.speed}/${e.move ?? '-'}/${e.nearest ?? '-'}${e.water ? '' : '!'}`).join(' '));
    if (mode === 'after') {
      expect(banner, 'no ferry banner in Free Ride').toBe(0);
      expect(s.landedAfterMs, 'the Free Ride vessel lands at the quay').not.toBeNull();
      expect(s.w5.least, 'moving in every 5 s window').toBeGreaterThan(0);
    }
  }
});

for (const id of ['3980457', '3981381']) {
  test(`#318 Free Ride gate: 60 s of steering every way from pier ${id}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    test.setTimeout(600000);
    const piers = await startFreeRide(page);
    expect(piers.some(([pid]) => pid === id), `pier ${id} on the Free Ride track`).toBe(true);
    const placed = await boardAt(page, id, true);
    console.log('PLACED', id, JSON.stringify(placed));
    expect(placed.boarded).toBe(true);
    // Every direction: alternating left and right turns of growing length.
    const plan: Array<[string[], number]> = [];
    for (const [side, ms] of [['ArrowLeft', 900], ['ArrowRight', 1800], ['ArrowLeft', 2700], ['ArrowRight', 1200], ['ArrowLeft', 1500], ['ArrowRight', 2400], ['ArrowLeft', 600], ['ArrowRight', 3000]] as const) {
      plan.push([['ArrowUp'], 7500 - ms - 0], [['ArrowUp', side], ms]);
    }
    const { log, banner } = await steer(page, plan);
    const s = summary(log);
    console.log('GATE', id, placed.name, JSON.stringify({ ...s, bannerDraws: banner }));
    expect(banner, 'no ferry banner in Free Ride').toBe(0);
    expect(s.w5.least, 'net movement in every 5 s window').toBeGreaterThan(0);
  });
}
