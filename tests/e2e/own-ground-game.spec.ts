import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// Own ground in the game (`?ownGround=1`, docs/research/own-ground-20261009.md).
// Opt-in, needs the GPU and the network basemap:
//   OWN_GROUND=1 PW_PORT=4417 npx playwright test own-ground-game --project=desktop
//   OWN_GROUND=1 PW_PORT=4417 npx playwright test own-ground-game --project=iphone
// Named regressions BRU0166 (Nassaukade, Bilderdijkgracht mouth) and BRU0044
// (Leidsegracht, Abel Weetnietbrug) in the game, and a chase ride over three
// bridges with screenshots into artifacts/own-ground-game/.
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-game';

type Place = { lng: number; lat: number; bearing: number };
// Nassaukade (way 1194778589), heading up the kade toward bridge way 7373504 (BRU0166).
const NASSAUKADE: Place = { lng: 4.87445, lat: 52.37286, bearing: 40 };
// Leidsegracht toward the Abel Weetnietbrug (BRU0044, masonry arch over the Herengracht crossing).
const LEIDSEGRACHT: Place = { lng: 4.88557, lat: 52.36728, bearing: 240 };

async function boot(page: Page, ownGround: boolean): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript((on: boolean) => { (window as any).__canalRecallOwnGround = on; }, ownGround);
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

/** Put the player at a place, frozen (no input), facing `bearing`. */
async function teleport(page: Page, p: Place): Promise<void> {
  await page.evaluate(({ lng, lat, bearing }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const b = bearing * Math.PI / 180;
    g.player.x = l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm;
    g.player.y = l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm;
    g.player.angle = Math.atan2(-Math.cos(b), Math.sin(b));
    Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
    g.player.handleInput = () => {};
  }, p);
}

const status = (page: Page) => page.evaluate(() => (window as any).canalRecallGame.vectorMap.ownGroundStatus());

