import { expect, type Page, test } from '@playwright/test';

// Free Ride's collection (G4, #274; src/canalRecall/game/freeRideCollection.ts):
// a neighbourhood's checklist on the plaque, the discovery token on the
// nearest unopened landmark (≤ 24 px, never over the corridor), opening every
// place stamps the neighbourhood in the passport, and ?collection=0 restores
// the Free Ride of before.

type Pt = { x: number; y: number };
/** Set G4_SHOTS=<dir> to save the strip's frames. */
const SHOTS = process.env.G4_SHOTS || '';

async function startFreeRide(page: Page, query = '') {
  await page.route(/3dbag|cesium3dtiles/i, route => route.abort());
  await page.goto(`/canal-drive/?ride=free${query}`);
  await expect.poll(() => page.evaluate(() => (window as any).canalRecallGame?.state), { timeout: 120_000 }).toBe(4);
}

/** Put the bike at a world point (on the nearest road), still, facing `angle`. */
async function placeRider(page: Page, at: Pt, angle?: number) {
  await page.evaluate(({ at, angle }) => {
    const g = (window as any).canalRecallGame;
    const road = g.track.getNearestRoad(at.x, at.y);
    const p = road ? { x: road.x, y: road.y } : at;
    g.player.x = p.x; g.player.y = p.y; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.player.angle = angle ?? road?.angle ?? 0;
    g.camera.resetForRide?.(g.player);
    g._freeRideRefresh = 0;
  }, { at, angle });
}

/** The smallest neighbourhood list (fastest to finish), with its places. */
async function pickList(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    const lists = [...g._freeRideChecklists().values()] as Array<{ hood: string; places: Array<{ key: string; name: string; x: number; y: number }> }>;
    const marine = lists.find(l => /marineterrein/i.test(l.hood));
    const list = marine ?? lists.sort((a, b) => a.places.length - b.places.length || a.hood.localeCompare(b.hood))[0];
    return { hood: list.hood, places: list.places.map(p => ({ key: p.key, name: p.name, x: p.x, y: p.y })), lists: lists.length };
  });
}

const tokenState = (page: Page) => page.evaluate(() => {
  const g = (window as any).canalRecallGame;
  const c = g._freeRideCollection;
  const t = c?.tokenScreen;
  const corridor = c?.corridor;
  let clearance = Infinity;
  if (t && corridor) {
    for (let i = 1; i < corridor.path.length; i++) {
      const a = corridor.path[i - 1], b = corridor.path[i];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const u = l2 ? Math.max(0, Math.min(1, ((t.x - a.x) * dx + (t.y - a.y) * dy) / l2)) : 0;
      clearance = Math.min(clearance, Math.hypot(t.x - (a.x + dx * u), t.y - (a.y + dy * u)) - corridor.halfWidth - t.size / 2);
    }
  }
  const rect = g.canvas.getBoundingClientRect();
  const scale = rect.width / g.viewport.width;
  return {
    token: c?.token ? { key: c.token.key, distanceM: c.token.distance / 3 } : null,
    screen: t ? { ...t, pageX: rect.left + t.x * scale, pageY: rect.top + t.y * scale, cssSize: t.size * scale } : null,
    clearance,
    hidden: c?.tokenHidden ?? null,
  };
});

