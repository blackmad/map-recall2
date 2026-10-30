import { test, expect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { openRoute } from './helpers';

// `?world=v1` against the default tile path at the world-compiler sentinels (lane L3, issue #130).
// Opt-in measurement until world-v1 is published:
//   WORLD_AB=1 [WORLD_DIR=artifacts/world/staging] [BUNDLES_DIR=dir] PW_PORT=4525 \
//     /tmp/canal-pw.sh npx playwright test world-v1-ab --project=desktop
// WORLD_DIR serves staged cells at /data/extracts/amsterdam/world-v1/ (nothing is published);
// BUNDLES_DIR serves *.bundle.js built from this checkout, for both variants alike.
// Per spot it records: the styled resident features per tile (hash), the three.js layer's stats, the
// screenshot difference, and world-v1 cell decode ms; output under artifacts/world/ab/.
test.skip(!process.env.WORLD_AB, 'set WORLD_AB=1 to measure');

const OUT = process.env.AB_DIR || 'artifacts/world/ab';
const WORLD_DIR = path.resolve(process.env.WORLD_DIR || 'artifacts/world/staging');
const SPOTS = [
  { name: 'westerkerk', at: [4.8826, 52.3741], face: [4.8843, 52.3746] },
  { name: 'bloemgracht-80', at: [4.8798, 52.3752], face: [4.8809, 52.3750] },
  { name: 'nassaukade', at: [4.8722, 52.3712], face: [4.8732, 52.3722] },
  { name: 'leidsegracht-courtyard', at: [4.8868, 52.3676], face: [4.8884, 52.3686] },
  { name: 'ijburg-edge', at: [5.0185, 52.3512], face: [5.0203, 52.3521] },
] as const;
const VARIANTS = [{ name: 'default', query: '' }, { name: 'world', query: '?world=v1' }] as const;

async function serve(page: Page) {
  await page.route(/\/data\/extracts\/amsterdam\/world-v1\/(.+)$/, route => {
    const rel = /world-v1\/([^?]+)/.exec(route.request().url())![1], file = path.join(WORLD_DIR, rel);
    if (!file.startsWith(WORLD_DIR) || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: readFileSync(file), contentType: rel.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  });
  if (process.env.BUNDLES_DIR) await page.route(/\/canal-drive\/js\/([\w-]+\.bundle\.js)(\?.*)?$/, route => {
    const file = path.join(process.env.BUNDLES_DIR!, /\/([\w-]+\.bundle\.js)/.exec(route.request().url())![1]);
    return existsSync(file) ? route.fulfill({ body: readFileSync(file), contentType: 'application/javascript' }) : route.continue();
  });
}

async function park(page: Page, at: readonly number[], face: readonly number[]) {
  await page.evaluate(({ at, face }) => {
    const g = (window as any).canalRecallGame, L = g.osmLoader;
    const k = 111320 * Math.cos(L._lastCenterLat * Math.PI / 180) * PIXELS_PER_METER;
    const toWorld = ([lng, lat]: number[]) => ({ x: L._lastOffsetX + (lng - L._lastCenterLng) * k, y: L._lastOffsetY - (lat - L._lastCenterLat) * 111320 * PIXELS_PER_METER });
    const a = toWorld(at as number[]), b = toWorld(face as number[]);
    g._updateCanalQuiz = () => {}; g._updateBridgeQuiz = () => {};
    g.player.x = a.x; g.player.y = a.y; g.player.angle = Math.atan2(b.y - a.y, b.x - a.x);
    g.player.speed = 0; g.player.vx = 0; g.player.vy = 0;
    g.viewMode = 'chase'; g.camera.viewMode = 'chase'; g.camera.northUp = false;
  }, { at, face });
}

/** Streamer idle and the three.js layer done building for two consecutive polls. */
async function settle(page: Page) {
  let last = '';
  await expect.poll(async () => {
    const now = await page.evaluate(() => {
      const vm = (window as any).canalRecallGame.vectorMap, s = vm._completeCity?.status?.(), t = vm._threeBuildings?.stats?.();
      return JSON.stringify([s?.inFlight, s?.queued, s?.tiles, s?.features, t?.chunks, t?.vertices, vm._threeBuildings?.pending?.length ?? 0]);
    });
    const ok = now === last && JSON.parse(now)[0] === 0 && JSON.parse(now)[1] === 0;
    last = now;
    return ok;
  }, { timeout: 120_000, intervals: [1500] }).toBe(true);
}

const results: Record<string, any> = {};
for (const variant of VARIANTS) {
  test(`world ab: ${variant.name}`, async ({ page }) => {
    test.setTimeout(900_000);
    await serve(page);
    await page.addInitScript(() => { (window as any).__canalRecallTrees3d = false; (window as any).__canalRecallChunkFade = false; });
    await openRoute(page, { travelMode: 'car', viewMode: 'chase', enterRacing: true, query: variant.query });
    mkdirSync(OUT, { recursive: true });
    const spots: Record<string, any> = {};
    for (const spot of SPOTS) {
      await park(page, spot.at, spot.face);
      await page.waitForTimeout(3000);
      await park(page, spot.at, spot.face);
      await settle(page);
      await park(page, spot.at, spot.face);
      await page.waitForTimeout(800);
      const shot = `${OUT}/${spot.name}-${variant.name}.png`;
      await page.screenshot({ path: shot });
      spots[spot.name] = await page.evaluate(() => {
        const vm = (window as any).canalRecallGame.vectorMap, city = vm._completeCity;
        const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
        const tiles: Record<string, string> = {};
        for (const [key, features] of city.cache.entries()) tiles[key] = fnv(JSON.stringify(features.map((f: any) => city.styled(f))));
        const t = vm._threeBuildings?.stats?.() ?? {};
        return { usingWorldCells: !!city.usingWorldCells, publishing: city.isPublishing, status: city.status(), tiles, three: { chunks: t.chunks, buildings: t.buildings, walls: t.walls, quads: t.quads, vertices: t.vertices, triangles: t.triangles },
          decodeMs: city.world ? Object.fromEntries(city.world.decodeMs) : null };
      });
      spots[spot.name].shot = shot;
    }
    results[variant.name] = spots;
    writeFileSync(`${OUT}/${variant.name}.json`, JSON.stringify(spots, null, 2));
    if (variant.name === 'world') for (const s of Object.values(spots)) expect(s.usingWorldCells, 'world-v1 index served').toBe(true);
  });
}

test('world ab: compare', async () => {
  const read = (n: string) => results[n] ?? JSON.parse(readFileSync(`${OUT}/${n}.json`, 'utf8'));
  const a = read('default'), b = read('world'), rows: Record<string, any> = {};
  for (const spot of SPOTS) {
    const x = a[spot.name], y = b[spot.name];
    const common = Object.keys(x.tiles).filter(k => k in y.tiles), differing = common.filter(k => x.tiles[k] !== y.tiles[k]);
    const [ia, ib] = await Promise.all([x.shot, y.shot].map((f: string) => sharp(f).raw().toBuffer({ resolveWithObject: true })));
    let px = 0; for (let i = 0; i < ia.data.length; i += ia.info.channels) if (ia.data[i] !== ib.data[i] || ia.data[i + 1] !== ib.data[i + 1] || ia.data[i + 2] !== ib.data[i + 2]) px++;
    rows[spot.name] = { commonTiles: common.length, tilesWithDifferentFeatures: differing, threeDefault: x.three, threeWorld: y.three, pixelsDiffering: px, pixels: ia.info.width * ia.info.height, decodeMs: y.decodeMs };
  }
  writeFileSync(`${OUT}/compare.json`, JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows, null, 2));
  for (const [name, r] of Object.entries(rows)) expect(r.tilesWithDifferentFeatures, `${name}: styled features per tile`).toEqual([]);
});