async function settle(page: Page, ms = 6000): Promise<Record<string, any>> {
  // The rider's cell at LOD 0 and nothing queued.
  await expect.poll(async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(ms);
  return status(page);
}

/** A measured deck's centre (lng/lat) and its heading, from the ground's own placed profile. */
async function deckCentre(page: Page, id: string): Promise<{ lng: number; lat: number; bearing: number; crown: number; ends: number[] } | null> {
  return page.evaluate((deckId) => {
    const vm = (window as any).canalRecallGame.vectorMap, api = (window as any).CanalRecallOwnGround;
    const deck = vm._ownGround?.store.surface.decks.find((d: any) => d.profile.id === deckId);
    if (!deck) return null;
    const p = deck.profile, mid = Math.floor(p.x.length / 2);
    let crown = -Infinity; for (let i = 0; i < p.x.length; i++) crown = Math.max(crown, vm._ownGround.store.surface.height(p.x[i], p.y[i]));
    const [lng, lat] = api.fromLocal(p.x[mid], p.y[mid]);
    const dx = p.x[mid + 1] - p.x[mid - 1], dy = p.y[mid + 1] - p.y[mid - 1];
    return { lng, lat, bearing: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, crown, ends: deck.ends };
  }, id);
}

test('named regressions in game: BRU0166 Nassaukade and BRU0044 Leidsegracht', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page, true);
  const report: Record<string, unknown> = {};
  for (const [id, place] of [['BRU0166', NASSAUKADE], ['BRU0044', LEIDSEGRACHT]] as const) {
    await teleport(page, place);
    const s = await settle(page);
    expect(s.errors, JSON.stringify(s.errors)).toEqual([]);
    expect(s.basemapHidden).toBe(true);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${id}-approach.png` });
    const deck = await deckCentre(page, id);
    expect(deck, `${id} placed`).not.toBeNull();
    // On the crown: the bike rides the deck profile (vector-map eases the surface; give it frames).
    await teleport(page, { lng: deck!.lng, lat: deck!.lat, bearing: deck!.bearing });
    await page.waitForTimeout(2500);
    const rider = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._riderSurfaceM);
    expect(rider, `${id}: rider surface ${rider} vs crown ${deck!.crown}`).toBeGreaterThan(Math.max(...deck!.ends) + 0.3);
    expect(Math.abs(rider - deck!.crown)).toBeLessThan(0.6);
    await page.screenshot({ path: `${OUT}/${info.project.name}-${id}-on-deck.png` });
    const lift = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._threeBuildings?.groundLiftStats?.());
    // Every resident building near the rider stands on resolved relief (nothing left waiting at street level).
    expect(lift && lift.lifted > 100, JSON.stringify(lift)).toBeTruthy();
    report[id] = { deck, riderSurfaceM: rider, buildings: lift, status: await status(page) };
  }
  writeFileSync(`${OUT}/${info.project.name}-regressions.json`, JSON.stringify(report, null, 2));
  expect(errors).toEqual([]);
});

test('start flight: overview shows the flat basemap, the ground takes over on landing; no stencil elevation layer', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  // Both flags: own ground must retire the ?elevation=1 stencil layer.
  await page.addInitScript(() => { Object.assign(window as any, { __canalRecallOwnGround: true, __canalRecallElevation: true, __canalRecallForceIntro: true }); });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await expect.poll(() => page.evaluate(() => !!(window as any).canalRecallGame._intro), { timeout: 60_000 }).toBe(true);
  await page.waitForTimeout(500);
  const during = await page.evaluate(() => ({ intro: (window as any).canalRecallGame.camera.introOverview, s: (window as any).canalRecallGame.vectorMap.ownGroundStatus() }));
  await page.screenshot({ path: `${OUT}/${info.project.name}-intro-overview.png` });
  if (during.intro > 0) {
    expect(during.s.visible, 'own ground hidden over the overview').toBeFalsy();
    expect(during.s.basemapHidden, 'basemap ground shown over the overview').toBeFalsy();
  }
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame._intro), { timeout: 20_000 }).toBe(null);
  await expect.poll(async () => (await status(page)).basemapHidden, { timeout: 120_000, intervals: [1000] }).toBe(true);
  await page.screenshot({ path: `${OUT}/${info.project.name}-intro-landed.png` });
  const layers = await page.evaluate(() => { const m = (window as any).canalRecallGame.vectorMap.map; return { elevation: !!m.getLayer('canal-elevation'), flatDecks: !!m.getLayer('canal-elevation-flat-decks'), elevationObject: !!(window as any).canalRecallGame.vectorMap._elevation }; });
  expect(layers).toEqual({ elevation: false, flatDecks: false, elevationObject: false });
  expect(errors).toEqual([]);
});

test('question street is draped without its name; nothing on screen spells it', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page, true);
  await teleport(page, NASSAUKADE);
  await settle(page, 2000);
  const name = 'Nassaukade';
  const result = await page.evaluate((street) => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap;
    const index = g.track.segments.findIndex((s: any) => s.name === street);
    if (index < 0) return { index };
    // Pin the question street (the game re-sends its own every frame).
    const original = vm.__setHighlightsOriginal || (vm.__setHighlightsOriginal = vm.setStreetHighlights.bind(vm));
    vm.setStreetHighlights = (track: any, loader: any) => original(track, loader, [], street, index, null);
    vm.setStreetHighlights(g.track, g.osmLoader);
    return { index };
  }, name);
  expect(result.index).toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(2500);
  const s = await status(page);
  expect(s.overlays.highlight).toBeGreaterThan(0);
  // The ground draws geometry only; the basemap's labels keep their own rules. No rendered label spells the answer.
  const texts: string[] = await page.evaluate(() => {
    const map = (window as any).canalRecallGame.vectorMap.map;
    return map.queryRenderedFeatures().filter((f: any) => f.layer?.type === 'symbol').map((f: any) => String(f.properties?.name ?? f.properties?.['name:en'] ?? ''));
  });
  expect(texts.filter(t => t.includes(name))).toEqual([]);
  // The own ground holds no text at all (no sprite/label objects in its scene).
  const ownText = await page.evaluate(() => {
    let n = 0;
    (window as any).canalRecallGame.vectorMap._ownGround.root.traverse((o: any) => { if (o.isSprite || o.isPoints || /label|text/i.test(o.name)) n++; });
    return n;
  });
  expect(ownText).toBe(0);
  await page.screenshot({ path: `${OUT}/${info.project.name}-question-highlight.png` });
  expect(errors).toEqual([]);
});

/** Ride the player along a deck profile (extended `padM` past each end) at `speed` m/s in chase view, sampling the rider surface. */
async function rideDeck(page: Page, id: string, opts: { padM?: number; speed?: number; shotAt?: number[]; shot?: (k: number) => Promise<void> } = {}): Promise<{ samples: number[]; maxStep: number; crown: number }> {
  const path: [number, number][] = await page.evaluate(({ deckId, pad }) => {
    const vm = (window as any).canalRecallGame.vectorMap, api = (window as any).CanalRecallOwnGround;
    const deck = vm._ownGround.store.surface.decks.find((d: any) => d.profile.id === deckId);
    const p = deck.profile, n = p.x.length;
    const ux = p.x[n - 1] - p.x[0], uy = p.y[n - 1] - p.y[0], l = Math.hypot(ux, uy);
    const pts: [number, number][] = [[p.x[0] - ux / l * pad, p.y[0] - uy / l * pad]];
    for (let i = 0; i < n; i += 2) pts.push([p.x[i], p.y[i]]);
    pts.push([p.x[n - 1] + ux / l * pad, p.y[n - 1] + uy / l * pad]);
    return pts.map(([x, y]) => api.fromLocal(x, y));
  }, { deckId: id, pad: opts.padM ?? 25 });
  // The route line along the ride, so its continuity over the deck is visible.
  await page.evaluate((lngLats: [number, number][]) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const world = lngLats.map(([lng, lat]) => ({ x: l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, y: l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm }));
    // Pin it: the game re-routes after a teleport and re-sends its own route.
    const vm = g.vectorMap, original = vm.__setRouteOriginal || (vm.__setRouteOriginal = vm.setRoute.bind(vm));
    vm.setRoute = (_path: unknown, loader: unknown) => original(world, loader, true);
    vm.setRoute(world, l, true);
  }, path);
  const start = path[0], second = path[1];
  const bearing = (Math.atan2((second[0] - start[0]) * Math.cos(start[1] * Math.PI / 180), second[1] - start[1]) * 180 / Math.PI + 360) % 360;
  await teleport(page, { lng: start[0], lat: start[1], bearing });
  await settle(page, 1500);
  // Animate in the page: one position per animation frame along the polyline.
  await page.evaluate(({ lngLats, speed }) => {
    const g = (window as any).canalRecallGame, l = g.osmLoader, ppm = (0, eval)('PIXELS_PER_METER') as number;
    const toWorld = ([lng, lat]: [number, number]) => [l._lastOffsetX + (lng - l._lastCenterLng) * 111320 * Math.cos(l._lastCenterLat * Math.PI / 180) * ppm, l._lastOffsetY - (lat - l._lastCenterLat) * 111320 * ppm];
    const pts = lngLats.map(toWorld), cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / ppm);
    const total = cum[cum.length - 1], t0 = performance.now(), ride = { samples: [] as number[], done: false, progress: 0 };
    (window as any).__ride = ride;
    const step = () => {
      const d = Math.min(total, (performance.now() - t0) / 1000 * speed);
      let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
      const u = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), a = pts[i - 1], b = pts[i];
      g.player.x = a[0] + (b[0] - a[0]) * u; g.player.y = a[1] + (b[1] - a[1]) * u;
      g.player.angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      Object.assign(g.player, { speed: 0, vx: 0, vy: 0 });
      ride.samples.push(g.vectorMap._riderSurfaceM);
      ride.progress = d / total;
      if (d < total) requestAnimationFrame(step); else ride.done = true;
    };
    requestAnimationFrame(step);
  }, { lngLats: path, speed: opts.speed ?? 5.5 });
  for (const [k, at] of (opts.shotAt ?? []).entries()) {
    await page.waitForFunction((p) => (window as any).__ride.progress >= p, at, { timeout: 60_000 });
    await opts.shot?.(k);
  }
  await page.waitForFunction(() => (window as any).__ride.done, null, { timeout: 60_000 });
  const samples: number[] = await page.evaluate(() => (window as any).__ride.samples);
  let maxStep = 0;
  for (let i = 1; i < samples.length; i++) maxStep = Math.max(maxStep, Math.abs(samples[i] - samples[i - 1]));
  return { samples, maxStep, crown: Math.max(...samples) };
}

test('chase ride over three bridges (steel, masonry arch, steel)', async ({ page }, info) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page, true);
  const report: Record<string, unknown> = {};
  // BRU0166 Nassaukade (steel), BRU0044 Abel Weetnietbrug (masonry arch), BRU0067 Angenietje Swarthofbrug (steel, Leidsegracht / Prinsengracht).
  const bridges: [string, Place][] = [['BRU0166', NASSAUKADE], ['BRU0044', LEIDSEGRACHT], ['BRU0067', { lng: 4.882711, lat: 52.366289, bearing: 0 }]];
  for (const [id, place] of bridges) {
    await teleport(page, place);
    await settle(page, 2000);
    const ride = await rideDeck(page, id, {
      shotAt: [0.3, 0.5, 0.7],
      shot: async k => { await page.screenshot({ path: `${OUT}/${info.project.name}-ride-${id}-${k}.png` }); },
    });
    const s = await status(page);
    report[id] = { maxStep: +ride.maxStep.toFixed(3), crown: +ride.crown.toFixed(2), first: ride.samples[0], last: ride.samples[ride.samples.length - 1], frames: ride.samples.length, status: s };
    // Rider follows the deck profile: rises well above the approaches, and never jumps (eased per frame).
    expect(ride.crown - Math.max(ride.samples[0], ride.samples[ride.samples.length - 1])).toBeGreaterThan(0.4);
    expect(ride.maxStep).toBeLessThan(0.2);
    expect(s.overlays.route).toBeGreaterThan(0);
  }
  writeFileSync(`${OUT}/${info.project.name}-ride.json`, JSON.stringify(report, null, 2));
  expect(errors).toEqual([]);
});