test('collection: checklist on the plaque, token ≤ 24 px off the corridor, all places opened stamps the neighbourhood', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(String(error)));
  await startFreeRide(page);

  const list = await pickList(page);
  expect(list.lists).toBeGreaterThan(10);
  expect(list.places.length).toBeGreaterThanOrEqual(2);
  expect(list.places.length).toBeLessThanOrEqual(9);

  // Every landmark but the list's first counts as opened for now, so the token can only be on it.
  await page.evaluate((key) => {
    const g = (window as any).canalRecallGame;
    for (const l of g.landmarks) if (l.id !== key) g._freeRideCollection.opened.add(l.id);
  }, list.places[0].key);

  // Stand ~200 m from the first place: the token is on it, small and faint, off the corridor.
  const first = list.places[0];
  // 200 m short of it, heading 25° to one side: in view, off the corridor.
  await page.evaluate((p) => {
    const g = (window as any).canalRecallGame;
    const d = 200 * 3;
    g.player.x = p.x - d; g.player.y = p.y; g.player.angle = -25 * Math.PI / 180;
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.camera.resetForRide?.(g.player);
    g._freeRideRefresh = 0;
  }, first);
  await page.waitForTimeout(600);
  await expect.poll(async () => (await tokenState(page)).token !== null, { timeout: 15_000 }).toBe(true);
  const far = await tokenState(page);
  console.log('G4 far token', JSON.stringify(far));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/token-far.png` });
  expect(far.token!.distanceM).toBeGreaterThan(120);
  expect(far.screen ? 'drawn' : far.hidden).not.toBe('corridor');
  if (far.screen) {
    expect(far.screen.cssSize).toBeLessThanOrEqual(20); // 22 px up close
    expect(far.screen.alpha).toBeLessThan(1);
    expect(far.clearance).toBeGreaterThan(0);
  }

  // Face the token's place from 40 m: it is straight ahead, on the corridor, so it is not drawn.
  const target = far.token!;
  const tp = list.places.find(p => p.key === target.key) ?? await page.evaluate((key) => {
    const l = (window as any).canalRecallGame.landmarks.find((m: { id: string }) => m.id === key);
    return { key, name: l.name, x: l.x, y: l.y };
  }, target.key);
  await page.evaluate(({ tp }) => {
    const g = (window as any).canalRecallGame;
    g.player.x = tp.x - 40 * 3; g.player.y = tp.y; g.player.angle = 0; g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.camera.resetForRide?.(g.player);
    g._freeRideRefresh = 0;
  }, { tp });
  await page.waitForTimeout(800);
  const ahead = await tokenState(page);
  console.log('G4 ahead token', JSON.stringify(ahead));
  // Straight ahead: never drawn on the corridor.
  expect(ahead.screen).toBeNull();
  expect(ahead.hidden).toBe('corridor');

  // The rest of the list back to unopened: the token leads round it.
  await page.evaluate((keys) => {
    const g = (window as any).canalRecallGame;
    for (const key of keys) g._freeRideCollection.opened.delete(key);
  }, list.places.map(p => p.key));

  // Walk the token round the list: ~60 m beside each place, tap the token if drawn, else ride through it.
  await page.evaluate(() => { (window as any).canalRecallGame._freeRideOpened = new Set(); });
  let tapped = 0;
  for (const place of list.places) {
    await placeRider(page, { x: place.x, y: place.y + 60 * 3 });
    await expect.poll(async () => (await tokenState(page)).token?.key ?? null, { timeout: 10_000 }).not.toBeNull();
    const state = await tokenState(page);
    if (state.token?.key === place.key && state.screen) {
      expect(state.screen.cssSize).toBeLessThanOrEqual(24);
      expect(state.clearance).toBeGreaterThan(0);
      if (SHOTS && tapped === 0) await page.screenshot({ path: `${SHOTS}/token-near.png` });
      await page.mouse.click(state.screen.pageX, state.screen.pageY);
      tapped++;
    } else {
      // Ride through it.
      await page.evaluate((p) => {
        const g = (window as any).canalRecallGame;
        g.player.x = p.x; g.player.y = p.y; g.player.speed = 0;
      }, place);
    }
    await expect.poll(() => page.evaluate((key) => (window as any).canalRecallGame._freeRideCollection.opened.has(key), place.key), { timeout: 10_000 }).toBe(true);
    await page.evaluate(() => (window as any).canalRecallGame._clearLandmarkNotice?.());
  }
  console.log('G4 list', list.hood, list.places.length, 'tapped', tapped);
  expect(tapped).toBeGreaterThan(0);
  if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/stamped.png` }); }

  const done = await page.evaluate((hood) => {
    const g = (window as any).canalRecallGame;
    return {
      passport: JSON.parse(localStorage.getItem('canalRecall.neighborhoodPassport.v1') || '{"stamped":[]}').stamped as string[],
      collection: JSON.parse(localStorage.getItem('canalRecall.freeRideCollection.v1') || '{}'),
      session: (window as any).__canalRecallSession,
      progress: g._freeRideChecklistProgress(hood),
      tally: g._freeRideTally(),
      postcard: g._neighborhoodNotice,
    };
  }, list.hood);
  expect(done.progress.done).toBe(true);
  expect(done.passport).toContain(list.hood);
  expect(done.collection.stamps.map((s: { hood: string }) => s.hood)).toContain(list.hood);
  expect(done.session.stampsEarned).toBe(1);
  expect(done.session.placesOpened).toBeGreaterThanOrEqual(list.places.length);
  expect(done.tally).toBe('Stamped in your passport');
  // The postcard carries the stamp on a wide screen; the phone keeps its bottom band clear.
  const compact = await page.evaluate(() => (window as any).canalRecallGame.viewport?.mode === 'compact');
  if (compact) expect(done.postcard?.stamped ?? false).toBe(false);
  else expect(done.postcard?.stamped).toBe(true);

  // Back in the neighbourhood the plaque reads "all N places".
  await page.evaluate((hood) => {
    const g = (window as any).canalRecallGame;
    g._freeRideCollection.stampMoment = null;
    g.currentNeighborhood = hood;
  }, list.hood);
  expect(await page.evaluate(() => (window as any).canalRecallGame._freeRideTally())).toBe(`all ${list.places.length} places`);
  expect(errors).toEqual([]);
});

test('?collection=0 restores the Free Ride of before: no token, the places-opened tally, no stamps', async ({ page }) => {
  await startFreeRide(page, '&collection=0');
  const state = await page.evaluate(() => {
    const g = (window as any).canalRecallGame;
    return { collection: g._freeRideCollection, tally: g._freeRideTally(), radar: g._freeRideRadarPlaces().length };
  });
  expect(state.collection).toBeNull();
  expect(state.tally).toBe('Tap a marker or a building');
  expect(state.radar).toBe(0);
});
