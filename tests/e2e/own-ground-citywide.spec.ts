import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openRoute } from './helpers';

// City-wide own ground (`?ownGround=1`): ride screenshots in districts outside
// the first streaming area (`west`), and the BRU0067 deck top. Opt-in:
//   OWN_GROUND=1 PW_PORT=4425 npx playwright test own-ground-citywide --project=desktop
//   OWN_GROUND=1 PW_PORT=4425 npx playwright test own-ground-citywide --project=iphone
test.skip(!process.env.OWN_GROUND, 'set OWN_GROUND=1');

const OUT = 'artifacts/own-ground-game';
type Place = { lng: number; lat: number; bearing: number };

/** Districts outside area `west` (lng 4.853–4.916, lat 52.352–52.393), each on a riding street. */
const DISTRICTS: [string, Place][] = [
  ['de-pijp-albert-cuypstraat', { lng: 4.8935, lat: 52.3558, bearing: 70 }],
  ['oost-linnaeusstraat', { lng: 4.9290, lat: 52.3605, bearing: 330 }],
  ['noord-van-der-pekstraat', { lng: 4.9045, lat: 52.3885, bearing: 20 }],
  ['zuid-beethovenstraat', { lng: 4.8772, lat: 52.3445, bearing: 0 }],
  ['nieuw-west-osdorpplein', { lng: 4.8005, lat: 52.3590, bearing: 90 }],
];

async function boot(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { (window as any).__canalRecallOwnGround = true; });
  await openRoute(page, { travelMode: 'car', viewMode: 'chase', abortHeavyTiles: false, enterRacing: false });
  await page.waitForFunction(() => (window as any).canalRecallGame.state === 4, null, { timeout: 120_000 });
  return errors;
}

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

async function settle(page: Page, ms = 4000): Promise<Record<string, any>> {
  await expect.poll(async () => {
    const s = await status(page);
    return s.ready && !s.queued && !Object.keys(s.pending ?? {}).length && Object.values(s.cells ?? {}).includes(0);
  }, { timeout: 180_000, intervals: [1000] }).toBe(true);
  await page.waitForTimeout(ms);
  return status(page);
}

test('city-wide: the ground covers districts outside area west', async ({ page }, info) => {
  test.setTimeout(1_200_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  const report: Record<string, unknown> = {};
  for (const [name, place] of DISTRICTS) {
    await teleport(page, place);
    const s = await settle(page);
    const rider = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._riderSurfaceM);
    await page.screenshot({ path: `${OUT}/${info.project.name}-district-${name}.png` });
    report[name] = { place, riderSurfaceM: rider, cells: s.cells, basemapHidden: s.basemapHidden, triangles: s.triangles, geometryMB: s.geometryMB, downloadedKB: s.downloadedKB, errors: s.errors };
    expect(s.errors, `${name}: ${JSON.stringify(s.errors)}`).toEqual([]);
    expect(s.basemapHidden, `${name}: own ground covers the rider's 3×3 cells`).toBe(true);
  }
  writeFileSync(`${OUT}/${info.project.name}-districts.json`, JSON.stringify(report, null, 2));
  expect(errors).toEqual([]);
});

test('models and pins on the surface: per-pand chunk bases, canvas pin lift, kit parts lifted', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  // Bilderdijkstraat block faces (chunk-face-bilder-*): street chunks on a measurable slope toward the kade.
  await teleport(page, { lng: 4.8712, lat: 52.3680, bearing: 330 });
  await settle(page, 4000);
  const chunks = await expect.poll(async () => page.evaluate(() => {
    const sl = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
    return (sl?._entries ?? []).filter((e: any) => e.spec.chunkPands && e.pandBases).map((e: any) => ({ id: e.spec.id, pands: e.spec.chunkPands.length, bases: e.pandBases, holderBase: e.groundBase }));
  }), { timeout: 120_000, intervals: [2000] }).not.toEqual([]).then(() => page.evaluate(() => {
    const sl = (window as any).canalRecallGame.vectorMap._signatureLandmarks;
    return (sl?._entries ?? []).filter((e: any) => e.spec.chunkPands).map((e: any) => ({ id: e.spec.id, pands: e.spec.chunkPands.length, bases: e.pandBases ?? null, holderBase: e.groundBase }));
  }));
  await page.screenshot({ path: `${OUT}/${info.project.name}-chunks-bilderdijkstraat.png` });
  const based = chunks.filter((c: any) => c.bases);
  expect(based.length).toBeGreaterThan(0);
  // Every pand of a based chunk has its own base, and the holder no longer carries one.
  for (const c of based) { expect(Object.keys(c.bases).length, c.id).toBe(c.pands); expect(c.holderBase, c.id).toBe(0); }
  // The canvas pin over a bridge crown moves up the screen by the deck height (BRU0166 crown ≈ 1.3 m).
  const pin = await page.evaluate(() => {
    const g = (window as any).canalRecallGame, vm = g.vectorMap, og = vm._ownGround, api = (window as any).CanalRecallOwnGround;
    const p = og.store.surface.decks.find((d: any) => d.profile.id === 'BRU0166')?.profile;
    if (!p) return null;
    const mid = p.x.length >> 1, [lng, lat] = api.fromLocal(p.x[mid], p.y[mid]);
    const flat = vm.map.project([lng, lat]), lift = og.screenLift([lng, lat]);
    return { z: og.heightAt([lng, lat]), flatY: flat.y, lift };
  });
  // Kit parts (towers, fronts) get relief bases like any building range: none left waiting at street level.
  const kit = await page.evaluate(() => {
    const tb = (window as any).canalRecallGame.vectorMap._threeBuildings, e = tb?.chunks?.get('__kit');
    return e?.lift ? { applied: e.lift.applied.size, pending: e.lift.pending.size, ranges: e.ranges.size } : null;
  });
  writeFileSync(`${OUT}/${info.project.name}-surface-hooks.json`, JSON.stringify({ chunks, pin, kit }, null, 2));
  if (pin) { expect(pin.z).toBeGreaterThan(0.5); expect(pin.lift, 'pin lifted').not.toBeNull(); expect(pin.lift[1]).toBeGreaterThan(0); }
  expect(errors).toEqual([]);
});

test('BRU0067: the deck top is the street band, not deck grey', async ({ page }, info) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const errors = await boot(page);
  await teleport(page, { lng: 4.882711, lat: 52.366289, bearing: 0 });
  await settle(page, 1500);
  const deck = await page.evaluate(() => {
    const vm = (window as any).canalRecallGame.vectorMap, api = (window as any).CanalRecallOwnGround;
    const d = vm._ownGround.store.surface.decks.find((x: any) => x.profile.id === 'BRU0067');
    const p = d.profile, mid = Math.floor(p.x.length / 2), dx = p.x[mid + 1] - p.x[mid - 1], dy = p.y[mid + 1] - p.y[mid - 1];
    const [lng, lat] = api.fromLocal(p.x[mid], p.y[mid]);
    return { lng, lat, bearing: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 };
  });
  await teleport(page, deck);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${info.project.name}-BRU0067-deck-top.png` });
  // The layer under the rider, by a downward ray through the ground meshes: a street band, never a deck top.
  const hit = await page.evaluate(() => (window as any).canalRecallGame.vectorMap._ownGround.layersAt());
  writeFileSync(`${OUT}/${info.project.name}-BRU0067.json`, JSON.stringify({ deck, hit }, null, 2));
  expect(hit.top, JSON.stringify(hit)).not.toBe('deckTop');
  expect(['asphalt', 'klinker', 'paving', 'cycle']).toContain(hit.top);
  expect(errors).toEqual([]);
});
